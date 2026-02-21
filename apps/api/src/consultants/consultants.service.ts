import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsultantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const consultants = await this.prisma.consultant.findMany({
      where: { tenantId },
      include: { _count: { select: { submissions: true } } },
      orderBy: { lastName: 'asc' },
    });

    return consultants.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      skills: c.skills as string[],
      visaStatus: c.visaStatus,
      availableFrom: c.availableFrom?.toISOString() ?? null,
      verificationStatus: c.verificationStatus,
      trustScore: c.trustScore,
      activeSubmissions: c._count.submissions,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id, tenantId },
      include: {
        submissions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { job: { select: { title: true, vendor: { select: { companyName: true } } } } },
        },
        placements: { take: 10, orderBy: { createdAt: 'desc' } },
        consentRecords: { take: 20, orderBy: { consentGivenAt: 'desc' } },
      },
    });

    if (!consultant) throw new NotFoundException('Consultant not found');
    return consultant;
  }

  async create(
    tenantId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      skills?: string[];
      visaStatus?: string;
      workAuthExpiry?: string;
      availableFrom?: string;
      desiredRate?: number;
    },
  ) {
    return this.prisma.consultant.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        skills: data.skills ?? [],
        visaStatus: data.visaStatus,
        workAuthExpiry: data.workAuthExpiry ? new Date(data.workAuthExpiry) : undefined,
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
        desiredRate: data.desiredRate,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      skills?: string[];
      visaStatus?: string;
      workAuthExpiry?: string;
      availableFrom?: string;
      desiredRate?: number;
    },
  ) {
    await this.ensureExists(tenantId, id);

    const updateData: any = { ...data };
    if (data.workAuthExpiry) updateData.workAuthExpiry = new Date(data.workAuthExpiry);
    if (data.availableFrom) updateData.availableFrom = new Date(data.availableFrom);

    return this.prisma.consultant.update({ where: { id }, data: updateData });
  }

  async updateConsentPolicy(
    tenantId: string,
    id: string,
    policy: {
      autoApproveVendors?: string[];
      autoApproveAboveRate?: number;
      blockVendors?: string[];
      requireExplicitConsent?: boolean;
    },
  ) {
    await this.ensureExists(tenantId, id);
    return this.prisma.consultant.update({
      where: { id },
      data: { consentPolicy: policy as any },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);
    return this.prisma.consultant.delete({ where: { id } });
  }

  private async ensureExists(tenantId: string, id: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');
    return consultant;
  }
}
