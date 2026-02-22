import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VendorTrustService {
  private readonly logger = new Logger(VendorTrustService.name);

  constructor(private prisma: PrismaService) {}

  async computeAllScores() {
    this.logger.log('Computing vendor trust scores...');

    const vendors = await this.prisma.$queryRaw`
      SELECT
        vc.id,
        vc.domain,
        vc.name,
        vc.email_count,
        (SELECT COUNT(*)::int FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id) as req_count,
        (SELECT COUNT(*)::int FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id
          AND vrs.created_at >= NOW() - interval '30 days') as req_count_30d,
        (SELECT COUNT(*)::int FROM vendor_contact vct WHERE vct.vendor_company_id = vc.id) as contact_count,
        (SELECT COUNT(DISTINCT title)::int FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id
          AND title IS NOT NULL) as unique_roles,
        (SELECT ROUND(COUNT(*)::numeric /
          GREATEST(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 604800, 1), 2)
          FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id) as avg_reqs_per_week,
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE rate_text IS NOT NULL)::numeric / GREATEST(COUNT(*), 1) * 100, 1)
          FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id) as has_rate_pct,
        (SELECT ROUND(
          COUNT(*) FILTER (WHERE location IS NOT NULL AND location != '')::numeric / GREATEST(COUNT(*), 1) * 100, 1)
          FROM vendor_req_signal vrs WHERE vrs.vendor_company_id = vc.id) as has_location_pct
      FROM vendor_company vc
      WHERE vc.name NOT LIKE '[SYSTEM]%'
    ` as any[];

    let computed = 0;
    for (const v of vendors) {
      const score = this.calculateTrustScore(v);
      const tier = score >= 75 ? 'HIGH' : score >= 45 ? 'MEDIUM' : score >= 20 ? 'LOW' : 'JUNK';

      await this.prisma.$executeRaw`
        INSERT INTO vendor_trust_score (
          vendor_company_id, domain, req_count, req_count_30d, contact_count,
          unique_roles_count, avg_reqs_per_week, has_rate_pct, has_location_pct,
          trust_score, actionability_tier, computed_at
        ) VALUES (
          ${v.id}::uuid, ${v.domain}, ${v.req_count}::int, ${v.req_count_30d}::int,
          ${v.contact_count}::int, ${v.unique_roles}::int, ${v.avg_reqs_per_week}::float,
          ${v.has_rate_pct}::float, ${v.has_location_pct}::float,
          ${score}::float, ${tier}, NOW()
        )
        ON CONFLICT (vendor_company_id) DO UPDATE SET
          req_count = EXCLUDED.req_count,
          req_count_30d = EXCLUDED.req_count_30d,
          contact_count = EXCLUDED.contact_count,
          unique_roles_count = EXCLUDED.unique_roles_count,
          avg_reqs_per_week = EXCLUDED.avg_reqs_per_week,
          has_rate_pct = EXCLUDED.has_rate_pct,
          has_location_pct = EXCLUDED.has_location_pct,
          trust_score = EXCLUDED.trust_score,
          actionability_tier = EXCLUDED.actionability_tier,
          computed_at = NOW()
      `;
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

    // Volume: more reqs = more active (max 25 pts)
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

    // Contacts: multiple contacts = real company (max 10 pts)
    if (v.contact_count >= 5) score += 10;
    else if (v.contact_count >= 2) score += 6;
    else score += 2;

    return Math.min(100, Math.max(0, score));
  }

  async getTopVendors(limit = 30) {
    return this.prisma.$queryRaw`
      SELECT vts.*, vc.name as vendor_name
      FROM vendor_trust_score vts
      JOIN vendor_company vc ON vc.id = vts.vendor_company_id
      ORDER BY vts.trust_score DESC
      LIMIT ${limit}
    ` as Promise<any[]>;
  }

  async getDistribution() {
    return this.prisma.$queryRaw`
      SELECT actionability_tier as tier, COUNT(*)::int as count,
             ROUND(AVG(trust_score)::numeric, 1) as avg_score
      FROM vendor_trust_score
      GROUP BY actionability_tier
      ORDER BY avg_score DESC
    ` as Promise<any[]>;
  }

  async getVendorScore(vendorCompanyId: string) {
    const [score] = await this.prisma.$queryRaw`
      SELECT * FROM vendor_trust_score WHERE vendor_company_id = ${vendorCompanyId}::uuid
    ` as any[];
    return score || null;
  }
}
