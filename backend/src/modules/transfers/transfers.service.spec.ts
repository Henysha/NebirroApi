import { BadRequestException } from '@nestjs/common';
import {
  LedgerEntryType,
  TransferStatus,
  TransferType,
  WebhookEventType,
} from '@prisma/client';
import { TransfersService } from './transfers.service';

function createPrismaMock() {
  const wallets = [
    { id: 'source-wallet', partnerId: 'partner-1', currency: 'USD' },
    { id: 'destination-wallet', partnerId: 'partner-1', currency: 'USD' },
  ];
  const ledgerEntries: any[] = [];
  const transfers: any[] = [];
  const webhookEvents: any[] = [];
  const idempotencyKeys: any[] = [];

  const tx = {
    wallet: {
      findFirst: jest.fn(({ where }) =>
        wallets.find((wallet) => wallet.id === where.id && wallet.partnerId === where.partnerId) ?? null,
      ),
    },
    ledgerEntry: {
      findMany: jest.fn(({ where }) =>
        ledgerEntries.filter(
          (entry) => entry.partnerId === where.partnerId && entry.walletId === where.walletId,
        ),
      ),
      create: jest.fn(({ data }) => {
        const entry = { id: `ledger-${ledgerEntries.length + 1}`, ...data };
        ledgerEntries.push(entry);
        return entry;
      }),
    },
    transfer: {
      create: jest.fn(({ data }) => {
        const transfer = {
          id: `transfer-${transfers.length + 1}`,
          ...data,
          status: data.status ?? TransferStatus.PENDING,
        };
        transfers.push(transfer);
        return transfer;
      }),
    },
    webhookEvent: {
      create: jest.fn(({ data }) => {
        const event = { id: `event-${webhookEvents.length + 1}`, ...data };
        webhookEvents.push(event);
        return event;
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    idempotencyKey: {
      findUnique: jest.fn(({ where }) =>
        idempotencyKeys.find(
          (record) =>
            record.partnerId === where.partnerId_key.partnerId &&
            record.key === where.partnerId_key.key,
        ) ?? null,
      ),
      create: jest.fn(({ data }) => {
        idempotencyKeys.push(data);
        return data;
      }),
    },
    transfer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  return {
    prisma,
    tx,
    ledgerEntries,
    transfers,
    webhookEvents,
    idempotencyKeys,
  };
}

describe('TransfersService', () => {
  it('wallet funding creates a CREDIT ledger entry', async () => {
    const { prisma, ledgerEntries } = createPrismaMock();
    const service = new TransfersService(prisma as any);

    await service.fundWallet('partner-1', 'destination-wallet', {
      amount: 10000,
      currency: 'USD',
    });

    expect(ledgerEntries).toMatchObject([
      {
        walletId: 'destination-wallet',
        type: LedgerEntryType.CREDIT,
        amount: 10000,
        currency: 'USD',
      },
    ]);
  });

  it('wallet-to-wallet transfer creates DEBIT and CREDIT entries', async () => {
    const { prisma, ledgerEntries } = createPrismaMock();
    ledgerEntries.push({
      id: 'seed-credit',
      partnerId: 'partner-1',
      walletId: 'source-wallet',
      type: LedgerEntryType.CREDIT,
      amount: 5000,
      currency: 'USD',
    });
    const service = new TransfersService(prisma as any);

    await service.create('partner-1', {
      sourceWalletId: 'source-wallet',
      destinationWalletId: 'destination-wallet',
      amount: 2500,
      currency: 'USD',
    });

    expect(ledgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: 'source-wallet',
          type: LedgerEntryType.DEBIT,
          amount: 2500,
        }),
        expect.objectContaining({
          walletId: 'destination-wallet',
          type: LedgerEntryType.CREDIT,
          amount: 2500,
        }),
      ]),
    );
  });

  it('insufficient funds blocks transfer creation', async () => {
    const { prisma, ledgerEntries, transfers } = createPrismaMock();
    ledgerEntries.push({
      id: 'seed-credit',
      partnerId: 'partner-1',
      walletId: 'source-wallet',
      type: LedgerEntryType.CREDIT,
      amount: 100,
      currency: 'USD',
    });
    const service = new TransfersService(prisma as any);

    await expect(
      service.create('partner-1', {
        sourceWalletId: 'source-wallet',
        destinationWalletId: 'destination-wallet',
        amount: 500,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transfers).toHaveLength(0);
  });

  it('idempotency key prevents duplicate transfer creation', async () => {
    const { prisma, transfers } = createPrismaMock();
    const service = new TransfersService(prisma as any);
    const request = {
      destinationWalletId: 'destination-wallet',
      amount: 1000,
      currency: 'USD',
    };

    const first = await service.create('partner-1', request, 'idem-1');
    const second = await service.create('partner-1', request, 'idem-1');

    expect(first).toMatchObject({ id: 'transfer-1' });
    expect(second).toMatchObject({ id: 'transfer-1' });
    expect(transfers).toHaveLength(1);
  });

  it('transfer creates a webhook event', async () => {
    const { prisma, webhookEvents } = createPrismaMock();
    const service = new TransfersService(prisma as any);

    await service.create('partner-1', {
      destinationWalletId: 'destination-wallet',
      amount: 1000,
      currency: 'USD',
      type: TransferType.FUND_WALLET,
    });

    expect(webhookEvents).toMatchObject([
      {
        partnerId: 'partner-1',
        transferId: 'transfer-1',
        type: WebhookEventType.WALLET_FUNDED,
      },
    ]);
  });
});
