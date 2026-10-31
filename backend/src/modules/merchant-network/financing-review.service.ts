import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPilotToken, PilotIdentity } from './pilot-access.guard';
import {
  GrantConsent,
  ReviewDecision,
  VerifySupplier,
} from './financing-review.dto';

// Explicit allowlist: raw payment/delivery evidence, key hashes and unrelated history never leave the operator workspace.
const applicationSelect = {
  id: true,
  amountMinor: true,
  currency: true,
  purpose: true,
  status: true,
  lenderId: true,
  consentedAt: true,
  consentRevokedAt: true,
  consentVersion: true,
  approvedAmountMinor: true,
  decisionReason: true,
  decidedAt: true,
  merchant: { select: { name: true, market: true } },
  lender: { select: { id: true, name: true } },
  trade: {
    select: {
      id: true,
      state: true,
      quantityKg: true,
      totalMinor: true,
      offer: {
        select: {
          commodity: true,
          merchant: {
            select: { name: true, market: true, supplierVerified: true },
          },
        },
      },
    },
  },
} satisfies Prisma.FinancingRequestSelect;

@Injectable()
export class FinancingReviewService {
  constructor(private readonly prisma: PrismaService) {}
  private role(actor: PilotIdentity, role: 'MERCHANT' | 'REVIEWER') {
    if (actor.role !== role)
      throw new ForbiddenException(
        'This action is not available for your role',
      );
  }
  private async activeCredential(
    tx: Prisma.TransactionClient,
    actor: PilotIdentity,
  ) {
    const active = await tx.pilotAccess.updateMany({
      where: {
        id: actor.id,
        version: actor.version,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { version: actor.version },
    });
    if (!active.count)
      throw new UnauthorizedException('Pilot access expired or revoked');
  }
  private actorId(actor: PilotIdentity) {
    return `${actor.id}:v${actor.version}`;
  }

  async issue(
    partnerId: string,
    issuedBy: string,
    role: 'MERCHANT' | 'REVIEWER',
    subjectId: string,
  ) {
    const subject =
      role === 'MERCHANT'
        ? await this.prisma.merchant.findFirst({
            where: { id: subjectId, partnerId },
          })
        : await this.prisma.pilotLender.findFirst({
            where: { id: subjectId, partnerId },
          });
    if (!subject) throw new NotFoundException('Subject not found');
    const token = `nb_pilot_${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const fields = {
      tokenHash: hashPilotToken(token),
      expiresAt,
      revokedAt: null,
      issuedBy,
    };
    const access = await this.prisma.pilotAccess.upsert({
      where:
        role === 'MERCHANT'
          ? { merchantId: subjectId }
          : { lenderId: subjectId },
      create: {
        ...fields,
        partnerId,
        role,
        ...(role === 'MERCHANT'
          ? { merchantId: subjectId }
          : { lenderId: subjectId }),
      },
      update: { ...fields, version: { increment: 1 } },
      select: { id: true, role: true, version: true, expiresAt: true },
    });
    return { ...access, token }; // Plaintext returned only by this operator-protected issuance endpoint.
  }
  async revokeAccess(partnerId: string, id: string) {
    const result = await this.prisma.pilotAccess.updateMany({
      where: { id, partnerId },
      data: { revokedAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Access credential not found');
    return { revoked: true };
  }
  operatorAccess(partnerId: string) {
    return this.prisma.pilotAccess.findMany({
      where: { partnerId },
      select: {
        id: true,
        role: true,
        merchantId: true,
        lenderId: true,
        version: true,
        expiresAt: true,
        revokedAt: true,
      },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
  }
  lenders(partnerId: string) {
    return this.prisma.pilotLender.findMany({
      where: { partnerId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  createLender(partnerId: string, name: string) {
    return this.prisma.pilotLender.create({
      data: { partnerId, name: name.trim() },
      select: { id: true, name: true },
    });
  }
  verifySupplier(
    partnerId: string,
    actorKeyId: string,
    id: string,
    body: VerifySupplier,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.merchant.updateMany({
        where: { id, partnerId },
        data: {
          supplierVerified: body.verified,
          supplierVerifiedAt: body.verified ? new Date() : null,
        },
      });
      if (!changed.count) throw new NotFoundException('Merchant not found');
      return tx.supplierVerification.create({
        data: {
          merchantId: id,
          verified: body.verified,
          evidence: body.evidence.trim(),
          actorKeyId,
        },
      });
    });
  }
  async workspace(actor: PilotIdentity) {
    const where: Prisma.FinancingRequestWhereInput = {
      partnerId: actor.partnerId,
      ...(actor.role === 'MERCHANT'
        ? { merchantId: actor.merchantId! }
        : {
            lenderId: actor.lenderId!,
            consentedAt: { not: null },
            consentRevokedAt: null,
            consentVersion: 'application-v1',
          }),
    };
    const [applications, lenders] = await Promise.all([
      this.prisma.financingRequest.findMany({
        where,
        select: applicationSelect,
        take: 200,
        orderBy: { createdAt: 'desc' },
      }),
      actor.role === 'MERCHANT'
        ? this.lenders(actor.partnerId)
        : Promise.resolve([]),
    ]);
    return { role: actor.role, applications, lenders };
  }
  // Every consent/review mutation locks the same application row before reading it.
  // This serializes withdrawal against decisions; a revoked consent cannot be used by a later decision.
  private async locked(
    tx: Prisma.TransactionClient,
    actor: PilotIdentity,
    id: string,
    merchantOnly: boolean,
  ) {
    const where = {
      id,
      partnerId: actor.partnerId,
      ...(merchantOnly
        ? { merchantId: actor.merchantId! }
        : { lenderId: actor.lenderId! }),
    };
    const locked = await tx.financingRequest.updateMany({
      where,
      data: { currency: 'ETB' },
    });
    if (!locked.count) throw new NotFoundException('Application not found');
    return tx.financingRequest.findUniqueOrThrow({
      where: { id },
      include: { trade: { include: { offer: true } } },
    });
  }
  consent(actor: PilotIdentity, id: string, body: GrantConsent) {
    this.role(actor, 'MERCHANT');
    return this.prisma.$transaction(async (tx) => {
      await this.activeCredential(tx, actor);
      const app = await this.locked(tx, actor, id, true);
      if (
        app.status !== 'SUBMITTED' ||
        (app.consentedAt && !app.consentRevokedAt)
      )
        throw new ConflictException(
          'Withdraw existing consent before choosing a reviewer; decided applications cannot be resubmitted',
        );
      const eligibleTrade = await tx.tradeAgreement.updateMany({
        where: { id: app.tradeId, partnerId: actor.partnerId, state: 'AGREED' },
        data: { state: 'AGREED' },
      });
      if (!eligibleTrade.count)
        throw new ConflictException(
          'Only undelivered purchases can enter financing review',
        );
      if (
        !(await tx.pilotLender.findFirst({
          where: { id: body.lenderId, partnerId: actor.partnerId },
        }))
      )
        throw new NotFoundException('Lender not found');
      await tx.financingRequest.update({
        where: { id },
        data: {
          lenderId: body.lenderId,
          consentedAt: new Date(),
          consentRevokedAt: null,
          consentVersion: 'application-v1',
        },
      });
      await tx.financingReviewEvent.create({
        data: {
          requestId: id,
          kind: 'CONSENT_GRANTED',
          actorId: this.actorId(actor),
          lenderId: body.lenderId,
          detail:
            'application-v1: application, merchant name/market, supplier name/market/verification, linked purchase summary',
        },
      });
      return { shared: true };
    });
  }
  withdraw(actor: PilotIdentity, id: string) {
    this.role(actor, 'MERCHANT');
    return this.prisma.$transaction(async (tx) => {
      await this.activeCredential(tx, actor);
      const app = await this.locked(tx, actor, id, true);
      if (!app.consentedAt || app.consentRevokedAt) return { shared: false };
      await tx.financingRequest.update({
        where: { id },
        data: {
          consentRevokedAt: new Date(),
          ...(app.status === 'UNDER_REVIEW' ? { status: 'SUBMITTED' } : {}),
        },
      });
      await tx.financingReviewEvent.create({
        data: {
          requestId: id,
          kind: 'CONSENT_WITHDRAWN',
          actorId: this.actorId(actor),
          lenderId: app.lenderId,
          detail:
            'Further reviewer access disabled; existing decision/audit records retained',
        },
      });
      return { shared: false };
    });
  }
  review(actor: PilotIdentity, id: string, decision?: ReviewDecision) {
    this.role(actor, 'REVIEWER');
    return this.prisma.$transaction(async (tx) => {
      await this.activeCredential(tx, actor);
      const app = await this.locked(tx, actor, id, false);
      if (
        !app.consentedAt ||
        app.consentRevokedAt ||
        app.consentVersion !== 'application-v1'
      )
        throw new NotFoundException('Application not shared');
      if (app.status !== (decision ? 'UNDER_REVIEW' : 'SUBMITTED'))
        throw new ConflictException(
          'Application is not in the required review state',
        );
      // Lock the linked trade against delivery; approval cannot race delivery into an ineligible purchase.
      const trade = await tx.tradeAgreement.updateMany({
        where: { id: app.tradeId, partnerId: actor.partnerId, state: 'AGREED' },
        data: { state: 'AGREED' },
      });
      if (!trade.count)
        throw new ConflictException('This purchase has already been delivered');
      // Declines are permitted if verification has been withdrawn, but review/approval require it.
      if (!decision || decision.decision === 'APPROVED') {
        const supplier = await tx.merchant.updateMany({
          where: {
            id: app.trade.offer.merchantId,
            partnerId: actor.partnerId,
            supplierVerified: true,
          },
          data: { supplierVerified: true },
        });
        if (!supplier.count)
          throw new ConflictException(
            'Supplier must be verified before review or approval',
          );
      }
      if (
        decision?.decision === 'APPROVED' &&
        (!decision.approvedAmountMinor ||
          decision.approvedAmountMinor > app.amountMinor ||
          decision.approvedAmountMinor > app.trade.totalMinor)
      )
        throw new BadRequestException(
          'Approved amount must be positive and within the application and purchase totals',
        );
      if (
        decision?.decision === 'DECLINED' &&
        decision.approvedAmountMinor !== undefined
      )
        throw new BadRequestException(
          'A declined request cannot contain an approved amount',
        );
      const status = decision?.decision ?? 'UNDER_REVIEW';
      await tx.financingRequest.update({
        where: { id },
        data: {
          status,
          ...(decision
            ? {
                decisionReason: decision.reason.trim(),
                decidedAt: new Date(),
                approvedAmountMinor:
                  decision.decision === 'APPROVED'
                    ? decision.approvedAmountMinor
                    : null,
              }
            : {}),
        },
      });
      await tx.financingReviewEvent.create({
        data: {
          requestId: id,
          kind: status,
          actorId: this.actorId(actor),
          lenderId: actor.lenderId,
          detail: decision?.reason.trim() ?? 'Reviewer began manual assessment',
        },
      });
      return { status }; // No loan account, ledger movement or disbursement is created.
    });
  }
}
