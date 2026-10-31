import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Merchant authentication, consent and lender review', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let partnerId: string;
  let key: string;
  let supplier: string;
  let buyer: string;
  let tradeId: string;
  let applicationId: string;
  let lenderId: string;
  let secondLenderId: string;
  let merchantToken: string;
  let supplierToken: string;
  let lenderToken: string;
  let secondLenderToken: string;
  const operator = 'review-integration-operator';
  const partners: string[] = [];
  let oldOperator: string | undefined;
  const admin = (path: string, body: object = {}, apiKey = key) =>
    request(app.getHttpServer())
      .post(`/api/merchant-network/${path}`)
      .set('x-api-key', apiKey)
      .set('x-merchant-operator-key', operator)
      .send(body);
  const post = (
    token: string,
    action: string,
    body: object = {},
    id = applicationId,
  ) =>
    request(app.getHttpServer())
      .post(`/api/pilot/applications/${id}/${action}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  const workspace = (token: string) =>
    request(app.getHttpServer())
      .get('/api/pilot/workspace')
      .set('Authorization', `Bearer ${token}`);
  const consent = () =>
    post(merchantToken, 'consent', {
      lenderId,
      confirmed: true,
      scope: 'application-v1',
    });
  const approve = () =>
    post(lenderToken, 'decision', {
      decision: 'APPROVED',
      approvedAmountMinor: 30000,
      reason: 'Manual pilot assessment completed',
    });
  const verify = (verified = true) =>
    admin(`merchants/${supplier}/verification`, {
      verified,
      evidence: 'Business and supplier relationship checked, reference S-001',
    });
  async function partner() {
    const p = await request(app.getHttpServer())
      .post('/api/partners')
      .send({
        name: 'Review test partner',
        email: `${randomUUID()}@example.com`,
      })
      .expect(201);
    partners.push(p.body.id);
    const k = await request(app.getHttpServer())
      .post(`/api/partners/${p.body.id}/api-keys`)
      .send({ name: 'Review test' })
      .expect(201);
    return { id: p.body.id as string, key: k.body.key as string };
  }
  beforeAll(async () => {
    oldOperator = process.env.MERCHANT_OPERATOR_KEY;
    process.env.MERCHANT_OPERATOR_KEY = operator;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = module.get(PrismaService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const p = await partner();
    partnerId = p.id;
    key = p.key;
  });
  beforeEach(async () => {
    supplier = (
      await admin('merchants', { name: 'Supplier', market: 'Merkato' }).expect(
        201,
      )
    ).body.id;
    buyer = (
      await admin('merchants', { name: 'Buyer', market: 'Merkato' }).expect(201)
    ).body.id;
    const offer = (
      await admin('offers', {
        merchantId: supplier,
        commodity: 'Teff',
        availableKg: 100,
        pricePerKgMinor: 5000,
      }).expect(201)
    ).body.id;
    tradeId = (
      await admin('trades', {
        offerId: offer,
        buyerId: buyer,
        quantityKg: 10,
        requestKey: randomUUID(),
      }).expect(201)
    ).body.id;
    applicationId = (
      await admin('financing-requests', {
        tradeId,
        amountMinor: 40000,
        purpose: 'Inventory',
      }).expect(201)
    ).body.id;
    lenderId = (await admin('lenders', { name: 'Pilot lender A' }).expect(201))
      .body.id;
    secondLenderId = (
      await admin('lenders', { name: 'Pilot lender B' }).expect(201)
    ).body.id;
    merchantToken = (await admin(`merchants/${buyer}/access`).expect(201)).body
      .token;
    supplierToken = (await admin(`merchants/${supplier}/access`).expect(201))
      .body.token;
    lenderToken = (await admin(`lenders/${lenderId}/access`).expect(201)).body
      .token;
    secondLenderToken = (
      await admin(`lenders/${secondLenderId}/access`).expect(201)
    ).body.token;
  });
  afterAll(async () => {
    const where = { partnerId: { in: partners } };
    await prisma.financingReviewEvent.deleteMany({ where: { request: where } });
    await prisma.financingRequest.deleteMany({ where });
    await prisma.tradeAttestation.deleteMany({ where: { trade: where } });
    await prisma.tradeAgreement.deleteMany({ where });
    await prisma.offer.deleteMany({ where });
    await prisma.pilotAccess.deleteMany({ where });
    await prisma.supplierVerification.deleteMany({
      where: { merchant: where },
    });
    await prisma.merchant.deleteMany({ where });
    await prisma.pilotLender.deleteMany({ where });
    await prisma.apiKey.deleteMany({ where });
    await prisma.partner.deleteMany({ where: { id: { in: partners } } });
    await app.close();
    if (oldOperator === undefined) delete process.env.MERCHANT_OPERATOR_KEY;
    else process.env.MERCHANT_OPERATOR_KEY = oldOperator;
  });

  it('requires a distinct pilot credential, never returns hashes, and supports rotation/revocation/expiry', async () => {
    await request(app.getHttpServer())
      .get('/api/pilot/workspace')
      .set('x-api-key', key)
      .expect(401);
    await workspace('invalid').expect(401);
    await workspace(merchantToken).expect(200);
    const stored = await prisma.pilotAccess.findUniqueOrThrow({
      where: { merchantId: buyer },
    });
    expect(stored.tokenHash).not.toContain(merchantToken);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const rotated = await admin(`merchants/${buyer}/access`).expect(201);
    expect(rotated.body).not.toHaveProperty('tokenHash');
    expect(rotated.headers['cache-control']).toBe('no-store');
    await workspace(merchantToken).expect(401);
    await workspace(rotated.body.token).expect(200);
    const accessList = await request(app.getHttpServer())
      .get('/api/merchant-network/access')
      .set('x-api-key', key)
      .set('x-merchant-operator-key', operator)
      .expect(200);
    expect(JSON.stringify(accessList.body)).not.toContain('tokenHash');
    expect(JSON.stringify(accessList.body)).not.toContain(rotated.body.token);
    await admin(`access/${rotated.body.id}/revoke`).expect(201);
    await workspace(rotated.body.token).expect(401);
    const expired = await admin(`merchants/${buyer}/access`).expect(201);
    await prisma.pilotAccess.update({
      where: { id: expired.body.id },
      data: { expiresAt: new Date(0) },
    });
    await workspace(expired.body.token).expect(401);
    await request(app.getHttpServer())
      .post(`/api/merchant-network/merchants/${buyer}/access`)
      .set('x-api-key', key)
      .expect(401);
  });

  it('isolates merchants, reviewers and partner administration', async () => {
    const buyerView = await workspace(merchantToken).expect(200);
    expect(
      buyerView.body.applications.map((a: { id: string }) => a.id),
    ).toEqual([applicationId]);
    expect(
      (await workspace(supplierToken).expect(200)).body.applications,
    ).toEqual([]);
    await post(supplierToken, 'consent', {
      lenderId,
      confirmed: true,
      scope: 'application-v1',
    }).expect(404);
    await post(lenderToken, 'consent', {
      lenderId,
      confirmed: true,
      scope: 'application-v1',
    }).expect(403);
    await post(merchantToken, 'review').expect(403);
    const foreign = await partner();
    await admin(`merchants/${buyer}/access`, {}, foreign.key).expect(404);
    await admin(
      `merchants/${supplier}/verification`,
      { verified: true, evidence: 'No access' },
      foreign.key,
    ).expect(404);
    const foreignLender = (
      await admin('lenders', { name: 'Foreign lender' }, foreign.key).expect(
        201,
      )
    ).body.id;
    await post(merchantToken, 'consent', {
      lenderId: foreignLender,
      confirmed: true,
      scope: 'application-v1',
    }).expect(404);
  });

  it('requires affirmative scoped consent and exposes only a minimal application to the chosen lender', async () => {
    expect(
      (await workspace(lenderToken).expect(200)).body.applications,
    ).toEqual([]);
    await post(lenderToken, 'review').expect(404);
    await post(merchantToken, 'consent', {
      lenderId,
      confirmed: false,
      scope: 'application-v1',
    }).expect(400);
    await post(merchantToken, 'consent', {
      lenderId,
      confirmed: true,
      scope: 'all-history',
    }).expect(400);
    await consent().expect(201);
    await consent().expect(409);
    const view = await workspace(lenderToken).expect(200);
    expect(view.body.applications).toHaveLength(1);
    const shared = view.body.applications[0];
    expect(shared.merchant).toEqual({ name: 'Buyer', market: 'Merkato' });
    expect(shared.trade).not.toHaveProperty('paymentReference');
    expect(shared.trade).not.toHaveProperty('deliveryEvidence');
    expect(shared).not.toHaveProperty('reviewEvents');
    expect(JSON.stringify(view.body)).not.toContain('tokenHash');
    expect(
      (await workspace(secondLenderToken).expect(200)).body.applications,
    ).toEqual([]);
    await post(secondLenderToken, 'review').expect(404);
  });

  it('requires verified suppliers and an explicit valid review before approval, without moving money', async () => {
    await consent().expect(201);
    await post(lenderToken, 'review').expect(409);
    await verify().expect(201);
    await approve().expect(409);
    await post(lenderToken, 'review').expect(201);
    await post(lenderToken, 'decision', {
      decision: 'APPROVED',
      reason: '   ',
      approvedAmountMinor: 30000,
    }).expect(400);
    await post(lenderToken, 'decision', {
      decision: 'APPROVED',
      reason: 'Review',
      approvedAmountMinor: 40001,
    }).expect(400);
    await post(lenderToken, 'decision', {
      decision: 'APPROVED',
      reason: 'Review',
    }).expect(400);
    await approve().expect(201);
    await approve().expect(409);
    const stored = await prisma.financingRequest.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(stored).toMatchObject({
      status: 'APPROVED',
      approvedAmountMinor: 30000,
    });
    const events = await prisma.financingReviewEvent.findMany({
      where: { requestId: applicationId },
      orderBy: { sequence: 'asc' },
    });
    expect(events.map((e) => e.kind)).toEqual([
      'CONSENT_GRANTED',
      'UNDER_REVIEW',
      'APPROVED',
    ]);
    expect(events.every((e) => /:v\d+$/.test(e.actorId))).toBe(true);
    expect(await prisma.ledgerEntry.count({ where: { partnerId } })).toBe(0);
    expect(await prisma.transfer.count({ where: { partnerId } })).toBe(0);
  });

  it('withdraws access, blocks decisions, and permits a fresh lender choice before a decision', async () => {
    await consent().expect(201);
    await verify().expect(201);
    await post(lenderToken, 'review').expect(201);
    await post(merchantToken, 'withdraw').expect(201);
    expect(
      (await workspace(lenderToken).expect(200)).body.applications,
    ).toEqual([]);
    await approve().expect(404);
    await post(merchantToken, 'consent', {
      lenderId: secondLenderId,
      confirmed: true,
      scope: 'application-v1',
    }).expect(201);
    await post(lenderToken, 'review').expect(404);
    await post(secondLenderToken, 'review').expect(201);
    await post(secondLenderToken, 'decision', {
      decision: 'DECLINED',
      reason: 'Insufficient verified trading records',
      approvedAmountMinor: 1,
    }).expect(400);
    await post(secondLenderToken, 'decision', {
      decision: 'DECLINED',
      reason: 'Insufficient verified trading records',
    }).expect(201);
    await post(merchantToken, 'withdraw').expect(201);
    expect(
      (await workspace(secondLenderToken).expect(200)).body.applications,
    ).toEqual([]);
    const merchant = await workspace(merchantToken).expect(200);
    expect(merchant.body.applications[0]).toMatchObject({
      status: 'DECLINED',
      decisionReason: 'Insufficient verified trading records',
    });
    await consent().expect(409);
  });

  it('rechecks supplier verification and delivery at decision time', async () => {
    await consent().expect(201);
    await verify().expect(201);
    await post(lenderToken, 'review').expect(201);
    await verify(false).expect(201);
    await approve().expect(409);
    await verify().expect(201);
    await admin(`trades/${tradeId}/delivery`, {
      evidence: 'Delivery receipt',
    }).expect(201);
    await approve().expect(409);
    expect(
      (
        await prisma.financingRequest.findUniqueOrThrow({
          where: { id: applicationId },
        })
      ).status,
    ).toBe('UNDER_REVIEW');
    expect(
      await prisma.supplierVerification.count({
        where: { merchantId: supplier },
      }),
    ).toBe(3);
  });

  it('serializes simultaneous decisions so only one final event is recorded', async () => {
    await consent().expect(201);
    await verify().expect(201);
    await post(lenderToken, 'review').expect(201);
    const results = await Promise.all([
      approve(),
      post(lenderToken, 'decision', {
        decision: 'DECLINED',
        reason: 'Manual review declined',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.financingReviewEvent.count({
        where: {
          requestId: applicationId,
          kind: { in: ['APPROVED', 'DECLINED'] },
        },
      }),
    ).toBe(1);
  });

  it('serializes consent withdrawal against approval and always removes subsequent lender access', async () => {
    await consent().expect(201);
    await verify().expect(201);
    await post(lenderToken, 'review').expect(201);
    const [withdrawal, approval] = await Promise.all([
      post(merchantToken, 'withdraw'),
      approve(),
    ]);
    expect(withdrawal.status).toBe(201);
    expect([201, 404]).toContain(approval.status);
    const events = await prisma.financingReviewEvent.findMany({
      where: { requestId: applicationId },
      orderBy: { sequence: 'asc' },
    });
    const revokedIndex = events.findIndex(
      (e) => e.kind === 'CONSENT_WITHDRAWN',
    );
    expect(
      events.slice(revokedIndex + 1).some((e) => e.kind === 'APPROVED'),
    ).toBe(false);
    expect(
      (await workspace(lenderToken).expect(200)).body.applications,
    ).toEqual([]);
    await approve().expect(404);
  });
});
