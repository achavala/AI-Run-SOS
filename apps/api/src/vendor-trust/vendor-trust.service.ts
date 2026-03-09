import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorTrustService {
  private readonly logger = new Logger(VendorTrustService.name);

  constructor(private prisma: PrismaService) {}

  async computeAllScores() {
    this.logger.log('Computing vendor trust scores with tier-based weighting...');

    const vendors = await this.prisma.$queryRaw`
      SELECT
        vc.id,
        vc.domain,
        vc.name,
        vc."emailCount" as email_count,
        (SELECT COUNT(*)::int FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id) as req_count,
        (SELECT COUNT(*)::int FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id
          AND vrs."createdAt" >= NOW() - interval '30 days') as req_count_30d,
        (SELECT COUNT(*)::int FROM "ExtractedVendorContact" vct WHERE vct."vendorCompanyId" = vc.id) as contact_count,
        (SELECT COUNT(DISTINCT title)::int FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id
          AND title IS NOT NULL) as unique_roles,
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE "rateText" IS NOT NULL)::numeric / GREATEST(COUNT(*), 1) * 100, 1)
          FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id) as has_rate_pct,
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE location IS NOT NULL AND location != '')::numeric / GREATEST(COUNT(*), 1) * 100, 1)
          FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id) as has_location_pct,
        (SELECT COUNT(*)::int FROM "VendorReqSignal" vrs WHERE vrs."vendorCompanyId" = vc.id
          AND "premiumSkillFamily" IS NOT NULL) as premium_req_count
      FROM "ExtractedVendorCompany" vc
      WHERE vc.name IS NOT NULL AND vc.name NOT LIKE '[SYSTEM]%'
    ` as any[];

    let computed = 0;
    for (const v of vendors) {
      const score = this.calculateTrustScore(v);
      const tier = this.determineTier(score, v);

      await this.prisma.vendor.upsert({
        where: { id: v.id },
        create: {
          id: v.id,
          tenantId: 'default',
          companyName: v.name || v.domain,
          domain: v.domain,
          trustScore: score,
          tier: tier as any,
          placementCount: 0,
        },
        update: {
          trustScore: score,
          tier: tier as any,
          lastActivityAt: new Date(),
        },
      }).catch(async () => {
        const existing = await this.prisma.vendor.findFirst({
          where: { domain: v.domain },
        });
        if (existing) {
          await this.prisma.vendor.update({
            where: { id: existing.id },
            data: { trustScore: score, tier: tier as any, lastActivityAt: new Date() },
          });
        }
      });
      computed++;
    }

    this.logger.log(`Computed trust scores for ${computed} vendors`);
    return {
      computed,
      distribution: await this.getDistribution(),
    };
  }

  private calculateTrustScore(v: any): number {
    let score = 0;

    // Volume (max 25 pts)
    if (v.req_count >= 100) score += 25;
    else if (v.req_count >= 20) score += 15;
    else if (v.req_count >= 5) score += 8;
    else score += 2;

    // Recency: active in last 30 days (max 25 pts)
    if (v.req_count_30d >= 10) score += 25;
    else if (v.req_count_30d >= 3) score += 15;
    else if (v.req_count_30d >= 1) score += 8;

    // Diversity: variety of roles (max 15 pts)
    if (v.unique_roles >= 20) score += 15;
    else if (v.unique_roles >= 5) score += 10;
    else if (v.unique_roles >= 2) score += 5;

    // Data quality: has rate info (max 15 pts)
    score += Math.min(15, Math.round((v.has_rate_pct || 0) * 0.15));

    // Data quality: has location (max 10 pts)
    score += Math.min(10, Math.round((v.has_location_pct || 0) * 0.1));

    // Contacts (max 10 pts)
    if (v.contact_count >= 5) score += 10;
    else if (v.contact_count >= 2) score += 6;
    else score += 2;

    // Premium skill bonus: vendors sending premium reqs get a trust uplift (max 5 pts)
    const premiumRatio = v.req_count > 0 ? (v.premium_req_count || 0) / v.req_count : 0;
    if (premiumRatio >= 0.3) score += 5;
    else if (premiumRatio >= 0.1) score += 3;

    return Math.min(100, Math.max(0, score));
  }

  private determineTier(score: number, v: any): string {
    // PRIME: high trust + high volume + recent activity + multiple contacts
    if (score >= 80 && v.req_count_30d >= 5 && v.contact_count >= 3) return 'PRIME';
    // DIRECT: good trust + active
    if (score >= 65 && v.req_count_30d >= 2) return 'DIRECT';
    // SUB: medium trust
    if (score >= 40) return 'SUB';
    // BROKER: low trust but some activity
    if (score >= 20) return 'BROKER';
    return 'UNCLASSIFIED';
  }

  async getTopVendors(limit = 30) {
    return this.prisma.vendor.findMany({
      where: { trustScore: { not: null } },
      orderBy: { trustScore: 'desc' },
      take: limit,
      select: {
        id: true,
        companyName: true,
        domain: true,
        trustScore: true,
        tier: true,
        responseRate: true,
        interviewGrantRate: true,
        placementCount: true,
        avgBillRateMin: true,
        avgBillRateMax: true,
        preferredPods: true,
        lastActivityAt: true,
      },
    });
  }

  async getDistribution() {
    return this.prisma.$queryRaw`
      SELECT tier::text as tier, COUNT(*)::int as count,
             ROUND(AVG("trustScore")::numeric, 1) as avg_score
      FROM "Vendor"
      WHERE "trustScore" IS NOT NULL
      GROUP BY tier
      ORDER BY avg_score DESC
    ` as Promise<any[]>;
  }

  async getVendorScore(vendorId: string) {
    return this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        companyName: true,
        domain: true,
        trustScore: true,
        tier: true,
        responseRate: true,
        interviewGrantRate: true,
        placementCount: true,
        avgBillRateMin: true,
        avgBillRateMax: true,
        preferredPods: true,
        lastActivityAt: true,
        paySpeedDays: true,
        ghostRate: true,
      },
    });
  }

  async getVendorsByLane(lane: string) {
    const tierMap: Record<string, string[]> = {
      PRIME_C2C: ['PRIME', 'DIRECT'],
      BROAD_C2C_W2: ['SUB', 'DIRECT'],
      FTE_HIGH_COMP: ['PRIME', 'DIRECT'],
      OPT_JUNIOR_FTE: ['DIRECT', 'SUB'],
    };
    const tiers = tierMap[lane] || ['PRIME', 'DIRECT', 'SUB', 'BROKER'];

    return this.prisma.vendor.findMany({
      where: {
        tier: { in: tiers as any },
        trustScore: { gte: 30 },
      },
      orderBy: { trustScore: 'desc' },
      take: 50,
    });
  }
}
