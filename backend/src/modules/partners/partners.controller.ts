import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PartnersService } from './partners.service';

class CreatePartnerRequest {
  @ApiProperty({ example: 'Northstar Capital' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'ops@northstar.example' })
  @IsEmail()
  email!: string;
}

@ApiTags('Partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post()
  create(@Body() body: CreatePartnerRequest) {
    return this.partnersService.create(body);
  }

  @Get()
  findAll() {
    return this.partnersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }
}
