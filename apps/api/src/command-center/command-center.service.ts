import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry { data: any; expiresAt: number; }

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: any, ttlMs = 120_000) {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  async getAutopilotPlan(tenantId: string) {
    const cached = this.getCached(`autopilot:${tenantId}`);
    if (cached) return cached;
    const [
      actionableReqs,
      benchMatches,
      submissionStats,
      followupsDue,
      stuckSubmissions,
      todayActivity,
      vendorLeaderboard,
      laneMetrics,
    ] = await Promise.all([
      this.getActionableReqs(50),
      this.getBenchMatchReqs(10),
      this.getSubmissionPipelineStats(tenantId),
      this.getDueFollowups(),
      this.getStuckSubmissions(tenantId),
      this.getTodayActivity(tenantId),
      this.getVendorLeaderboard(),
      this.getLaneMetrics(tenantId),
    ]);

    const submissionQuota = this.calculateDailyQuota(submissionStats);
    const premiumReqs = actionableReqs.filter((r: any) => r.premiumSkillFamily);
    const primeVendorReqs = actionableReqs.filter((r: any) => r.vendorTier === 'PRIME' || r.vendorTier === 'DIRECT');

    const plan = {
      generatedAt: new Date().toISOString(),
      morning: {
        title: 'Morning Sprint (9 AM)',
        actionableReqs,
        benchMatches,
        submissionQuota,
        premiumReqCount: premiumReqs.length,
        primeVendorReqCount: primeVendorReqs.length,
        message: `${actionableReqs.length} high-signal reqs ready (${premiumReqs.length} premium, ${primeVendorReqs.length} from prime vendors). ${benchMatches.length} have bench matches. Target: ${submissionQuota} submissions today.`,
      },
      laneQueues: laneMetrics,
      midday: {
        title: 'Midday Check (2 PM)',
        followupsDue,
        stuckSubmissions,
        message: `${followupsDue.length} follow-ups due. ${stuckSubmissions.length} submissions stuck >48h.`,
      },
      evening: {
        title: 'Evening Review (6 PM)',
        todayActivity,
        closureProbability: this.estimateClosureProbability(submissionStats),
        vendorLeaderboard: vendorLeaderboard.slice(0, 10),
        message: `Today: ${todayActivity.submissionsSent} sent, ${todayActivity.responsesReceived} responses. Closure probability: ${this.estimateClosureProbability(submissionStats)}%`,
      },
    };
    this.setCache(`autopilot:${tenantId}`, plan, 120_000);
    return plan;
  }

  private async getActionableReqs(limit: number) {
    const emailReqs = await this.prisma.$queryRaw`
      WITH top_signals AS (
        SELECT id, title, location, "rateText", "employmentType", skills,
               COALESCE("actionabilityScore", 50) as "actionabilityScore", "createdAt",
               "vendorCompanyId", "vendorContactId",
               "premiumSkillFamily", "premiumSkillBonus"
        FROM "VendorReqSignal"
        WHERE title IS NOT NULL AND title != '' AND length(title) > 15
          AND "employmentType" = 'C2C'
          AND title !~* '(unsubscribe|no third party|no c2c|w2 only|hot.?list|bench|available|looking for|h1b)'
        ORDER BY "createdAt" DESC
        LIMIT 500
      )
      SELECT ts.id::text, ts.title, ts.location, ts."rateText",
             ts."employmentType", ts.skills,
             ts."actionabilityScore",
             ts."createdAt",
             ts."premiumSkillFamily", ts."premiumSkillBonus",
             vc.name as "vendorName", vc.domain as "vendorDomain",
             vct.email as "contactEmail", vct.name as "contactName",
             COALESCE(v."trustScore", 30) as "vendorTrustScore",
             COALESCE(v.tier::text, 'UNCLASSIFIED') as "vendorTier",
             'EMAIL' as "source"
      FROM top_signals ts
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = ts."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = ts."vendorContactId"
      LEFT JOIN "Vendor" v ON v.domain = vc.domain
      ORDER BY ts."premiumSkillBonus" DESC NULLS LAST, ts."createdAt" DESC
      LIMIT 100
    ` as any[];

    const marketJobs = await this.prisma.$queryRaw`
      SELECT
        m.id::text, m.title, m.location, 
        COALESCE(m."rateText", CASE WHEN m."rateMax" > 0 THEN '$' || m."rateMin"::int || '-$' || m."rateMax"::int ELSE NULL END) as "rateText",
        COALESCE(m."employmentType"::text, 'C2C') as "employmentType",
        CASE WHEN m.skills IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(m.skills)) ELSE ARRAY[]::text[] END as skills,
        COALESCE(m."actionabilityScore", 70) as "actionabilityScore",
        m."postedAt" as "createdAt",
        m.company as "vendorName",
        m.source::text as "vendorDomain",
        COALESCE(m."applyUrl", m."sourceUrl") as "contactEmail",
        m."recruiterName" as "contactName",
        COALESCE(m."realnessScore", 80) as "vendorTrustScore",
        'HIGH' as "vendorTier",
        m.source::text as "source"
      FROM "MarketJob" m
      WHERE m."postedAt" >= NOW() - interval '3 days'
        AND m.title IS NOT NULL AND m.title != ''
        AND m.source IN ('JSEARCH', 'CORPTOCORP')
      ORDER BY m."postedAt" DESC
      LIMIT 50
    ` as any[];

    const combined = [
      ...marketJobs.map((j: any) => ({ ...j, _sortPriority: j.source === 'JSEARCH' ? 1 : 2 })),
      ...emailReqs.map((r: any) => ({ ...r, _sortPriority: 3 })),
    ];

    combined.sort((a, b) => {
      if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return combined.slice(0, limit).map(({ _sortPriority, ...rest }) => rest);
  }

  private async getBenchMatchReqs(limit: number) {
    return this.prisma.$queryRaw`
      WITH recent_reqs AS (
        SELECT vrs.id, vrs.title, vrs.location, vrs."rateText",
               vrs."employmentType", vrs.skills,
               vrs."createdAt",
               vrs."vendorCompanyId", vrs."vendorContactId",
               vrs."premiumSkillFamily"
        FROM "VendorReqSignal" vrs
        WHERE vrs."createdAt" >= NOW() - interval '2 days'
          AND vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0
          AND COALESCE(vrs."actionabilityScore", 50) >= 40
        ORDER BY COALESCE(vrs."actionabilityScore", 50) DESC, vrs."createdAt" DESC
        LIMIT 50
      ),
      matched AS (
        SELECT rr.*,
               vc.name as "vendorName",
               vct.email as "contactEmail",
               c.id as "consultantId",
               c."firstName" || ' ' || c."lastName" as "consultantName",
               (
                 SELECT COUNT(*)
                 FROM unnest(rr.skills) rs(s)
                 JOIN jsonb_array_elements_text(c.skills) cs(s) ON LOWER(rs.s) = LOWER(cs.s)
               )::int as skill_overlap
        FROM recent_reqs rr
        LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = rr."vendorCompanyId"
        LEFT JOIN "ExtractedVendorContact" vct ON vct.id = rr."vendorContactId"
        CROSS JOIN LATERAL (
          SELECT c.id, c."firstName", c."lastName", c.skills
          FROM "Consultant" c
          WHERE c.readiness IN ('SUBMISSION_READY', 'VERIFIED')
            AND c."firstName" IS NOT NULL AND c."firstName" != ''
          ORDER BY c."qualityScore" DESC NULLS LAST
          LIMIT 5
        ) c
      )
      SELECT * FROM matched
      WHERE skill_overlap >= 2
      ORDER BY skill_overlap DESC, "createdAt" DESC
      LIMIT ${limit}
    ` as Promise<any[]>;
  }

  private async getSubmissionPipelineStats(tenantId: string) {
    const stats = await this.prisma.$queryRaw`
      SELECT status, COUNT(*)::int as count
      FROM "Submission" WHERE "tenantId" = ${tenantId}
      GROUP BY status
    ` as any[];

    const today = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "Submission"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= CURRENT_DATE
    ` as any[];

    return {
      byStatus: stats,
      todayCount: today[0]?.count || 0,
    };
  }

  private async getDueFollowups() {
    try {
      return await this.prisma.$queryRaw`
        SELECT sf.id, sf.submission_id as "submissionId",
               sf.followup_number as "number",
               sf.scheduled_at as "scheduledAt",
               s."jobId", s."consultantId", s.status as "submissionStatus"
        FROM submission_followup sf
        JOIN "Submission" s ON s.id = sf.submission_id
        WHERE sf.status = 'PENDING'
          AND sf.scheduled_at <= NOW()
          AND s.status IN ('SUBMITTED')
        ORDER BY sf.scheduled_at ASC
        LIMIT 30
      ` as any[];
    } catch {
      return [];
    }
  }

  private async getStuckSubmissions(tenantId: string) {
    return this.prisma.$queryRaw`
      SELECT s.id, s."jobId", s."consultantId", s.status,
             s."createdAt", s."updatedAt",
             EXTRACT(EPOCH FROM (NOW() - s."updatedAt")) / 3600 as "stuckHours"
      FROM "Submission" s
      WHERE s."tenantId" = ${tenantId}
        AND s.status = 'SUBMITTED'
        AND s."updatedAt" < NOW() - interval '48 hours'
      ORDER BY s."updatedAt" ASC
      LIMIT 20
    ` as Promise<any[]>;
  }

  private async getTodayActivity(tenantId: string) {
    const [result] = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE)::int as "submissionsCreated",
        COUNT(*) FILTER (WHERE status = 'SUBMITTED' AND "updatedAt" >= CURRENT_DATE)::int as "submissionsSent",
        COUNT(*) FILTER (WHERE "feedbackReceivedAt" >= CURRENT_DATE)::int as "responsesReceived",
        COUNT(*) FILTER (WHERE status = 'INTERVIEWING' AND "updatedAt" >= CURRENT_DATE)::int as "interviewsScheduled"
      FROM "Submission"
      WHERE "tenantId" = ${tenantId}
    ` as any[];
    return result || { submissionsCreated: 0, submissionsSent: 0, responsesReceived: 0, interviewsScheduled: 0 };
  }

  private async getVendorLeaderboard() {
    return this.prisma.$queryRaw`
      SELECT v."companyName" as "vendorName", v.domain,
             COALESCE(v."trustScore", 0) as "trustScore",
             v.tier::text as "tier",
             v."responseRate",
             v."interviewGrantRate",
             v."placementCount",
             v."avgBillRateMin", v."avgBillRateMax"
      FROM "Vendor" v
      WHERE COALESCE(v."trustScore", 0) >= 40
      ORDER BY v."trustScore" DESC NULLS LAST
      LIMIT 20
    ` as Promise<any[]>;
  }

  private async getLaneMetrics(tenantId: string) {
    const autoSubmitByLane = await this.prisma.$queryRaw`
      SELECT
        COALESCE("sourcingLane"::text, 'UNASSIGNED') as lane,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'QUEUED')::int as queued,
        COUNT(*) FILTER (WHERE status = 'SENT')::int as sent,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int as approved,
        ROUND(AVG("opportunityPriority")::numeric, 1) as "avgPriority",
        ROUND(AVG("matchScore")::numeric, 1) as "avgMatchScore",
        ROUND(AVG("premiumSkillBonus")::numeric, 1) as "avgPremiumBonus"
      FROM "AutoSubmitQueueItem"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= CURRENT_DATE - interval '7 days'
      GROUP BY "sourcingLane"
      ORDER BY total DESC
    ` as any[];

    const vendorTierDist = await this.prisma.$queryRaw`
      SELECT
        tier::text as tier,
        COUNT(*)::int as count,
        ROUND(AVG("trustScore")::numeric, 1) as "avgTrust"
      FROM "Vendor"
      WHERE "trustScore" IS NOT NULL
      GROUP BY tier
      ORDER BY "avgTrust" DESC NULLS LAST
    ` as any[];

    const supplyByPod = await this.prisma.$queryRaw`
      SELECT
        readiness::text as readiness,
        COUNT(*)::int as count
      FROM "Consultant"
      WHERE readiness IN ('SUBMISSION_READY', 'VERIFIED')
      GROUP BY readiness
    ` as any[];

    return {
      lanes: autoSubmitByLane,
      vendorTiers: vendorTierDist,
      availableSupply: supplyByPod,
      strategy: {
        PRIME_C2C: 'Prioritize: margin + speed. Trust >= 60, margin >= $10/hr. Fast follow-up.',
        BROAD_C2C_W2: 'Volume play: strict dedupe, lower priority than Lane 1. Auto-deprioritize low-conversion vendors.',
        FTE_HIGH_COMP: 'Premium vertical: comp-verified only, shortlist top candidates, human review for mega roles.',
        OPT_JUNIOR_FTE: 'Early-career pipeline: separate scoring, compliance-aware, junior-friendly employers.',
      },
    };
  }

  private calculateDailyQuota(stats: any): number {
    // Target: 25 submissions/day for 1 closure/day
    // (assumes ~4% conversion rate: 25 subs → 5 interviews → 1 offer)
    const todaySoFar = stats.todayCount || 0;
    return Math.max(0, 25 - todaySoFar);
  }

  private estimateClosureProbability(stats: any): number {
    const submitted = (stats.byStatus || []).find((s: any) => s.status === 'SUBMITTED')?.count || 0;
    const interviewing = (stats.byStatus || []).find((s: any) => s.status === 'INTERVIEWING')?.count || 0;
    const offered = (stats.byStatus || []).find((s: any) => s.status === 'OFFERED')?.count || 0;

    // Rough probability model
    return Math.min(99, Math.round(offered * 60 + interviewing * 15 + submitted * 2));
  }

  /* ═══════ Actionability Scoring for Req Signals ═══════ */

  async computeActionabilityScores() {
    this.logger.log('Computing actionability + premium skill scores...');

    const BATCH_SIZE = 50000;
    let totalUpdated = 0;
    let batchNum = 0;

    while (true) {
      batchNum++;
      const result = await this.prisma.$executeRaw`
        UPDATE "VendorReqSignal" vrs SET
          "actionabilityScore" = (
            CASE WHEN title IS NOT NULL AND title != '' THEN 20 ELSE 0 END
            + CASE WHEN "vendorContactId" IS NOT NULL THEN 20 ELSE 0 END
            + CASE WHEN "rateText" IS NOT NULL THEN 15 ELSE 0 END
            + CASE WHEN location IS NOT NULL AND location != '' THEN 10 ELSE 0 END
            + CASE WHEN skills IS NOT NULL AND array_length(skills, 1) > 0 THEN 10 ELSE 0 END
            + CASE WHEN "employmentType" IN ('C2C', 'W2', 'CONTRACT') THEN 10 ELSE 0 END
            + CASE WHEN "createdAt" >= NOW() - interval '3 days' THEN 10 ELSE 0 END
            + CASE WHEN EXISTS (
                SELECT 1 FROM "Vendor" v
                WHERE v.domain = (SELECT evc.domain FROM "ExtractedVendorCompany" evc WHERE evc.id = vrs."vendorCompanyId")
                  AND COALESCE(v."trustScore", 0) >= 60
              ) THEN 5 ELSE 0 END
            - CASE WHEN title ILIKE '%no third party%' OR title ILIKE '%no c2c%' OR title ILIKE '%w2 only%' THEN 30 ELSE 0 END
            + CASE
                WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
                  ~* '(machine learning|deep learning|nlp|computer vision|pytorch|tensorflow|ai engineer|ml engineer|artificial intelligence|llm|large language model|generative ai|gen ai|langchain|rag|transformers)'
                THEN 15
                WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
                  ~* '(mlops|ml ops|kubeflow|mlflow|sagemaker|vertex ai|model deployment|model serving|feature store|genai infra)'
                THEN 13
                WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
                  ~* '(data engineer|spark|airflow|databricks|snowflake|dbt|kafka|data pipeline|etl|data lake|data warehouse)'
                THEN 10
                WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
                  ~* '(devops|platform engineer|sre|site reliability|kubernetes|terraform|cicd|ci/cd|cloud architect|infrastructure as code)'
                THEN 8
                WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
                  ~* '(cybersecurity|security engineer|penetration test|soc analyst|siem|zero trust|devsecops|cloud security)'
                THEN 8
                ELSE 0
              END
          ),
          "engagementModel" = CASE
            WHEN title ILIKE '%c2c%' OR title ILIKE '%corp to corp%' OR title ILIKE '%corp-to-corp%' THEN 'C2C'
            WHEN title ILIKE '%w2%' THEN 'W2'
            WHEN title ILIKE '%1099%' THEN '1099'
            WHEN title ILIKE '%full time%' OR title ILIKE '%fte%' OR title ILIKE '%permanent%' THEN 'FTE'
            ELSE 'UNKNOWN'
          END,
          "employmentNature" = CASE
            WHEN title ILIKE '%contract to hire%' OR title ILIKE '%c2h%' OR title ILIKE '%contract-to-hire%' THEN 'C2H'
            WHEN title ILIKE '%contract%' OR "employmentType" IN ('CONTRACT', 'C2C', 'W2', '1099') THEN 'CONTRACT'
            WHEN title ILIKE '%perm%' OR title ILIKE '%full time%' OR title ILIKE '%fte%' THEN 'PERM'
            ELSE 'UNKNOWN'
          END,
          "premiumSkillFamily" = CASE
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(machine learning|deep learning|nlp|pytorch|tensorflow|ai engineer|ml engineer|llm|generative ai|gen ai|langchain)' THEN 'AI_ML'
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(mlops|ml ops|kubeflow|mlflow|sagemaker|vertex ai|model deployment|genai infra)' THEN 'MLOPS_GENAI'
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(data engineer|spark|airflow|databricks|snowflake|dbt|kafka|data pipeline)' THEN 'DATA_ENGINEERING'
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(devops|platform engineer|sre|kubernetes|terraform|cicd|cloud architect)' THEN 'CLOUD_DEVOPS'
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(cybersecurity|security engineer|penetration test|soc analyst|siem|zero trust|devsecops)' THEN 'CYBERSECURITY'
            ELSE NULL
          END,
          "premiumSkillBonus" = CASE
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(machine learning|deep learning|nlp|pytorch|tensorflow|ai engineer|ml engineer|llm|generative ai|gen ai|langchain)' THEN 15
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(mlops|ml ops|kubeflow|mlflow|sagemaker|vertex ai|model deployment|genai infra)' THEN 13
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(data engineer|spark|airflow|databricks|snowflake|dbt|kafka|data pipeline)' THEN 10
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(devops|platform engineer|sre|kubernetes|terraform|cicd|cloud architect)' THEN 8
            WHEN LOWER(COALESCE(title,'') || ' ' || array_to_string(COALESCE(skills, ARRAY[]::text[]), ' '))
              ~* '(cybersecurity|security engineer|penetration test|soc analyst|siem|zero trust|devsecops)' THEN 8
            ELSE 0
          END
        WHERE vrs.id IN (
          SELECT id FROM "VendorReqSignal"
          WHERE "actionabilityScore" IS NULL OR "actionabilityScore" = 0
          LIMIT ${BATCH_SIZE}
        )
      `;

      totalUpdated += Number(result);
      this.logger.log(`Batch ${batchNum}: scored ${result} rows (total: ${totalUpdated})`);

      if (Number(result) < BATCH_SIZE) break;
    }

    this.logger.log(`Completed: scored ${totalUpdated} req signals total`);

    // Also score VendorReq table (Prisma-managed vendor reqs with full fields)
    const vendorReqUpdated = await this.prisma.$executeRaw`
      UPDATE "VendorReq" SET
        "actionabilityScore" = (
          CASE WHEN title IS NOT NULL AND title != '' THEN 20 ELSE 0 END
          + CASE WHEN "fromEmail" IS NOT NULL THEN 15 ELSE 0 END
          + CASE WHEN "rateText" IS NOT NULL THEN 15 ELSE 0 END
          + CASE WHEN location IS NOT NULL AND location != '' THEN 10 ELSE 0 END
          + CASE WHEN skills IS NOT NULL AND skills::text != '[]' THEN 10 ELSE 0 END
          + CASE WHEN "employmentType" IN ('C2C', 'W2', 'CONTRACT') THEN 10 ELSE 0 END
          + CASE WHEN "createdAt" >= NOW() - interval '3 days' THEN 10 ELSE 0 END
          - CASE WHEN title ILIKE '%no third party%' OR title ILIKE '%no c2c%' OR title ILIKE '%w2 only%' THEN 30 ELSE 0 END
        )
      WHERE "actionabilityScore" IS NULL
    `;
    this.logger.log(`Scored ${vendorReqUpdated} VendorReq rows`);

    const distribution = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "actionabilityScore" >= 80)::int as "highAction",
        COUNT(*) FILTER (WHERE "actionabilityScore" >= 50 AND "actionabilityScore" < 80)::int as "mediumAction",
        COUNT(*) FILTER (WHERE "actionabilityScore" >= 20 AND "actionabilityScore" < 50)::int as "lowAction",
        COUNT(*) FILTER (WHERE "actionabilityScore" < 20)::int as "junk",
        ROUND(AVG("actionabilityScore")::numeric, 1) as "avgScore"
      FROM "VendorReqSignal"
      WHERE "actionabilityScore" IS NOT NULL
    ` as any[];

    const premiumBreakdown = await this.prisma.$queryRaw`
      SELECT "premiumSkillFamily" as family, COUNT(*)::int as count,
             ROUND(AVG("actionabilityScore")::numeric, 1) as "avgScore"
      FROM "VendorReqSignal"
      WHERE "premiumSkillFamily" IS NOT NULL
      GROUP BY "premiumSkillFamily"
      ORDER BY count DESC
    ` as any[];

    const engagementBreakdown = await this.prisma.$queryRaw`
      SELECT "engagementModel" as model, "employmentNature" as nature, COUNT(*)::int as count
      FROM "VendorReqSignal"
      WHERE "engagementModel" IS NOT NULL
      GROUP BY "engagementModel", "employmentNature"
      ORDER BY count DESC
    ` as any[];

    return {
      updated: totalUpdated + Number(vendorReqUpdated),
      distribution: distribution[0],
      premiumBreakdown,
      engagementBreakdown,
    };
  }
}
