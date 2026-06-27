import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiKeysService } from './api-keys.service';

class CreateApiKeyRequest {
  @ApiProperty({ example: 'Production integration key' })
  @IsString()
  @MinLength(2)
  name!: string;
}

@ApiTags('API Keys')
@Controller('partners/:partnerId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@Param('partnerId') partnerId: string, @Body() body: CreateApiKeyRequest) {
    return this.apiKeysService.create(partnerId, body);
  }

  @Get()
  findAll(@Param('partnerId') partnerId: string) {
    return this.apiKeysService.findAll(partnerId);
  }
}
