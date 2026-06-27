import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateCapitalProgramDto {
  name: string;
  description?: string;
  currency: string;
}

@Injectable()
export class CapitalProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  create(partnerId: string, data: CreateCapitalProgramDto) {
    return this.prisma.capitalProgram.create({
      data: {
        partnerId,
        name: data.name,
        description: data.description,
        currency: data.currency.toUpperCase(),
      },
    });
  }

  findAll(partnerId: string) {
    return this.prisma.capitalProgram.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(partnerId: string, id: string) {
    const capitalProgram = await this.prisma.capitalProgram.findFirst({
      where: { id, partnerId },
    });

    if (!capitalProgram) {
      throw new NotFoundException('Capital program not found');
    }

    return capitalProgram;
  }
}
