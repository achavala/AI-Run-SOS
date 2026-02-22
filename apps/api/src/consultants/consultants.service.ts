import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConsultantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    opts: {
      page?: number;
      pageSize?: number;
      search?: string;
      readiness?: string;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };

    if (opts.readiness) {
      where.readiness = opts.readiness;
    }

    if (opts.search) {
      const term = opts.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [consultants, total] = await Promise.all([
      this.prisma.consultant.findMany({
        where,
        include: { _count: { select: { submissions: true } } },
        orderBy: { lastName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.consultant.count({ where }),
    ]);

    return {
      data: consultants.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        skills: c.skills as string[],
        readiness: c.readiness,
        desiredRate: c.desiredRate,
        availableFrom: c.availableFrom?.toISOString() ?? null,
        verificationStatus: c.verificationStatus,
        trustScore: c.trustScore,
        activeSubmissions: c._count.submissions,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
