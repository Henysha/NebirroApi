import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreatePartnerDto {
  name: string;
  email: string;
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePartnerDto) {
    return this.prisma.partner.create({ data });
  }

  findAll() {
    return this.prisma.partner.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id } });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner;
  }
}
