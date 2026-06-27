import { LedgerEntryType } from '@prisma/client';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  it('wallet balance is derived from ledger entries', async () => {
    const prisma = {
      wallet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          partnerId: 'partner-1',
          currency: 'USD',
        }),
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          { type: LedgerEntryType.CREDIT, amount: 5000 },
          { type: LedgerEntryType.DEBIT, amount: 1250 },
          { type: LedgerEntryType.CREDIT, amount: 750 },
        ]),
      },
    };
    const service = new WalletsService(prisma as any);

    await expect(service.getBalance('partner-1', 'wallet-1')).resolves.toEqual({
      walletId: 'wallet-1',
      currency: 'USD',
      balance: 4500,
    });
  });
});
