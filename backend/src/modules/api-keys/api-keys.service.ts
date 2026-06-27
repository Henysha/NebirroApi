import { Injectable } from '@nestjs/common';
import { ApiKeyStatus } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateApiKeyDto {
  name: string;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(partnerId: string, data: CreateApiKeyDto) {
    const key = `nb_test_${randomBytes(24).toString('hex')}`;
    const keyHash = this.hashKey(key);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        partnerId,
        name: data.name,
        keyHash,
        keyPrefix: key.slice(0, 14),
        status: ApiKeyStatus.ACTIVE,
      },
    });

    return {
      ...apiKey,
      keyHash: undefined,
      key,
    };
  }

  findAll(partnerId: string) {
    return this.prisma.apiKey.findMany({
      where: { partnerId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private hashKey(key: string) {
    return createHash('sha256')
      .update(`${key}:${process.env.API_KEY_PEPPER ?? ''}`)
      .digest('hex');
  }
}
