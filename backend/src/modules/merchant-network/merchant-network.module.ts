import { Module } from '@nestjs/common';
import { MerchantNetworkController } from './merchant-network.controller';
import { MerchantNetworkService } from './merchant-network.service';
import { MerchantOperatorGuard } from './operator.guard';
@Module({
  controllers: [MerchantNetworkController],
  providers: [MerchantNetworkService, MerchantOperatorGuard],
})
export class MerchantNetworkModule {}
