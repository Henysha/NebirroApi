import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AgreeTrade,
  CreateMerchant,
  CreateOffer,
  DeliveryEvidence,
  PaymentEvidence,
  RequestFinancing,
} from './merchant-network.dto';

@Injectable()
export class MerchantNetworkService {
  constructor(private readonly prisma: PrismaService) {}

  snapshot(partnerId: string) {
    return this.prisma.$transaction(async (tx) => ({
      merchants: await tx.merchant.findMany({
        include: {
          verifications: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      offers: await tx.offer.findMany({
        where: { partnerId },
        include: { merchant: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      trades: await tx.tradeAgreement.findMany({
        where: { partnerId },
        include: {
          buyer: true,
          offer: { include: { merchant: true } },
          events: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      financingRequests: await tx.financingRequest.findMany({
        include: { reviewEvents: { orderBy: { sequence: 'asc' } } },
        where: { partnerId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    }));
  }

  createMerchant(partnerId: string, body: CreateMerchant) {
    return this.prisma.merchant.create({
      data: { partnerId, name: body.name.trim(), market: body.market.trim() },
    });
  }

  async createOffer(partnerId: string, body: CreateOffer) {
    if (
      !(await this.prisma.merchant.findFirst({
        where: { id: body.merchantId, partnerId },
      }))
    )
      throw new NotFoundException('Merchant not found');
    return this.prisma.offer.create({
      data: { ...body, commodity: body.commodity.trim(), partnerId },
    });
  }

  // Transactions plus conditional writes protect stock and workflow transitions.
  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Duplicate reference or concurrent update. Refresh and retry.',
        );
      }
      throw error;
    }
  }

  agree(partnerId: string, actorKeyId: string, body: AgreeTrade) {
    return this.transaction(async (tx) => {
      const existing = await tx.tradeAgreement.findUnique({
        where: {
          partnerId_requestKey: { partnerId, requestKey: body.requestKey },
        },
      });
      if (existing) {
        if (
          existing.offerId !== body.offerId ||
          existing.buyerId !== body.buyerId ||
          existing.quantityKg !== body.quantityKg
        )
          throw new ConflictException(
            'Request key already used for a different agreement',
          );
        return existing;
      }
      const offer = await tx.offer.findFirst({
        where: { id: body.offerId, partnerId },
      });
      const buyer = await tx.merchant.findFirst({
        where: { id: body.buyerId, partnerId },
      });
      if (!offer || !buyer)
        throw new NotFoundException('Offer or buyer not found');
      if (offer.merchantId === buyer.id)
        throw new BadRequestException('Buyer and seller must differ');
      const totalMinor = body.quantityKg * offer.pricePerKgMinor;
      if (totalMinor > 2147483647)
        throw new BadRequestException('Trade total exceeds pilot limit');
      const reserved = await tx.offer.updateMany({
        where: {
          id: offer.id,
          partnerId,
          availableKg: { gte: body.quantityKg },
        },
        data: { availableKg: { decrement: body.quantityKg } },
      });
      if (!reserved.count)
        throw new ConflictException('Insufficient available quantity');
      return tx.tradeAgreement.create({
        data: {
          ...body,
          partnerId,
          pricePerKgMinor: offer.pricePerKgMinor,
          totalMinor,
          events: {
            create: {
              kind: 'AGREED',
              actorKeyId,
              evidence: 'Operator recorded buyer and seller agreement',
            },
          },
        },
      });
    });
  }

  deliver(
    partnerId: string,
    actorKeyId: string,
    id: string,
    body: DeliveryEvidence,
  ) {
    return this.transaction(async (tx) => {
      if (!(await tx.tradeAgreement.findFirst({ where: { id, partnerId } })))
        throw new NotFoundException('Trade not found');
      const result = await tx.tradeAgreement.updateMany({
        where: { id, partnerId, state: 'AGREED' },
        data: {
          state: 'DELIVERED',
          deliveryEvidence: body.evidence.trim(),
          deliveredAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException('Only agreed trades can be delivered');
      await tx.tradeAttestation.create({
        data: {
          tradeId: id,
          kind: 'DELIVERED',
          actorKeyId,
          evidence: body.evidence.trim(),
        },
      });
      return tx.tradeAgreement.findUniqueOrThrow({ where: { id } });
    });
  }

  verifyPayment(
    partnerId: string,
    actorKeyId: string,
    id: string,
    body: PaymentEvidence,
  ) {
    return this.transaction(async (tx) => {
      const trade = await tx.tradeAgreement.findFirst({
        where: { id, partnerId },
      });
      if (!trade) throw new NotFoundException('Trade not found');
      if (body.amountMinor !== trade.totalMinor)
        throw new BadRequestException(
          'Verified ETB amount must match the full trade total',
        );
      const result = await tx.tradeAgreement.updateMany({
        where: { id, partnerId, state: 'DELIVERED' },
        data: {
          state: 'COMPLETED',
          paymentProvider: body.provider,
          paymentReference: body.reference,
          paymentEvidence: body.evidence.trim(),
          verifiedAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException(
          'Confirm delivery before verifying payment; completed records are immutable',
        );
      await tx.tradeAttestation.create({
        data: {
          tradeId: id,
          kind: 'PAYMENT_MANUALLY_VERIFIED',
          actorKeyId,
          evidence: body.evidence.trim(),
        },
      });
      return tx.tradeAgreement.findUniqueOrThrow({ where: { id } });
    });
  }

  requestFinancing(partnerId: string, body: RequestFinancing) {
    return this.transaction(async (tx) => {
      const trade = await tx.tradeAgreement.findFirst({
        where: { id: body.tradeId, partnerId },
      });
      if (!trade) throw new NotFoundException('Trade not found');
      if (trade.state !== 'AGREED')
        throw new ConflictException(
          'Inventory financing must be requested before delivery',
        );
      if (body.amountMinor > trade.totalMinor)
        throw new BadRequestException(
          'Request exceeds the supplier purchase total',
        );
      if (
        await tx.financingRequest.findUnique({ where: { tradeId: trade.id } })
      ) {
        throw new ConflictException(
          'This purchase already has a financing application',
        );
      }
      // Lock the trade against a concurrent delivery before inserting its application.
      const locked = await tx.tradeAgreement.updateMany({
        where: { id: trade.id, partnerId, state: 'AGREED' },
        data: { state: 'AGREED' },
      });
      if (!locked.count)
        throw new ConflictException('Trade changed; refresh before applying');
      return tx.financingRequest.create({
        data: {
          ...body,
          purpose: body.purpose.trim(),
          partnerId,
          merchantId: trade.buyerId,
        },
      });
    });
  }
}
