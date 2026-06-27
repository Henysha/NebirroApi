import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { CapitalProgramsModule } from './modules/capital-programs/capital-programs.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PrismaModule } from './prisma/prisma.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    PartnersModule,
    ApiKeysModule,
    CustomersModule,
    WalletsModule,
    TransfersModule,
    CapitalProgramsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
