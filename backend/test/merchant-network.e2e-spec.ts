import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Merchant network assisted pilot', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let key: string;
  let otherKey: string;
  let supplier: string;
  let buyer: string;
  let offer: string;
  let originalOperatorKey: string | undefined;
  const operatorKey = 'integration-only-operator';
  const partnerIds: string[] = [];
  const post = (path: string, payload: object, apiKey = key) =>
    request(app.getHttpServer())
      .post(`/api/merchant-network/${path}`)
      .set('x-api-key', apiKey)
      .set('x-merchant-operator-key', operatorKey)
      .send(payload);

  beforeAll(async () => {
    originalOperatorKey = process.env.MERCHANT_OPERATOR_KEY;
    process.env.MERCHANT_OPERATOR_KEY = operatorKey;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = module.get(PrismaService);
    await app.init();
    async function onboard() {
      const p = await request(app.getHttpServer())
        .post('/api/partners')
        .send({ name: 'Pilot test', email: `${randomUUID()}@example.com` })
        .expect(201);
      partnerIds.push(p.body.id);
      const k = await request(app.getHttpServer())
        .post(`/api/partners/${p.body.id}/api-keys`)
        .send({ name: 'Pilot test' })
        .expect(201);
      return k.body.key as string;
    }
    key = await onboard();
    otherKey = await onboard();
  });
  beforeEach(async () => {
    supplier = (
      await post('merchants', {
        name: 'Grain supplier',
        market: 'Ehil Berenda',
      }).expect(201)
    ).body.id;
    buyer = (
      await post('merchants', {
        name: 'Grain buyer',
        market: 'Merkato',
      }).expect(201)
    ).body.id;
    offer = (
      await post('offers', {
        merchantId: supplier,
        commodity: 'White teff',
        availableKg: 100,
        pricePerKgMinor: 5000,
      }).expect(201)
    ).body.id;
  });
  afterAll(async () => {
    const where = { partnerId: { in: partnerIds } };
    await prisma.tradeAttestation.deleteMany({ where: { trade: where } });
    await prisma.financingRequest.deleteMany({ where });
    await prisma.tradeAgreement.deleteMany({ where });
    await prisma.offer.deleteMany({ where });
    await prisma.merchant.deleteMany({ where });
    await prisma.apiKey.deleteMany({ where });
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await app.close();
    if (originalOperatorKey === undefined)
      delete process.env.MERCHANT_OPERATOR_KEY;
    else process.env.MERCHANT_OPERATOR_KEY = originalOperatorKey;
  });
  async function agree(quantityKg = 10) {
    return (
      await post('trades', {
        offerId: offer,
        buyerId: buyer,
        quantityKg,
        requestKey: randomUUID(),
      }).expect(201)
    ).body;
  }
  it('requires both credentials and fails closed when operator configuration is absent', async () => {
    await request(app.getHttpServer())
      .get('/api/merchant-network')
      .set('x-api-key', key)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/merchant-network')
      .set('x-merchant-operator-key', operatorKey)
      .expect(401);
    delete process.env.MERCHANT_OPERATOR_KEY;
    await post('merchants', { name: 'Blocked', market: 'Merkato' }).expect(401);
    process.env.MERCHANT_OPERATOR_KEY = operatorKey;
  });
  it('keeps all records and related identifiers within the partner scope', async () => {
    const snapshot = await request(app.getHttpServer())
      .get('/api/merchant-network')
      .set('x-api-key', otherKey)
      .set('x-merchant-operator-key', operatorKey)
      .expect(200);
    expect(snapshot.body).toEqual({
      merchants: [],
      offers: [],
      trades: [],
      financingRequests: [],
    });
    await post(
      'offers',
      {
        merchantId: supplier,
        commodity: 'Teff',
        availableKg: 2,
        pricePerKgMinor: 100,
      },
      otherKey,
    ).expect(404);
    await post(
      'trades',
      {
        offerId: offer,
        buyerId: buyer,
        quantityKg: 1,
        requestKey: randomUUID(),
      },
      otherKey,
    ).expect(404);
    const trade = await agree();
    await post(
      `trades/${trade.id}/delivery`,
      { evidence: 'Receipt' },
      otherKey,
    ).expect(404);
    await post(
      `trades/${trade.id}/payment-verification`,
      {
        provider: 'BANK',
        reference: randomUUID().toUpperCase(),
        amountMinor: trade.totalMinor,
        evidence: 'Bank receipt',
      },
      otherKey,
    ).expect(404);
    await post(
      'financing-requests',
      { tradeId: trade.id, amountMinor: 1, purpose: 'Inventory' },
      otherKey,
    ).expect(404);
  });
  it('records the trade, application and immutable evidence without moving funds', async () => {
    const trade = await agree();
    const application = await post('financing-requests', {
      tradeId: trade.id,
      amountMinor: 40000,
      purpose: 'Buy stock from supplier',
    }).expect(201);
    expect(application.body).toMatchObject({
      merchantId: buyer,
      status: 'SUBMITTED',
      currency: 'ETB',
    });
    await post('financing-requests', {
      tradeId: trade.id,
      amountMinor: 40000,
      purpose: 'Duplicate',
    }).expect(409);
    await post(`trades/${trade.id}/delivery`, {
      evidence: 'Buyer receipt D-001 checked',
    }).expect(201);
    const payment = {
      provider: 'BANK',
      reference: randomUUID().toUpperCase(),
      amountMinor: trade.totalMinor,
      evidence: 'Statement reconciled by pilot operator',
    };
    const completed = await post(
      `trades/${trade.id}/payment-verification`,
      payment,
    ).expect(201);
    expect(completed.body.state).toBe('COMPLETED');
    await post(`trades/${trade.id}/payment-verification`, payment).expect(409);
    const events = await prisma.tradeAttestation.findMany({
      where: { tradeId: trade.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.kind)).toEqual([
      'AGREED',
      'DELIVERED',
      'PAYMENT_MANUALLY_VERIFIED',
    ]);
    expect(events.every((e) => e.actorKeyId.length > 0)).toBe(true);
    expect(
      await prisma.ledgerEntry.count({ where: { partnerId: partnerIds[0] } }),
    ).toBe(0);
  });
  it('rejects invalid quantities, self-trades, overfunding and out-of-order transitions', async () => {
    await post('merchants', { name: '   ', market: 'Merkato' }).expect(400);
    await post('trades', {
      offerId: offer,
      buyerId: supplier,
      quantityKg: 1,
      requestKey: randomUUID(),
    }).expect(400);
    for (const quantityKg of [0, -1, 1.5, '1'])
      await post('trades', {
        offerId: offer,
        buyerId: buyer,
        quantityKg,
        requestKey: randomUUID(),
      }).expect(400);
    const trade = await agree();
    await post('financing-requests', {
      tradeId: trade.id,
      amountMinor: trade.totalMinor + 1,
      purpose: 'Stock',
    }).expect(400);
    const payment = {
      provider: 'BANK',
      reference: randomUUID().toUpperCase(),
      amountMinor: trade.totalMinor,
      evidence: 'Receipt',
    };
    await post(`trades/${trade.id}/payment-verification`, payment).expect(409);
    await post(`trades/${trade.id}/delivery`, { evidence: 'Receipt' }).expect(
      201,
    );
    await post(`trades/${trade.id}/delivery`, { evidence: 'Duplicate' }).expect(
      409,
    );
    await post('financing-requests', {
      tradeId: trade.id,
      amountMinor: 1,
      purpose: 'Late application',
    }).expect(409);
    await post(`trades/${trade.id}/payment-verification`, {
      ...payment,
      amountMinor: 1,
    }).expect(400);
  });
  it('does not oversell under concurrent purchases, and replays agreements safely', async () => {
    const responses = await Promise.all(
      [0, 1].map(() =>
        post('trades', {
          offerId: offer,
          buyerId: buyer,
          quantityKg: 80,
          requestKey: randomUUID(),
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offer } }))
        .availableKg,
    ).toBe(20);
    const payload = {
      offerId: offer,
      buyerId: buyer,
      quantityKg: 5,
      requestKey: randomUUID(),
    };
    const first = await post('trades', payload).expect(201);
    const replay = await post('trades', payload).expect(201);
    expect(replay.body.id).toBe(first.body.id);
    await post('trades', { ...payload, quantityKg: 6 }).expect(409);
    expect(
      (await prisma.offer.findUniqueOrThrow({ where: { id: offer } }))
        .availableKg,
    ).toBe(15);
  });
  it('rejects reused payment references and rolls back the completion and evidence', async () => {
    const one = await agree();
    const two = await agree();
    for (const t of [one, two])
      await post(`trades/${t.id}/delivery`, {
        evidence: 'Delivery receipt',
      }).expect(201);
    const payment = {
      provider: 'BANK',
      reference: randomUUID().toUpperCase(),
      amountMinor: one.totalMinor,
      evidence: 'Statement',
    };
    await post(`trades/${one.id}/payment-verification`, payment).expect(201);
    await post(`trades/${two.id}/payment-verification`, payment).expect(409);
    expect(
      (await prisma.tradeAgreement.findUniqueOrThrow({ where: { id: two.id } }))
        .state,
    ).toBe('DELIVERED');
    expect(
      await prisma.tradeAttestation.count({ where: { tradeId: two.id } }),
    ).toBe(2);
  });
});
