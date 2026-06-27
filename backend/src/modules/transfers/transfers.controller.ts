import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, MinLength } from 'class-validator';
import { PartnerId } from '../../common/auth/partner.decorator';
import { PartnerApiKeyGuard } from '../../common/auth/partner-api-key.guard';
import { TransfersService } from './transfers.service';

class CreateTransferRequest {
  @ApiProperty({ required: false, description: 'Required for wallet-to-wallet transfers.' })
  @IsOptional()
  @IsString()
  sourceWalletId?: string;

  @ApiProperty()
  @IsString()
  destinationWalletId!: string;

  @ApiProperty({ example: 2500, description: 'Amount in the smallest currency unit.' })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}

@ApiTags('Transfers')
@ApiSecurity('api-key')
@UseGuards(PartnerApiKeyGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  create(
    @PartnerId() partnerId: string,
    @Body() body: CreateTransferRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transfersService.create(partnerId, body, idempotencyKey);
  }

  @Get()
  findAll(@PartnerId() partnerId: string) {
    return this.transfersService.findAll(partnerId);
  }

  @Get(':id')
  findOne(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.transfersService.findOne(partnerId, id);
  }
}
