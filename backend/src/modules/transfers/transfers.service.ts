import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  Prisma,
  TransferStatus,
  TransferType,
  WebhookEventType,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateTransferDto {
  sourceWalletId?: string;
  destinationWalletId: string;
  amount: number;
  currency: string;
  description?: string;
  type?: TransferType;
}

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(partnerId: string, data: CreateTransferDto, idempotencyKey?: string) {
    const transferType =
      data.type ?? (data.sourceWalletId ? TransferType.WALLET_TRANSFER : TransferType.FUND_WALLET);
    const normalizedData = {
      sourceWalletId: data.sourceWalletId,
      destinationWalletId: data.destinationWalletId,
      amount: data.amount,
      currency: data.currency.toUpperCase(),
      description: data.description,
      type: transferType,
    };

    if (data.amount <= 0) {
      throw new BadRequestException('Transfer amount must be positive');
    }

    if (transferType === TransferType.WALLET_TRANSFER && !data.sourceWalletId) {
      throw new BadRequestException('Wallet transfers require a source wallet');
    }

    const requestHash = this.hashRequest(normalizedData);

    if (idempotencyKey) {
      const stored = await this.prisma.idempotencyKey.findUnique({
        where: { partnerId_key: { partnerId, key: idempotencyKey } },
      });

      if (stored) {
        if (stored.requestHash !== requestHash) {
          throw new ConflictException('Idempotency key reused with a different request');
        }

        return stored.responseBody;
      }
    }

    const transfer = await this.prisma.$transaction(async (tx) => {
      const destinationWallet = await tx.wallet.findFirst({
        where: { id: normalizedData.destinationWalletId, partnerId },
      });

      if (!destinationWallet) {
        throw new NotFoundException('Destination wallet not found');
      }

      const currency = normalizedData.currency;

      if (destinationWallet.currency !== currency) {
        throw new BadRequestException('Destination wallet currency mismatch');
      }

      if (normalizedData.sourceWalletId) {
        const sourceWallet = await tx.wallet.findFirst({
          where: { id: normalizedData.sourceWalletId, partnerId },
        });

        if (!sourceWallet) {
          throw new NotFoundException('Source wallet not found');
        }

        if (sourceWallet.currency !== currency) {
          throw new BadRequestException('Source wallet currency mismatch');
        }

        const sourceBalance = await this.getWalletBalance(tx, partnerId, sourceWallet.id);
        if (sourceBalance < normalizedData.amount) {
          throw new BadRequestException('Insufficient funds');
        }
      }

      const createdTransfer = await tx.transfer.create({
        data: {
          partnerId,
          sourceWalletId: normalizedData.sourceWalletId,
          destinationWalletId: normalizedData.destinationWalletId,
          type: transferType,
          amount: normalizedData.amount,
          currency,
          description: normalizedData.description,
          status: TransferStatus.COMPLETED,
        },
      });

      if (normalizedData.sourceWalletId) {
        await tx.ledgerEntry.create({
          data: {
            partnerId,
            walletId: normalizedData.sourceWalletId,
            transferId: createdTransfer.id,
            type: LedgerEntryType.DEBIT,
            amount: normalizedData.amount,
            currency,
            description: normalizedData.description ?? 'Wallet transfer debit',
          },
        });
      }

      await tx.ledgerEntry.create({
        data: {
          partnerId,
          walletId: normalizedData.destinationWalletId,
          transferId: createdTransfer.id,
          type: LedgerEntryType.CREDIT,
          amount: normalizedData.amount,
          currency,
          description: normalizedData.sourceWalletId
            ? normalizedData.description ?? 'Wallet transfer credit'
            : 'Wallet funding',
        },
      });

      await tx.webhookEvent.create({
        data: {
          partnerId,
          transferId: createdTransfer.id,
          type:
            transferType === TransferType.FUND_WALLET
              ? WebhookEventType.WALLET_FUNDED
              : WebhookEventType.TRANSFER_COMPLETED,
          payload: {
            transferId: createdTransfer.id,
            type: createdTransfer.type,
            amount: createdTransfer.amount,
            currency: createdTransfer.currency,
            sourceWalletId: createdTransfer.sourceWalletId,
            destinationWalletId: createdTransfer.destinationWalletId,
            status: createdTransfer.status,
          },
        },
      });

      return createdTransfer;
    });

    if (idempotencyKey) {
      await this.prisma.idempotencyKey.create({
        data: {
          partnerId,
          key: idempotencyKey,
          requestHash,
          responseStatus: 201,
          responseBody: this.toJson(transfer),
        },
      });
    }

    return transfer;
  }

  fundWallet(
    partnerId: string,
    walletId: string,
    data: Omit<CreateTransferDto, 'destinationWalletId' | 'sourceWalletId' | 'type'>,
    idempotencyKey?: string,
  ) {
    return this.create(
      partnerId,
      {
        destinationWalletId: walletId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        type: TransferType.FUND_WALLET,
      },
      idempotencyKey,
    );
  }

  findAll(partnerId: string) {
    return this.prisma.transfer.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(partnerId: string, id: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, partnerId },
      include: {
        ledgerEntries: true,
        webhookEvents: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  private async getWalletBalance(
    tx: Prisma.TransactionClient,
    partnerId: string,
    walletId: string,
  ) {
    const entries = await tx.ledgerEntry.findMany({
      where: { partnerId, walletId },
      select: { type: true, amount: true },
    });

    return entries.reduce((total, entry) => {
      return entry.type === LedgerEntryType.CREDIT ? total + entry.amount : total - entry.amount;
    }, 0);
  }

  private hashRequest(data: CreateTransferDto) {
    return createHash('sha256').update(this.stableStringify(data)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
      .join(',')}}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
