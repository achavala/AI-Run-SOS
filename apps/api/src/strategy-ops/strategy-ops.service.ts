import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StrategyOpsService {
  private readonly logger = new Logger(StrategyOpsService.name);

  constructor(private prisma: PrismaService) {}

  /* ═══════════════════════════════════════════════════════════════
   *  1. CANDIDATE QUALITY SCORE COMPUTATION
   *  Composite score: readiness, resume freshness, rate realism,
   *  work auth fit, interview history, placement track record,
   *  availability confidence.
   * ═══════════════════════════════════════════════════════════════ */

  async computeCandidateQualityScores(): Promise<{ updated: number }> {
    this.logger.log('Computing candidate quality scores...');

    const result = await this.prisma.$executeRaw`
      UPDATE "Consultant" c SET
        "qualityScore" = LEAST(100, GREATEST(0,
          -- Readiness (max 25 pts)
          CASE c.readiness
            WHEN 'SUBMISSION_READY' THEN 25
            WHEN 'ON_ASSIGNMENT' THEN 22
            WHEN 'VERIFIED' THEN 18
            WHEN 'DOCS_PENDING' THEN 8
            WHEN 'NEW' THEN 3
            ELSE 0
          END
          -- Resume freshness (max 15 pts)
          + CASE
              WHEN c."resumeFreshnessAt" >= NOW() - interval '30 days' THEN 15
              WHEN c."resumeFreshnessAt" >= NOW() - interval '90 days' THEN 10
              WHEN c."resumeFreshnessAt" >= NOW() - interval '180 days' THEN 5
              WHEN c."resumeUrl" IS NOT NULL THEN 2
              ELSE 0
            END
          -- Rate realism (max 10 pts): consultants with reasonable rate expectations
          + CASE
              WHEN c."rateRealism" IS NOT NULL THEN LEAST(10, ROUND(c."rateRealism" * 10))
              WHEN c."desiredRate" IS NOT NULL AND c."desiredRate" BETWEEN 40 AND 200 THEN 6
              ELSE 3
            END
          -- Placement track record (max 20 pts)
          + LEAST(20,
              COALESCE(c."placementCount", 0) * 8
              + COALESCE(c."offerCount", 0) * 4
              + COALESCE(c."interviewCount", 0) * 2
          )
          -- Skills depth (max 15 pts)
          + CASE
              WHEN c.skills IS NOT NULL AND jsonb_array_length(c.skills) >= 6 THEN 15
              WHEN c.skills IS NOT NULL AND jsonb_array_length(c.skills) >= 3 THEN 10
              WHEN c.skills IS NOT NULL AND jsonb_array_length(c.skills) >= 1 THEN 5
              ELSE 0
            END
          -- Premium skill families (max 10 pts)
          + CASE
              WHEN array_length(c."premiumSkillFamilies", 1) >= 2 THEN 10
              WHEN array_length(c."premiumSkillFamilies", 1) = 1 THEN 6
              ELSE 0
            END
          -- Availability confidence (max 5 pts)
          + CASE
              WHEN c."availabilityConfidence" IS NOT NULL THEN LEAST(5, ROUND(c."availabilityConfidence" * 5))
              WHEN c."availableFrom" IS NOT NULL AND c."availableFrom" <= NOW() + interval '14 days' THEN 4
              ELSE 1
            END
        ))
      WHERE c."firstName" IS NOT NULL AND c."firstName" != ''
    `;

    this.logger.log(`Updated quality scores for ${result} consultants`);
    return { updated: Number(result) };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  2. SUPPLY-DEMAND MATRIX
   *  Cross-reference available supply (consultants by pod/skill)
   *  against active demand (reqs by premium family) to identify
   *  high-opportunity and under-served segments.
   * ═══════════════════════════════════════════════════════════════ */

  async getSupplyDemandMatrix() {
    const [demand, supply, gapAnalysis] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT
          COALESCE("premiumSkillFamily", 'OTHER') as family,
          COUNT(*)::int as "totalReqs",
          COUNT(*) FILTER (WHERE "createdAt" >= NOW() - interval '7 days')::int as "recentReqs",
          COUNT(*) FILTER (WHERE "actionabilityScore" >= 60)::int as "highActionReqs",
          ROUND(AVG("actionabilityScore")::numeric, 1) as "avgActionability"
        FROM "VendorReqSignal"
        WHERE title IS NOT NULL AND title != ''
          AND "createdAt" >= NOW() - interval '30 days'
        GROUP BY "premiumSkillFamily"
        ORDER BY "recentReqs" DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        WITH consultant_families AS (
          SELECT c.*,
                 CASE WHEN array_length(c."premiumSkillFamilies", 1) IS NULL
                      THEN 'UNASSIGNED'
                      ELSE f.family::text
                 END as family
          FROM "Consultant" c
          LEFT JOIN LATERAL UNNEST(c."premiumSkillFamilies") AS f(family) ON true
          WHERE c."firstName" IS NOT NULL AND c."firstName" != ''
        )
        SELECT
          COALESCE(family, 'UNASSIGNED') as family,
          COUNT(DISTINCT id)::int as "totalConsultants",
          COUNT(DISTINCT id) FILTER (WHERE readiness IN ('SUBMISSION_READY', 'VERIFIED'))::int as "readyConsultants",
          COUNT(DISTINCT id) FILTER (WHERE "qualityScore" >= 60)::int as "highQualityConsultants",
          ROUND(AVG("qualityScore")::numeric, 1) as "avgQuality"
        FROM consultant_families
        GROUP BY family
        ORDER BY "readyConsultants" DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT
          COALESCE("sourcingLane"::text, 'UNASSIGNED') as lane,
          COUNT(*)::int as "queuedItems",
          COUNT(*) FILTER (WHERE status = 'SENT')::int as "sentItems",
          ROUND(AVG("matchScore")::numeric, 1) as "avgMatch",
          ROUND(AVG("opportunityPriority")::numeric, 1) as "avgPriority"
        FROM "AutoSubmitQueueItem"
        WHERE "createdAt" >= NOW() - interval '30 days'
        GROUP BY "sourcingLane"
      ` as Promise<any[]>,
    ]);

    return { demand, supply, lanePerformance: gapAnalysis };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  3. TECHNOLOGY TIER ANALYTICS
   *  Return stored TechTierConfig with live metrics overlaid:
   *  current req volume, active placements, avg bill rate, etc.
   * ═══════════════════════════════════════════════════════════════ */

  async getTechTierAnalytics() {
    const tiers = await this.prisma.techTierConfig.findMany({
      where: { isActive: true },
      orderBy: { rank: 'asc' },
    });

    const reqVolume = await this.prisma.$queryRaw`
      SELECT "premiumSkillFamily" as family,
             COUNT(*)::int as "totalReqs",
             COUNT(*) FILTER (WHERE "createdAt" >= NOW() - interval '7 days')::int as "weekReqs",
             ROUND(AVG("actionabilityScore")::numeric, 1) as "avgActionability"
      FROM "VendorReqSignal"
      WHERE "premiumSkillFamily" IS NOT NULL
        AND "createdAt" >= NOW() - interval '30 days'
      GROUP BY "premiumSkillFamily"
    ` as any[];

    const volumeMap = new Map(reqVolume.map((r: any) => [r.family, r]));

    return tiers.map((t) => ({
      ...t,
      liveMetrics: volumeMap.get(t.premiumSkillFamily) || {
        totalReqs: 0,
        weekReqs: 0,
        avgActionability: 0,
      },
    }));
  }

  /* ═══════════════════════════════════════════════════════════════
   *  4. PRE-SUBMISSION QUALITY GATES
   *  Multi-gate check before any submission goes out.
   *  Gate 1: Vendor trust threshold
   *  Gate 2: Margin floor check
   *  Gate 3: Candidate readiness
   *  Gate 4: Employment type compatibility
   *  Gate 5: No recent duplicate submission
   * ═══════════════════════════════════════════════════════════════ */

  async checkPreSubmissionGates(params: {
    vendorDomain?: string;
    billRate?: number;
    payRate?: number;
    consultantId: string;
    reqTitle: string;
    employmentType?: string;
  }) {
    const gates: Array<{ gate: string; passed: boolean; reason: string }> = [];

    // Gate 1: Vendor trust
    if (params.vendorDomain) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { domain: params.vendorDomain },
        select: { trustScore: true, tier: true },
      });
      const trust = vendor?.trustScore ?? 0;
      const passed = trust >= 30;
      gates.push({
        gate: 'VENDOR_TRUST',
        passed,
        reason: passed
          ? `Vendor trust ${Math.round(trust)} (tier: ${vendor?.tier})`
          : `Vendor trust too low: ${Math.round(trust)}. Minimum: 30`,
      });
    } else {
      gates.push({ gate: 'VENDOR_TRUST', passed: true, reason: 'No vendor domain to check' });
    }

    // Gate 2: Margin floor
    if (params.billRate != null && params.payRate != null) {
      const margin = params.billRate - params.payRate;
      const passed = margin >= 8;
      gates.push({
        gate: 'MARGIN_FLOOR',
        passed,
        reason: passed
          ? `Margin $${margin.toFixed(0)}/hr (min: $8)`
          : `Margin $${margin.toFixed(0)}/hr below $8/hr floor`,
      });
    } else {
      gates.push({ gate: 'MARGIN_FLOOR', passed: true, reason: 'Rate info unavailable — manual review' });
    }

    // Gate 3: Candidate readiness
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: params.consultantId },
      select: { readiness: true, qualityScore: true, firstName: true, lastName: true },
    });
    if (consultant) {
      const readyStates = ['SUBMISSION_READY', 'VERIFIED', 'ON_ASSIGNMENT'];
      const passed = readyStates.includes(consultant.readiness);
      gates.push({
        gate: 'CANDIDATE_READINESS',
        passed,
        reason: passed
          ? `${consultant.firstName} ${consultant.lastName}: ${consultant.readiness} (quality: ${consultant.qualityScore ?? 'N/A'})`
          : `Candidate readiness "${consultant.readiness}" not eligible`,
      });
    } else {
      gates.push({ gate: 'CANDIDATE_READINESS', passed: false, reason: 'Consultant not found' });
    }

    // Gate 4: Employment type compatibility
    if (params.employmentType) {
      const workAuths = await this.prisma.consultantWorkAuth.findMany({
        where: { consultantId: params.consultantId, isCurrent: true },
        select: { authType: true },
      });
      const authTypes = workAuths.map((wa) => wa.authType);
      let passed = true;
      let reason = `Employment type: ${params.employmentType}`;

      if (params.employmentType === 'W2' && authTypes.includes('OPT' as any)) {
        passed = true;
        reason += ' — OPT eligible for W2';
      } else if (params.employmentType === 'C2C' && authTypes.some((a) => ['OPT', 'CPT'].includes(a))) {
        passed = false;
        reason += ' — OPT/CPT typically cannot do C2C';
      }

      gates.push({ gate: 'EMPLOYMENT_COMPAT', passed, reason });
    } else {
      gates.push({ gate: 'EMPLOYMENT_COMPAT', passed: true, reason: 'No employment type specified' });
    }

    // Gate 5: No recent duplicate submission
    const recentDupe = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as c
      FROM "Submission" s
      JOIN "Job" j ON j.id = s."jobId"
      WHERE s."consultantId" = ${params.consultantId}
        AND j.title = ${params.reqTitle}
        AND s."createdAt" >= NOW() - interval '30 days'
        AND s.status NOT IN ('REJECTED', 'WITHDRAWN', 'CLOSED')
    ` as any[];

    const noDupe = (recentDupe[0]?.c || 0) === 0;
    gates.push({
      gate: 'DUPLICATE_CHECK',
      passed: noDupe,
      reason: noDupe
        ? 'No duplicate submissions in last 30 days'
        : `Duplicate submission exists (${recentDupe[0]?.c} found)`,
    });

    const allPassed = gates.every((g) => g.passed);

    return { allPassed, gates };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  5. LANE PERFORMANCE DASHBOARD
   *  Key metrics by sourcing lane for the strategy ops view.
   * ═══════════════════════════════════════════════════════════════ */

  async getLanePerformance(tenantId: string) {
    const [laneSubmissions, laneConversions, vendorsByTier] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT
          COALESCE(asq."sourcingLane"::text, 'UNASSIGNED') as lane,
          COUNT(*)::int as "totalQueued",
          COUNT(*) FILTER (WHERE asq.status = 'SENT')::int as "totalSent",
          COUNT(*) FILTER (WHERE asq.status = 'APPROVED')::int as "totalApproved",
          COUNT(*) FILTER (WHERE asq.status = 'REJECTED')::int as "totalRejected",
          ROUND(AVG(asq."matchScore")::numeric, 1) as "avgMatchScore",
          ROUND(AVG(asq."opportunityPriority")::numeric, 1) as "avgPriority",
          ROUND(AVG(asq."premiumSkillBonus")::numeric, 1) as "avgPremiumBonus",
          ROUND(AVG(asq."supplyFitScore")::numeric, 1) as "avgSupplyFit",
          ROUND(AVG(asq."vendorTrustScore")::numeric, 1) as "avgVendorTrust"
        FROM "AutoSubmitQueueItem" asq
        WHERE asq."tenantId" = ${tenantId}
          AND asq."createdAt" >= NOW() - interval '30 days'
        GROUP BY asq."sourcingLane"
        ORDER BY "totalSent" DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT
          s.status::text as status,
          COUNT(*)::int as count
        FROM "Submission" s
        WHERE s."tenantId" = ${tenantId}
          AND s."createdAt" >= NOW() - interval '30 days'
        GROUP BY s.status
        ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT
          tier::text as tier,
          COUNT(*)::int as count,
          ROUND(AVG("trustScore")::numeric, 1) as "avgTrust",
          ROUND(AVG("placementCount")::numeric, 1) as "avgPlacements",
          ROUND(AVG("responseRate")::numeric, 1) as "avgResponseRate",
          ROUND(AVG("interviewGrantRate")::numeric, 1) as "avgInterviewGrant"
        FROM "Vendor"
        WHERE "trustScore" IS NOT NULL
        GROUP BY tier
        ORDER BY "avgTrust" DESC NULLS LAST
      ` as Promise<any[]>,
    ]);

    return {
      lanes: laneSubmissions,
      conversionFunnel: laneConversions,
      vendorTiers: vendorsByTier,
      strategies: {
        PRIME_C2C: {
          label: 'Lane 1: Prime/Trusted C2C',
          focus: 'Margin + speed. Trust ≥ 60, margin ≥ $10/hr.',
          rules: ['Vendor trust threshold required', 'Margin floor required', 'Fast follow-up required'],
        },
        BROAD_C2C_W2: {
          label: 'Lane 2: Broad C2C/W2 Contract',
          focus: 'Volume + bench utilization.',
          rules: ['Stricter dedupe', 'Lower priority than Lane 1', 'Auto-deprioritize low-conversion vendors'],
        },
        FTE_HIGH_COMP: {
          label: 'Lane 3: FTE High-Comp / Direct ATS',
          focus: 'Premium vertical, high-end roles.',
          rules: ['Require verified compensation', 'Shortlist top-tier candidates only', 'Human review for mega-tier roles'],
        },
        OPT_JUNIOR_FTE: {
          label: 'Lane 4: OPT / Junior FTE',
          focus: 'Early-career pipeline.',
          rules: ['Separate scoring and routing', 'Compliance-aware', 'Junior-friendly employers only'],
        },
      },
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  6. OPT EMPLOYER INDEX
   *  CRUD + analytics for visa-friendly employer tracking.
   * ═══════════════════════════════════════════════════════════════ */

  async getOptEmployers(page = 1, pageSize = 25) {
    const offset = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.optEmployerProfile.findMany({
        orderBy: [{ visaFriendliness: 'desc' }, { juniorFitScore: 'desc' }],
        take: pageSize,
        skip: offset,
      }),
      this.prisma.optEmployerProfile.count(),
    ]);
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async upsertOptEmployer(data: {
    companyName: string;
    website?: string;
    atsSource?: string;
    visaFriendliness?: number;
    juniorFitScore?: number;
    compensationTier?: string;
    roleFamilies?: string[];
    degreeAlignment?: string[];
    h1bSponsored?: boolean;
    optStemEligible?: boolean;
    avgStartingSalary?: number;
    notes?: string;
  }) {
    return this.prisma.optEmployerProfile.upsert({
      where: { companyName: data.companyName },
      create: data,
      update: data,
    });
  }

  /* ═══════════════════════════════════════════════════════════════
   *  7. STRATEGIC OVERVIEW
   *  High-level executive summary combining all signals.
   * ═══════════════════════════════════════════════════════════════ */

  async getStrategicOverview(tenantId: string) {
    const [
      totalEmails,
      totalSignals,
      premiumSignals,
      totalVendors,
      primeVendors,
      totalConsultants,
      readyConsultants,
      totalSubmissions,
      recentSubmissions,
      techTiers,
      optEmployerCount,
    ] = await Promise.all([
      this.prisma.rawEmailMessage.count(),
      this.prisma.vendorReqSignal.count({ where: { title: { not: null } } }),
      this.prisma.vendorReqSignal.count({ where: { premiumSkillFamily: { not: null } } }),
      this.prisma.vendor.count({ where: { trustScore: { not: null } } }),
      this.prisma.vendor.count({ where: { tier: { in: ['PRIME', 'DIRECT'] } } }),
      this.prisma.consultant.count({ where: { firstName: { not: '' } } }),
      this.prisma.consultant.count({ where: { readiness: { in: ['SUBMISSION_READY', 'VERIFIED'] } } }),
      this.prisma.submission.count({ where: { tenantId } }),
      this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
      }),
      this.prisma.techTierConfig.count({ where: { isActive: true } }),
      this.prisma.optEmployerProfile.count(),
    ]);

    const conversionFunnel = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int as submitted,
        COUNT(*) FILTER (WHERE status = 'INTERVIEWING')::int as interviewing,
        COUNT(*) FILTER (WHERE status = 'OFFERED')::int as offered,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED')::int as accepted
      FROM "Submission"
      WHERE "tenantId" = ${tenantId}
    ` as any[];

    return {
      pipeline: {
        totalEmails,
        totalSignals,
        premiumSignals,
        premiumPct: totalSignals > 0 ? Math.round((premiumSignals / totalSignals) * 100) : 0,
      },
      vendors: { total: totalVendors, prime: primeVendors },
      supply: { total: totalConsultants, ready: readyConsultants },
      submissions: {
        total: totalSubmissions,
        last30d: recentSubmissions,
        funnel: conversionFunnel[0] || {},
      },
      configuration: { techTiers, optEmployers: optEmployerCount },
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  8. TECH TIER CRUD
   * ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
   *  9. REQ SIGNALS BY PREMIUM SKILL FAMILY
   *  Drill-down: return actual req signals for a given tech tier.
   * ═══════════════════════════════════════════════════════════════ */

  async getReqsByFamily(family: string, page = 1, pageSize = 25) {
    const offset = (page - 1) * pageSize;

    const whereClause = family === 'OTHER' || family === 'null' || !family
      ? `WHERE vrs."premiumSkillFamily" IS NULL AND vrs.title IS NOT NULL AND vrs.title != ''`
      : `WHERE vrs."premiumSkillFamily" = '${family}' AND vrs.title IS NOT NULL AND vrs.title != ''`;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRawUnsafe(`
        SELECT
          vrs.id::text,
          vrs.title,
          vrs.location,
          vrs."rateText",
          vrs."employmentType",
          vrs.skills,
          vrs."actionabilityScore",
          vrs."premiumSkillFamily",
          vrs."premiumSkillBonus",
          vrs."engagementModel",
          vrs."clientHint",
          vrs."createdAt",
          vc.name as "vendorName",
          vc.domain as "vendorDomain",
          vct.email as "contactEmail",
          vct.name as "contactName"
        FROM "VendorReqSignal" vrs
        LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
        LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
        ${whereClause}
        ORDER BY vrs."actionabilityScore" DESC NULLS LAST, vrs."createdAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `) as Promise<any[]>,
      this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as total
        FROM "VendorReqSignal" vrs
        ${whereClause}
      `) as Promise<any[]>,
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getTechTiers() {
    return this.prisma.techTierConfig.findMany({ orderBy: { rank: 'asc' } });
  }

  async upsertTechTier(data: {
    technologyFamily: string;
    rank: number;
    premiumSkillFamily?: string;
    pod?: string;
    c2cBillRateMin?: number;
    c2cBillRateMax?: number;
    fteSalaryMin?: number;
    fteSalaryMax?: number;
    demandGrowthPct?: number;
    competitionLevel?: string;
    grossProfitPerPlacement?: number;
    portfolioAllocationPct?: number;
    keySkills?: string[];
    targetVendorTiers?: string[];
    sourcingStrategy?: string;
  }) {
    return this.prisma.techTierConfig.upsert({
      where: { technologyFamily: data.technologyFamily },
      create: data,
      update: data,
    });
  }
}
