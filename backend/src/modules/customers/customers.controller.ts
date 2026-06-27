import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { PartnerId } from '../../common/auth/partner.decorator';
import { PartnerApiKeyGuard } from '../../common/auth/partner-api-key.guard';
import { CustomersService } from './customers.service';

class CreateCustomerRequest {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Aster Holdings' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false, example: { segment: 'operator' } })
  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonObject;
}

@ApiTags('Customers')
@ApiSecurity('api-key')
@UseGuards(PartnerApiKeyGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@PartnerId() partnerId: string, @Body() body: CreateCustomerRequest) {
    return this.customersService.create(partnerId, body);
  }

  @Get()
  findAll(@PartnerId() partnerId: string) {
    return this.customersService.findAll(partnerId);
  }

  @Get(':id')
  findOne(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.customersService.findOne(partnerId, id);
  }
}
