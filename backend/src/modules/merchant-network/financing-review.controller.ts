import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedPartnerRequest,
  PartnerApiKeyGuard,
} from '../../common/auth/partner-api-key.guard';
import { PartnerId } from '../../common/auth/partner.decorator';
import { MerchantOperatorGuard } from './operator.guard';
import { PilotAccessGuard, PilotRequest } from './pilot-access.guard';
import { FinancingReviewService } from './financing-review.service';
import {
  CreateLender,
  GrantConsent,
  ReviewDecision,
  VerifySupplier,
} from './financing-review.dto';

@ApiTags('Pilot access administration')
@UseGuards(MerchantOperatorGuard, PartnerApiKeyGuard)
@Controller('merchant-network')
export class FinancingAdminController {
  constructor(private readonly service: FinancingReviewService) {}
  @Post('merchants/:id/access')
  @Header('Cache-Control', 'no-store')
  merchantAccess(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Param('id') id: string,
  ) {
    return this.service.issue(p, r.actorKeyId, 'MERCHANT', id);
  }
  @Post('lenders/:id/access')
  @Header('Cache-Control', 'no-store')
  lenderAccess(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Param('id') id: string,
  ) {
    return this.service.issue(p, r.actorKeyId, 'REVIEWER', id);
  }
  @Get('access') access(@PartnerId() p: string) {
    return this.service.operatorAccess(p);
  }
  @Post('access/:id/revoke') revoke(
    @PartnerId() p: string,
    @Param('id') id: string,
  ) {
    return this.service.revokeAccess(p, id);
  }
  @Get('lenders') lenders(@PartnerId() p: string) {
    return this.service.lenders(p);
  }
  @Post('lenders') lender(@PartnerId() p: string, @Body() body: CreateLender) {
    return this.service.createLender(p, body.name);
  }
  @Post('merchants/:id/verification') verify(
    @PartnerId() p: string,
    @Req() r: AuthenticatedPartnerRequest,
    @Param('id') id: string,
    @Body() body: VerifySupplier,
  ) {
    return this.service.verifySupplier(p, r.actorKeyId, id, body);
  }
}

@ApiTags('Merchant consent and lender review')
@ApiBearerAuth('pilot-access')
@UseGuards(PilotAccessGuard)
@Controller('pilot')
export class FinancingPortalController {
  constructor(private readonly service: FinancingReviewService) {}
  @Get('workspace')
  @Header('Cache-Control', 'no-store')
  workspace(@Req() r: PilotRequest) {
    return this.service.workspace(r.pilot);
  }
  @Post('applications/:id/consent') consent(
    @Req() r: PilotRequest,
    @Param('id') id: string,
    @Body() body: GrantConsent,
  ) {
    return this.service.consent(r.pilot, id, body);
  }
  @Post('applications/:id/withdraw') withdraw(
    @Req() r: PilotRequest,
    @Param('id') id: string,
  ) {
    return this.service.withdraw(r.pilot, id);
  }
  @Post('applications/:id/review') review(
    @Req() r: PilotRequest,
    @Param('id') id: string,
  ) {
    return this.service.review(r.pilot, id);
  }
  @Post('applications/:id/decision') decide(
    @Req() r: PilotRequest,
    @Param('id') id: string,
    @Body() body: ReviewDecision,
  ) {
    return this.service.review(r.pilot, id, body);
  }
}
