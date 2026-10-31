import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PartnerId } from '../../common/auth/partner.decorator';
import {
  AuthenticatedPartnerRequest,
  PartnerApiKeyGuard,
} from '../../common/auth/partner-api-key.guard';
import { MerchantOperatorGuard } from './operator.guard';
import { MerchantNetworkService } from './merchant-network.service';
import {
  AgreeTrade,
  CreateMerchant,
  CreateOffer,
  DeliveryEvidence,
  PaymentEvidence,
  RequestFinancing,
} from './merchant-network.dto';

@ApiTags('Merchant network (assisted pilot)')
@ApiSecurity('api-key')
@ApiSecurity('merchant-operator')
@UseGuards(MerchantOperatorGuard, PartnerApiKeyGuard)
@Controller('merchant-network')
export class MerchantNetworkController {
  constructor(private readonly service: MerchantNetworkService) {}
  @Get() snapshot(@PartnerId() p: string) {
    return this.service.snapshot(p);
  }
  @Post('merchants') merchant(
    @PartnerId() p: string,
    @Body() b: CreateMerchant,
  ) {
    return this.service.createMerchant(p, b);
  }
  @Post('offers') offer(@PartnerId() p: string, @Body() b: CreateOffer) {
    return this.service.createOffer(p, b);
  }
  @Post('trades') agree(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Body() b: AgreeTrade,
  ) {
    return this.service.agree(p, r.actorKeyId, b);
  }
  @Post('trades/:id/delivery') deliver(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Param('id') id: string,
    @Body() b: DeliveryEvidence,
  ) {
    return this.service.deliver(p, r.actorKeyId, id, b);
  }
  @Post('trades/:id/payment-verification') payment(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Param('id') id: string,
    @Body() b: PaymentEvidence,
  ) {
    return this.service.verifyPayment(p, r.actorKeyId, id, b);
  }
  @Post('financing-requests') financing(
    @PartnerId() p: string,
    @Body() b: RequestFinancing,
  ) {
    return this.service.requestFinancing(p, b);
  }
}
