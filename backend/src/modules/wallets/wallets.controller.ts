import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, MinLength } from 'class-validator';
import { PartnerId } from '../../common/auth/partner.decorator';
import { PartnerApiKeyGuard } from '../../common/auth/partner-api-key.guard';
import { TransfersService } from '../transfers/transfers.service';
import { WalletsService } from './wallets.service';

class CreateWalletRequest {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  financialAccountId?: string;

  @ApiProperty({ example: 'Operating Wallet' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;
}

class FundWalletRequest {
  @ApiProperty({ example: 10000, description: 'Amount in the smallest currency unit.' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ required: false, example: 'Initial platform funding' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}

@ApiTags('Wallets')
@ApiSecurity('api-key')
@UseGuards(PartnerApiKeyGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transfersService: TransfersService,
  ) {}

  @Post()
  create(@PartnerId() partnerId: string, @Body() body: CreateWalletRequest) {
    return this.walletsService.create(partnerId, body);
  }

  @Get()
  findAll(@PartnerId() partnerId: string) {
    return this.walletsService.findAll(partnerId);
  }

  @Get(':id')
  findOne(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.walletsService.findOne(partnerId, id);
  }

  @Get(':id/balance')
  getBalance(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.walletsService.getBalance(partnerId, id);
  }

  @Get(':id/ledger')
  getLedger(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.walletsService.getLedger(partnerId, id);
  }

  @Post(':id/fund')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  fundWallet(
    @PartnerId() partnerId: string,
    @Param('id') id: string,
    @Body() body: FundWalletRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transfersService.fundWallet(partnerId, id, body, idempotencyKey);
  }
}
