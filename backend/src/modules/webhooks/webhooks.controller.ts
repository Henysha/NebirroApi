import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';
import { PartnerId } from '../../common/auth/partner.decorator';
import { PartnerApiKeyGuard } from '../../common/auth/partner-api-key.guard';
import { WebhooksService } from './webhooks.service';

class CreateWebhookEndpointRequest {
  @ApiProperty({ example: 'https://example.com/webhooks/nebirro' })
  @IsUrl({ require_tld: false })
  url!: string;
}

@ApiTags('Webhooks')
@ApiSecurity('api-key')
@UseGuards(PartnerApiKeyGuard)
@Controller()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('webhook-endpoints')
  createEndpoint(@PartnerId() partnerId: string, @Body() body: CreateWebhookEndpointRequest) {
    return this.webhooksService.createEndpoint(partnerId, body);
  }

  @Get('webhook-endpoints')
  listEndpoints(@PartnerId() partnerId: string) {
    return this.webhooksService.listEndpoints(partnerId);
  }

  @Get('webhook-events')
  listEvents(@PartnerId() partnerId: string) {
    return this.webhooksService.listEvents(partnerId);
  }

  @Post('webhook-events/:id/retry')
  retryEvent(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.webhooksService.retryEvent(partnerId, id);
  }
}
