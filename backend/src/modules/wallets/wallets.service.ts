import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateWalletDto {
  customerId?: string;
  financialAccountId?: string;
  name: string;
  currency: string;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  create(partnerId: string, data: CreateWalletDto) {
    return this.prisma.wallet.create({
      data: {
        partnerId,
        customerId: data.customerId,
        financialAccountId: data.financialAccountId,
        name: data.name,
        currency: data.currency.toUpperCase(),
      },
    });
  }

  findAll(partnerId: string) {
    return this.prisma.wallet.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(partnerId: string, id: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id, partnerId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  async getBalance(partnerId: string, walletId: string) {
    const wallet = await this.findOne(partnerId, walletId);
    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { partnerId, walletId },
      select: { type: true, amount: true },
    });

    const balance = ledgerEntries.reduce((total, entry) => {
      return entry.type === LedgerEntryType.CREDIT ? total + entry.amount : total - entry.amount;
    }, 0);

    return {
      walletId,
      currency: wallet.currency,
      balance,
    };
  }

  async getLedger(partnerId: string, walletId: string) {
    await this.findOne(partnerId, walletId);
    return this.prisma.ledgerEntry.findMany({
      where: { partnerId, walletId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
