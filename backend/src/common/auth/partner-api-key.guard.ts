import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedPartnerRequest extends Request {
  partnerId: string;
}

@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedPartnerRequest>();
    const apiKey = request.header('x-api-key');

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const keyHash = createHash('sha256')
      .update(`${apiKey}:${process.env.API_KEY_PEPPER ?? ''}`)
      .digest('hex');

    const storedKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
      select: {
        id: true,
        partnerId: true,
      },
    });

    if (!storedKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.partnerId = storedKey.partnerId;
    await this.prisma.apiKey.update({
      where: { id: storedKey.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }
}
