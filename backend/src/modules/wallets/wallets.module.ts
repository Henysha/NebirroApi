import { Module } from '@nestjs/common';
import { TransfersModule } from '../transfers/transfers.module';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [TransfersModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
