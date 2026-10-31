import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PilotRole } from '@prisma/client';
import { createHash } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
export const hashPilotToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export type PilotIdentity = {
  id: string;
  version: number;
  partnerId: string;
  role: PilotRole;
  merchantId: string | null;
  lenderId: string | null;
};
export interface PilotRequest extends Request {
  pilot: PilotIdentity;
}
@Injectable()
export class PilotAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<PilotRequest>();
    const authorization = req.header('authorization') ?? '';
    if (!/^Bearer nb_pilot_[a-f0-9]{64}$/.test(authorization))
      throw new UnauthorizedException('Valid pilot access credential required');
    const access = await this.prisma.pilotAccess.findFirst({
      where: {
        tokenHash: hashPilotToken(authorization.slice(7)),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        version: true,
        partnerId: true,
        role: true,
        merchantId: true,
        lenderId: true,
      },
    });
    if (
      !access ||
      (access.role === 'MERCHANT'
        ? !access.merchantId || access.lenderId
        : !access.lenderId || access.merchantId)
    )
      throw new UnauthorizedException('Pilot access expired or revoked');
    req.pilot = access;
    return true;
  }
}
