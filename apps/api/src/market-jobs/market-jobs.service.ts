import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export interface MarketJobFilters {
  search?: string;
  employmentType?: string;
  source?: string;
  locationType?: string;
  freshness?: string;
  minHourlyRate?: number;
  maxHourlyRate?: number;
  minRealness?: number;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class MarketJobsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: MarketJobFilters) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.MarketJobWhereInput = {};

    // Status filter (default: ACTIVE only)
    const statusFilter = filters.status ?? 'ACTIVE';
    if (statusFilter !== 'ALL') {
      where.status = statusFilter as any;
    }

    // Build AND conditions array for complex filters
    const andConditions: Prisma.MarketJobWhereInput[] = [];

    if (filters.search) {
      andConditions.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { company: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.employmentType && filters.employmentType !== 'ALL') {
      where.employmentType = filters.employmentType as any;
    }

    if (filters.source && filters.source !== 'ALL') {
      where.source = filters.source as any;
    }

    if (filters.locationType && filters.locationType !== 'ALL') {
      where.locationType = filters.locationType as any;
    }

    // Freshness filter — time window from sourcePostedAt, postedAt, or discoveredAt
    if (filters.freshness && filters.freshness !== 'ALL') {
      const now = new Date();
      let cutoff: Date;
      switch (filters.freshness) {
        case '6h':
          cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '3d':
          cutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
      andConditions.push({
        OR: [
          { sourcePostedAt: { gte: cutoff } },
          { postedAt: { gte: cutoff } },
          { discoveredAt: { gte: cutoff } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Use normalized hourly rates for filtering
    if (filters.minHourlyRate != null) {
      where.hourlyRateMin = { gte: filters.minHourlyRate };
    }
    if (filters.maxHourlyRate != null) {
      where.hourlyRateMax = { lte: filters.maxHourlyRate };
    }

    // Realness score filter
    if (filters.minRealness != null) {
      where.realnessScore = { gte: filters.minRealness };
    }

    const orderBy: Prisma.MarketJobOrderByWithRelationInput = {};
    const sortField = filters.sortBy ?? 'postedAt';
    const validSorts = ['postedAt', 'sourcePostedAt', 'discoveredAt', 'title', 'company', 'hourlyRateMin', 'hourlyRateMax', 'realnessScore'];
    if (validSorts.includes(sortField)) {
      (orderBy as any)[sortField] = filters.sortOrder ?? 'desc';
    } else {
      orderBy.postedAt = 'desc';
    }

    const [jobs, total] = await Promise.all([
      this.prisma.marketJob.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          externalId: true,
          source: true,
          title: true,
          company: true,
          description: true,
          location: true,
          locationType: true,
          employmentType: true,
          classificationConfidence: true,
          negativeSignals: true,
          rateText: true,
          rateMin: true,
          rateMax: true,
          compPeriod: true,
          hourlyRateMin: true,
          hourlyRateMax: true,
          skills: true,
          applyUrl: true,
          sourceUrl: true,
          recruiterName: true,
          recruiterEmail: true,
          recruiterPhone: true,
          recruiterLinkedIn: true,
          fingerprint: true,
          postedAt: true,
          sourcePostedAt: true,
          expiresAt: true,
          discoveredAt: true,
          lastSeenAt: true,
          status: true,
          urlStatus: true,
          urlVerifiedAt: true,
          realnessScore: true,
          realnessReasons: true,
          actionabilityScore: true,
          actionabilityReasons: true,
          matchedVendorId: true,
          companyDomain: true,
          convertedToJobId: true,
          convertedAt: true,
          canonical: {
            select: { jobCount: true, firstSeenAt: true },
          },
        },
      }),
      this.prisma.marketJob.count({ where }),
    ]);

    return {
      jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.marketJob.findUnique({
      where: { id },
      include: {
        canonical: {
          include: {
            aliases: {
              select: { id: true, source: true, externalId: true, applyUrl: true, postedAt: true },
            },
          },
        },
      },
    });
  }

  async getStats() {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      stale,
      converted,
      fresh6h,
      fresh24h,
      urlAlive,
      urlDead,
      avgRealness,
      byType,
      bySource,
      byLocation,
      todayCount,
      lastSyncJob,
    ] = await Promise.all([
      this.prisma.marketJob.count(),
      this.prisma.marketJob.count({ where: { status: 'ACTIVE' } }),
      this.prisma.marketJob.count({ where: { status: 'STALE' } }),
      this.prisma.marketJob.count({ where: { status: 'CONVERTED' } }),
      this.prisma.marketJob.count({
        where: {
          status: 'ACTIVE',
          OR: [
            { sourcePostedAt: { gte: sixHoursAgo } },
            { postedAt: { gte: sixHoursAgo } },
          ],
        },
      }),
      this.prisma.marketJob.count({
        where: {
          status: 'ACTIVE',
          OR: [
            { sourcePostedAt: { gte: twentyFourHoursAgo } },
            { postedAt: { gte: twentyFourHoursAgo } },
          ],
        },
      }),
      this.prisma.marketJob.count({ where: { status: 'ACTIVE', urlStatus: 'ALIVE' } }),
      this.prisma.marketJob.count({ where: { urlStatus: 'DEAD' } }),
      this.prisma.marketJob.aggregate({
        where: { status: 'ACTIVE', realnessScore: { not: null } },
        _avg: { realnessScore: true },
      }),
      this.prisma.marketJob.groupBy({
        by: ['employmentType'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.marketJob.groupBy({
        by: ['source'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.marketJob.groupBy({
        by: ['locationType'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
      this.prisma.marketJob.count({
        where: {
          status: 'ACTIVE',
          discoveredAt: { gte: startOfToday() },
        },
      }),
      this.prisma.marketJob.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { discoveredAt: 'desc' },
        select: { discoveredAt: true },
      }),
    ]);

    const canonicalCount = await this.prisma.marketJobCanonical.count();

    return {
      total,
      active,
      stale,
      converted,
      uniqueJobs: canonicalCount,
      todayCount,
      fresh6h,
      fresh24h,
      urlAlive,
      urlDead,
      avgRealnessScore: Math.round(avgRealness._avg.realnessScore ?? 0),
      lastSync: lastSyncJob?.discoveredAt ?? null,
      byEmploymentType: Object.fromEntries(
        byType.map((r) => [r.employmentType, r._count]),
      ),
      bySource: Object.fromEntries(
        bySource.map((r) => [r.source, r._count]),
      ),
      byLocationType: Object.fromEntries(
        byLocation.map((r) => [r.locationType, r._count]),
      ),
    };
  }

  /**
   * Convert a market job into an internal Job req.
   * Creates the Job, links it back, and marks the market job as CONVERTED.
   */
  async convertToReq(
    marketJobId: string,
    tenantId: string,
    body: { vendorId: string; pod?: string; assignedTo?: string },
  ) {
    const marketJob = await this.prisma.marketJob.findUnique({
      where: { id: marketJobId },
    });

    if (!marketJob) {
      throw new NotFoundException('Market job not found');
    }

    if (marketJob.status === 'CONVERTED') {
      throw new BadRequestException('Job already converted');
    }

    // Create internal Job
    const job = await this.prisma.job.create({
      data: {
        tenantId,
        vendorId: body.vendorId,
        title: marketJob.title,
        description: marketJob.description,
        location: marketJob.location,
        locationType: marketJob.locationType,
        rateMin: marketJob.hourlyRateMin ?? marketJob.rateMin,
        rateMax: marketJob.hourlyRateMax ?? marketJob.rateMax,
        rateType: 'HOURLY',
        skills: marketJob.skills as any ?? [],
        pod: body.pod as any ?? undefined,
        status: 'NEW',
        structuredRequirements: {
          source: 'MARKET_JOB',
          marketJobId: marketJob.id,
          originalSource: marketJob.source,
          employmentType: marketJob.employmentType,
          applyUrl: marketJob.applyUrl,
        },
      },
    });

    // Create JobReqSource linking back
    await this.prisma.jobReqSource.create({
      data: {
        tenantId,
        jobId: job.id,
        source: 'API',
        sourceRef: `market-job:${marketJob.id}`,
        rawText: `Converted from market job: ${marketJob.title} at ${marketJob.company} (${marketJob.source})`,
      },
    });

    // Mark market job as converted
    await this.prisma.marketJob.update({
      where: { id: marketJobId },
      data: {
        status: 'CONVERTED',
        convertedToJobId: job.id,
        convertedAt: new Date(),
      },
    });

    return { job, marketJobId };
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
