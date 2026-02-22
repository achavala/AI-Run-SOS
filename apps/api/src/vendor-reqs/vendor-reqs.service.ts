import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export interface VendorReqFilters {
  search?: string;
  status?: string;
  vendorId?: string;
  employmentType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class VendorReqsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: VendorReqFilters) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.VendorReqWhereInput = { tenantId };

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status as any;
    }

    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }

    if (filters.employmentType && filters.employmentType !== 'ALL') {
      where.employmentType = filters.employmentType as any;
    }

    if (filters.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { subject: { contains: filters.search, mode: 'insensitive' } },
            { fromEmail: { contains: filters.search, mode: 'insensitive' } },
            { clientHint: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const orderBy: Prisma.VendorReqOrderByWithRelationInput = {};
    const sortField = filters.sortBy ?? 'receivedAt';
    const validSorts = ['receivedAt', 'actionabilityScore', 'realnessScore', 'title'];
    if (validSorts.includes(sortField)) {
      (orderBy as any)[sortField] = filters.sortOrder ?? 'desc';
    } else {
      orderBy.receivedAt = 'desc';
    }

    const [reqs, total] = await Promise.all([
      this.prisma.vendorReq.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.vendorReq.count({ where }),
    ]);

    return {
      reqs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string) {
    return this.prisma.vendorReq.findUnique({ where: { id } });
  }

  async getStats(tenantId: string) {
    const [total, newCount, reviewed, converted, rejected] = await Promise.all([
      this.prisma.vendorReq.count({ where: { tenantId } }),
      this.prisma.vendorReq.count({ where: { tenantId, status: 'NEW' } }),
      this.prisma.vendorReq.count({ where: { tenantId, status: 'REVIEWED' } }),
      this.prisma.vendorReq.count({ where: { tenantId, status: 'CONVERTED' } }),
      this.prisma.vendorReq.count({ where: { tenantId, status: 'REJECTED' } }),
    ]);

    return { total, new: newCount, reviewed, converted, rejected };
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.vendorReq.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async convertToReq(
    vendorReqId: string,
    tenantId: string,
    body: { vendorId: string; pod?: string },
  ) {
    const req = await this.prisma.vendorReq.findUnique({ where: { id: vendorReqId } });

    if (!req) throw new NotFoundException('Vendor req not found');
    if (req.status === 'CONVERTED') throw new BadRequestException('Already converted');

    const job = await this.prisma.job.create({
      data: {
        tenantId,
        vendorId: body.vendorId,
        title: req.title ?? req.subject,
        description: req.description ?? req.rawBody ?? '',
        location: req.location,
        locationType: req.locationType ?? 'REMOTE',
        rateMin: req.hourlyRateMin,
        rateMax: req.hourlyRateMax,
        rateType: 'HOURLY',
        skills: req.skills as any ?? [],
        pod: body.pod as any ?? undefined,
        status: 'NEW',
        structuredRequirements: {
          source: 'VENDOR_EMAIL',
          vendorReqId: req.id,
          fromEmail: req.fromEmail,
          employmentType: req.employmentType,
          clientHint: req.clientHint,
          duration: req.duration,
        },
      },
    });

    await this.prisma.jobReqSource.create({
      data: {
        tenantId,
        jobId: job.id,
        source: 'EMAIL',
        sourceRef: `vendor-req:${req.id}`,
        rawText: `From ${req.fromName ?? req.fromEmail}: ${req.subject}`,
      },
    });

    await this.prisma.vendorReq.update({
      where: { id: vendorReqId },
      data: { status: 'CONVERTED', convertedToJobId: job.id, convertedAt: new Date() },
    });

    return { job, vendorReqId };
  }
}
