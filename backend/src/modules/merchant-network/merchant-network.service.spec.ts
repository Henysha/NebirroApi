import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MerchantNetworkService } from './merchant-network.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Merchant trade rules', () => {
  const tx = {
    tradeAgreement: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    offer: { findFirst: jest.fn(), updateMany: jest.fn() },
    merchant: { findFirst: jest.fn() },
    tradeAttestation: { create: jest.fn() },
    financingRequest: { create: jest.fn() },
  };
  const service = new MerchantNetworkService({
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService);
  const body = {
    offerId: 'offer',
    buyerId: 'buyer',
    quantityKg: 10,
    requestKey: 'request-1',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    tx.tradeAgreement.findUnique.mockResolvedValue(null);
    tx.offer.findFirst.mockResolvedValue({
      id: 'offer',
      merchantId: 'supplier',
      pricePerKgMinor: 5000,
    });
    tx.merchant.findFirst.mockResolvedValue({ id: 'buyer' });
    tx.offer.updateMany.mockResolvedValue({ count: 1 });
  });
  it('does not reserve stock again on a matching retry', async () => {
    tx.tradeAgreement.findUnique.mockResolvedValue({ id: 'trade', ...body });
    expect(await service.agree('partner', 'actor', body)).toMatchObject({
      id: 'trade',
    });
    expect(tx.offer.updateMany).not.toHaveBeenCalled();
    await expect(
      service.agree('partner', 'actor', { ...body, quantityKg: 11 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('refuses missing scoped records, self trade and overflow', async () => {
    tx.offer.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.agree('partner', 'actor', body),
    ).rejects.toBeInstanceOf(NotFoundException);
    tx.merchant.findFirst.mockResolvedValueOnce({ id: 'supplier' });
    await expect(
      service.agree('partner', 'actor', body),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.agree('partner', 'actor', { ...body, quantityKg: 1000000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.offer.updateMany).not.toHaveBeenCalled();
  });
  it('requires stock reservation before creating an agreement', async () => {
    tx.offer.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.agree('partner', 'actor', body),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tradeAgreement.create).not.toHaveBeenCalled();
  });
  it('never records a payment event after an invalid state or mismatched amount', async () => {
    tx.tradeAgreement.findFirst.mockResolvedValue({
      id: 'trade',
      totalMinor: 50000,
    });
    const payment = {
      provider: 'BANK',
      reference: 'REF-123',
      amountMinor: 1,
      evidence: 'Statement',
    };
    await expect(
      service.verifyPayment('partner', 'actor', 'trade', payment),
    ).rejects.toBeInstanceOf(BadRequestException);
    tx.tradeAgreement.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.verifyPayment('partner', 'actor', 'trade', {
        ...payment,
        amountMinor: 50000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tradeAttestation.create).not.toHaveBeenCalled();
  });
});
