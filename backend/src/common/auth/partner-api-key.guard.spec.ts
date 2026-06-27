import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { PartnerApiKeyGuard } from './partner-api-key.guard';

function createExecutionContext(request: { header: jest.Mock; partnerId?: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('PartnerApiKeyGuard', () => {
  beforeEach(() => {
    process.env.API_KEY_PEPPER = 'test-pepper';
  });

  it('authenticates active hashed API keys for protected endpoints', async () => {
    const plaintextKey = 'nb_test_valid';
    const keyHash = createHash('sha256')
      .update(`${plaintextKey}:${process.env.API_KEY_PEPPER}`)
      .digest('hex');
    const prisma = {
      apiKey: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'api-key-1',
          partnerId: 'partner-1',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const guard = new PartnerApiKeyGuard(prisma as any);
    const request = {
      header: jest.fn().mockReturnValue(plaintextKey),
    };

    await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true);
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: {
        keyHash,
        status: ApiKeyStatus.ACTIVE,
      },
      select: {
        id: true,
        partnerId: true,
      },
    });
    expect(request).toMatchObject({ partnerId: 'partner-1' });
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'api-key-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('rejects requests without an API key', async () => {
    const prisma = {
      apiKey: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const guard = new PartnerApiKeyGuard(prisma as any);
    const request = {
      header: jest.fn().mockReturnValue(undefined),
    };

    await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.apiKey.findFirst).not.toHaveBeenCalled();
  });
});
