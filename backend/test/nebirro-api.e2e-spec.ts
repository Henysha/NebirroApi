import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LedgerEntryType, WebhookEventStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NebirroAPI programmable infrastructure flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: Parameters<typeof request>[0];
  let apiKey: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    prisma = moduleRef.get(PrismaService);
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    await cleanDatabase();
    const onboarding = await createPartnerAndApiKey();
    apiKey = onboarding.apiKey;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('creates a partner, creates an API key, returns plaintext once, and protects endpoints', async () => {
    await cleanDatabase();

    const partnerResponse = await request(httpServer)
      .post('/api/partners')
      .send({
        name: 'Integration Partner',
        email: uniqueEmail('partner'),
      })
      .expect(201);

    const apiKeyResponse = await request(httpServer)
      .post(`/api/partners/${partnerResponse.body.id}/api-keys`)
      .send({ name: 'Integration key' })
      .expect(201);

    expect(apiKeyResponse.body.key).toMatch(/^nb_test_/);
    expect(apiKeyResponse.body.keyHash).toBeUndefined();

    await request(httpServer).get('/api/customers').expect(401);
    await request(httpServer).get('/api/customers').set('x-api-key', 'nb_test_invalid').expect(401);
    await request(httpServer).get('/api/customers').set('x-api-key', apiKeyResponse.body.key).expect(200);

    const listedKeys = await request(httpServer)
      .get(`/api/partners/${partnerResponse.body.id}/api-keys`)
      .expect(200);
    expect(listedKeys.body).toHaveLength(1);
    expect(listedKeys.body[0]).not.toHaveProperty('key');
    expect(listedKeys.body[0]).not.toHaveProperty('keyHash');
  });

  it('creates a customer and wallet with starting balance 0', async () => {
    const customer = await createCustomer();
    const wallet = await createWallet(customer.id, 'Operating wallet');

    const balance = await request(httpServer)
      .get(`/api/wallets/${wallet.id}/balance`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(balance.body).toEqual({
      walletId: wallet.id,
      currency: 'USD',
      balance: 0,
    });
  });

  it('funds a wallet, creates a CREDIT ledger entry, and derives balance from ledger', async () => {
    const customer = await createCustomer();
    const wallet = await createWallet(customer.id, 'Funding wallet');

    await fundWallet(wallet.id, 10000);

    const ledger = await request(httpServer)
      .get(`/api/wallets/${wallet.id}/ledger`)
      .set('x-api-key', apiKey)
      .expect(200);
    expect(ledger.body).toEqual([
      expect.objectContaining({
        walletId: wallet.id,
        type: LedgerEntryType.CREDIT,
        amount: 10000,
        currency: 'USD',
      }),
    ]);

    const balance = await request(httpServer)
      .get(`/api/wallets/${wallet.id}/balance`)
      .set('x-api-key', apiKey)
      .expect(200);
    expect(balance.body.balance).toBe(10000);
  });

  it('moves value between wallets with DEBIT and CREDIT entries and updated balances', async () => {
    const customer = await createCustomer();
    const sourceWallet = await createWallet(customer.id, 'Source wallet');
    const destinationWallet = await createWallet(customer.id, 'Destination wallet');
    await fundWallet(sourceWallet.id, 10000);

    const transfer = await request(httpServer)
      .post('/api/transfers')
      .set('x-api-key', apiKey)
      .send({
        sourceWalletId: sourceWallet.id,
        destinationWalletId: destinationWallet.id,
        amount: 3500,
        currency: 'USD',
      })
      .expect(201);

    await expectLedgerEntry(sourceWallet.id, transfer.body.id, LedgerEntryType.DEBIT, 3500);
    await expectLedgerEntry(destinationWallet.id, transfer.body.id, LedgerEntryType.CREDIT, 3500);
    await expectBalance(sourceWallet.id, 6500);
    await expectBalance(destinationWallet.id, 3500);
  });

  it('rejects insufficient funds and creates no invalid ledger entries', async () => {
    const customer = await createCustomer();
    const sourceWallet = await createWallet(customer.id, 'Thin source wallet');
    const destinationWallet = await createWallet(customer.id, 'Blocked destination wallet');
    await fundWallet(sourceWallet.id, 500);

    await request(httpServer)
      .post('/api/transfers')
      .set('x-api-key', apiKey)
      .send({
        sourceWalletId: sourceWallet.id,
        destinationWalletId: destinationWallet.id,
        amount: 1000,
        currency: 'USD',
      })
      .expect(400);

    const sourceLedger = await listLedger(sourceWallet.id);
    const destinationLedger = await listLedger(destinationWallet.id);
    expect(sourceLedger).toHaveLength(1);
    expect(sourceLedger[0]).toMatchObject({ type: LedgerEntryType.CREDIT, amount: 500 });
    expect(destinationLedger).toHaveLength(0);
    await expectBalance(sourceWallet.id, 500);
    await expectBalance(destinationWallet.id, 0);
  });

  it('returns the same transfer for repeated idempotent requests without duplicate ledger entries', async () => {
    const customer = await createCustomer();
    const sourceWallet = await createWallet(customer.id, 'Idempotent source wallet');
    const destinationWallet = await createWallet(customer.id, 'Idempotent destination wallet');
    await fundWallet(sourceWallet.id, 10000);

    const payload = {
      sourceWalletId: sourceWallet.id,
      destinationWalletId: destinationWallet.id,
      amount: 2000,
      currency: 'USD',
    };

    const first = await request(httpServer)
      .post('/api/transfers')
      .set('x-api-key', apiKey)
      .set('Idempotency-Key', 'transfer-idem-001')
      .send(payload)
      .expect(201);
    const second = await request(httpServer)
      .post('/api/transfers')
      .set('x-api-key', apiKey)
      .set('Idempotency-Key', 'transfer-idem-001')
      .send(payload)
      .expect(201);

    expect(second.body).toMatchObject({ id: first.body.id });
    const sourceLedger = await listLedger(sourceWallet.id);
    const destinationLedger = await listLedger(destinationWallet.id);
    expect(sourceLedger.filter((entry) => entry.transferId === first.body.id)).toHaveLength(1);
    expect(destinationLedger.filter((entry) => entry.transferId === first.body.id)).toHaveLength(1);
  });

  it('creates webhook events, lists them, and retries an event', async () => {
    const customer = await createCustomer();
    const wallet = await createWallet(customer.id, 'Webhook wallet');

    const transfer = await fundWallet(wallet.id, 1200);

    const events = await request(httpServer)
      .get('/api/webhook-events')
      .set('x-api-key', apiKey)
      .expect(200);
    expect(events.body).toEqual([
      expect.objectContaining({
        transferId: transfer.id,
        type: 'WALLET_FUNDED',
        status: WebhookEventStatus.PENDING,
      }),
    ]);

    const retry = await request(httpServer)
      .post(`/api/webhook-events/${events.body[0].id}/retry`)
      .set('x-api-key', apiKey)
      .expect(201);
    expect(retry.body).toMatchObject({
      id: events.body[0].id,
      status: WebhookEventStatus.PENDING,
      attempts: 1,
    });
  });

  async function createPartnerAndApiKey() {
    const partner = await request(httpServer)
      .post('/api/partners')
      .send({
        name: 'Nebirro Integration Partner',
        email: uniqueEmail('partner'),
      })
      .expect(201);
    const apiKeyResponse = await request(httpServer)
      .post(`/api/partners/${partner.body.id}/api-keys`)
      .send({ name: 'E2E key' })
      .expect(201);

    return {
      partnerId: partner.body.id as string,
      apiKey: apiKeyResponse.body.key as string,
    };
  }

  async function createCustomer() {
    const response = await request(httpServer)
      .post('/api/customers')
      .set('x-api-key', apiKey)
      .send({
        email: uniqueEmail('customer'),
        name: 'Integration Customer',
      })
      .expect(201);
    return response.body;
  }

  async function createWallet(customerId: string, name: string) {
    const response = await request(httpServer)
      .post('/api/wallets')
      .set('x-api-key', apiKey)
      .send({
        customerId,
        name,
        currency: 'USD',
      })
      .expect(201);
    return response.body;
  }

  async function fundWallet(walletId: string, amount: number) {
    const response = await request(httpServer)
      .post(`/api/wallets/${walletId}/fund`)
      .set('x-api-key', apiKey)
      .send({
        amount,
        currency: 'USD',
      })
      .expect(201);
    return response.body;
  }

  async function listLedger(walletId: string) {
    const response = await request(httpServer)
      .get(`/api/wallets/${walletId}/ledger`)
      .set('x-api-key', apiKey)
      .expect(200);
    return response.body as Array<{
      transferId: string;
      type: LedgerEntryType;
      amount: number;
    }>;
  }

  async function expectLedgerEntry(
    walletId: string,
    transferId: string,
    type: LedgerEntryType,
    amount: number,
  ) {
    const ledger = await listLedger(walletId);
    expect(ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId,
          transferId,
          type,
          amount,
        }),
      ]),
    );
  }

  async function expectBalance(walletId: string, expectedBalance: number) {
    const balance = await request(httpServer)
      .get(`/api/wallets/${walletId}/balance`)
      .set('x-api-key', apiKey)
      .expect(200);
    expect(balance.body.balance).toBe(expectedBalance);
  }

  async function cleanDatabase() {
    await prisma.idempotencyKey.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.transfer.deleteMany();
    await prisma.webhookEndpoint.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.financialAccount.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.capitalProgram.deleteMany();
    await prisma.partner.deleteMany();
  }

  function uniqueEmail(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  }
});
