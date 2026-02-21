import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId },
      include: { _count: { select: { jobs: true } } },
      orderBy: { companyName: 'asc' },
    });

    return vendors.map((v) => ({
      id: v.id,
      companyName: v.companyName,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      paymentTermsDays: v.paymentTermsDays,
      msaStatus: v.msaStatus,
      trustScore: v.trustScore,
      paySpeedDays: v.paySpeedDays,
      ghostRate: v.ghostRate,
      jobCount: v._count.jobs,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
      include: {
        jobs: { take: 20, orderBy: { createdAt: 'desc' } },
        invoices: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(
    tenantId: string,
    data: {
      companyName: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      paymentTermsDays?: number;
    },
  ) {
    return this.prisma.vendor.create({
      data: {
        tenantId,
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        paymentTermsDays: data.paymentTermsDays ?? 30,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      companyName?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      paymentTermsDays?: number;
    },
  ) {
    await this.ensureExists(tenantId, id);
    return this.prisma.vendor.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);
    return this.prisma.vendor.delete({ where: { id } });
  }

  private async ensureExists(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }
}
