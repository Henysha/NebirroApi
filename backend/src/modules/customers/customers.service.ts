import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateCustomerDto {
  email: string;
  name: string;
  metadata?: Prisma.InputJsonObject;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(partnerId: string, data: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        partnerId,
        ...data,
      },
    });
  }

  findAll(partnerId: string) {
    return this.prisma.customer.findMany({
      where: { partnerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(partnerId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, partnerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }
}
