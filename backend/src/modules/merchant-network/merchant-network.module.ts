import {
  FinancingAdminController,
  FinancingPortalController,
} from './financing-review.controller';
import { FinancingReviewService } from './financing-review.service';
import { PilotAccessGuard } from './pilot-access.guard';
import { Module } from '@nestjs/common';
import { MerchantNetworkController } from './merchant-network.controller';
import { MerchantNetworkService } from './merchant-network.service';
import { MerchantOperatorGuard } from './operator.guard';
@Module({
  controllers: [
    MerchantNetworkController,
    FinancingAdminController,
    FinancingPortalController,
  ],
  providers: [
    MerchantNetworkService,
    MerchantOperatorGuard,
    FinancingReviewService,
    PilotAccessGuard,
  ],
})
export class MerchantNetworkModule {}
