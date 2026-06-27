import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { WebhookEventStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateWebhookEndpointDto {
  url: string;
}

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  createEndpoint(partnerId: string, data: CreateWebhookEndpointDto) {
    return this.prisma.webhookEndpoint.create({
      data: {
        partnerId,
        url: data.url,
        secret: `whsec_${randomBytes(24).toString('hex')}`,
      },
    });
  }

  listEndpoints(partnerId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listEvents(partnerId: string) {
    return this.prisma.webhookEvent.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retryEvent(partnerId: string, id: string) {
    const event = await this.prisma.webhookEvent.findFirst({
      where: { id, partnerId },
    });

    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        status: WebhookEventStatus.PENDING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
  }
}
