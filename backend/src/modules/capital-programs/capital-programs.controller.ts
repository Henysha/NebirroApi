import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';
import { PartnerId } from '../../common/auth/partner.decorator';
import { PartnerApiKeyGuard } from '../../common/auth/partner-api-key.guard';
import { CapitalProgramsService } from './capital-programs.service';

class CreateCapitalProgramRequest {
  @ApiProperty({ example: 'Working Capital Advances' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;
}

@ApiTags('Capital Programs')
@ApiSecurity('api-key')
@UseGuards(PartnerApiKeyGuard)
@Controller('capital-programs')
export class CapitalProgramsController {
  constructor(private readonly capitalProgramsService: CapitalProgramsService) {}

  @Post()
  create(@PartnerId() partnerId: string, @Body() body: CreateCapitalProgramRequest) {
    return this.capitalProgramsService.create(partnerId, body);
  }

  @Get()
  findAll(@PartnerId() partnerId: string) {
    return this.capitalProgramsService.findAll(partnerId);
  }

  @Get(':id')
  findOne(@PartnerId() partnerId: string, @Param('id') id: string) {
    return this.capitalProgramsService.findOne(partnerId, id);
  }
}
