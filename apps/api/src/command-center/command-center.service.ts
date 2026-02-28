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
    ] = await Promise.all([
      this.getActionableReqs(50),
      this.getBenchMatchReqs(10),
      this.getSubmissionPipelineStats(tenantId),
      this.getDueFollowups(),
      this.getStuckSubmissions(tenantId),
      this.getTodayActivity(tenantId),
      this.getVendorLeaderboard(),
    ]);

    const submissionQuota = this.calculateDailyQuota(submissionStats);

    const plan = {
      generatedAt: new Date().toISOString(),
      morning: {
        title: 'Morning Sprint (9 AM)',
        actionableReqs,
        benchMatches,
        submissionQuota,
        message: `${actionableReqs.length} high-signal reqs ready. ${benchMatches.length} have bench matches. Target: ${submissionQuota} submissions today.`,
      },
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
        SELECT id, title, location, rate_text, employment_type, skills,
               COALESCE(actionability_score, 50) as actionability_score, created_at,
               vendor_company_id, vendor_contact_id
        FROM vendor_req_signal
        WHERE title IS NOT NULL AND title != '' AND length(title) > 15
          AND employment_type = 'C2C'
          AND title !~* '(unsubscribe|no third party|no c2c|w2 only|hot.?list|bench|available|looking for|h1b)'
        ORDER BY created_at DESC
        LIMIT 500
      )
      SELECT ts.id::text, ts.title, ts.location, ts.rate_text as "rateText",
             ts.employment_type as "employmentType", ts.skills,
             ts.actionability_score as "actionabilityScore",
             ts.created_at as "createdAt",
             vc.name as "vendorName", vc.domain as "vendorDomain",
             vct.email as "contactEmail", vct.name as "contactName",
             COALESCE(vts.trust_score, 30) as "vendorTrustScore",
             vts.actionability_tier as "vendorTier",
             'EMAIL' as "source"
      FROM top_signals ts
      LEFT JOIN vendor_company vc ON vc.id = ts.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = ts.vendor_contact_id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      ORDER BY ts.created_at DESC
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
        SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text as "rateText",
               vrs.employment_type as "employmentType", vrs.skills,
               vrs.created_at as "createdAt",
               vrs.vendor_company_id, vrs.vendor_contact_id
        FROM vendor_req_signal vrs
        WHERE vrs.created_at >= NOW() - interval '2 days'
          AND vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0
          AND COALESCE(vrs.actionability_score, 50) >= 40
        ORDER BY COALESCE(vrs.actionability_score, 50) DESC, vrs.created_at DESC
        LIMIT 50
      ),
      matched AS (
        SELECT rr.*,
               vc.name as "vendorName",
               vct.email as "contactEmail",
               c.id as "consultantId", c.full_name as "consultantName",
               c.primary_skills as "consultantSkills",
               array_length(
                 ARRAY(SELECT unnest(rr.skills) INTERSECT SELECT unnest(c.primary_skills)),
                 1
               ) as skill_overlap
        FROM recent_reqs rr
        LEFT JOIN vendor_company vc ON vc.id = rr.vendor_company_id
        LEFT JOIN vendor_contact vct ON vct.id = rr.vendor_contact_id
        CROSS JOIN LATERAL (
          SELECT c.id, c.full_name, c.primary_skills
          FROM consultant c
          WHERE c.primary_skills && rr.skills
            AND c.full_name IS NOT NULL AND c.full_name != ''
          ORDER BY array_length(
            ARRAY(SELECT unnest(rr.skills) INTERSECT SELECT unnest(c.primary_skills)),
            1
          ) DESC NULLS LAST
          LIMIT 1
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
    return this.prisma.$queryRaw`
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
    ` as Promise<any[]>;
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
      SELECT vc.name as "vendorName", vc.domain,
             vts.trust_score as "trustScore",
             vts.req_count_30d as "reqs30d",
             vts.has_rate_pct as "hasRatePct",
             vts.actionability_tier as "tier"
      FROM vendor_trust_score vts
      JOIN vendor_company vc ON vc.id = vts.vendor_company_id
      WHERE vts.trust_score >= 50
      ORDER BY vts.trust_score DESC
      LIMIT 20
    ` as Promise<any[]>;
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
    this.logger.log('Computing actionability scores in batches (chunk-safe for 7M+ rows)...');

    const BATCH_SIZE = 100000;
    let totalUpdated = 0;
    let batchNum = 0;

    // Process in batches using ID ranges to avoid locking the entire table
    while (true) {
      batchNum++;
      const result = await this.prisma.$executeRaw`
        UPDATE vendor_req_signal vrs SET
          actionability_score = (
            CASE WHEN title IS NOT NULL AND title != '' THEN 20 ELSE 0 END
            + CASE WHEN vendor_contact_id IS NOT NULL THEN 20 ELSE 0 END
            + CASE WHEN rate_text IS NOT NULL THEN 15 ELSE 0 END
            + CASE WHEN location IS NOT NULL AND location != '' THEN 10 ELSE 0 END
            + CASE WHEN skills IS NOT NULL AND array_length(skills, 1) > 0 THEN 10 ELSE 0 END
            + CASE WHEN employment_type IN ('C2C', 'W2', 'CONTRACT') THEN 10 ELSE 0 END
            + CASE WHEN created_at >= NOW() - interval '3 days' THEN 10 ELSE 0 END
            + CASE WHEN EXISTS (
                SELECT 1 FROM vendor_trust_score vts
                WHERE vts.vendor_company_id = vrs.vendor_company_id
                  AND vts.trust_score >= 60
              ) THEN 5 ELSE 0 END
            - CASE WHEN title ILIKE '%no third party%' OR title ILIKE '%no c2c%' OR title ILIKE '%w2 only%' THEN 30 ELSE 0 END
          ),
          engagement_model = CASE
            WHEN title ILIKE '%c2c%' OR title ILIKE '%corp to corp%' OR title ILIKE '%corp-to-corp%' THEN 'C2C'
            WHEN title ILIKE '%w2%' THEN 'W2'
            WHEN title ILIKE '%1099%' THEN '1099'
            WHEN title ILIKE '%full time%' OR title ILIKE '%fte%' OR title ILIKE '%permanent%' THEN 'FTE'
            ELSE 'UNKNOWN'
          END,
          employment_nature = CASE
            WHEN title ILIKE '%contract to hire%' OR title ILIKE '%c2h%' OR title ILIKE '%contract-to-hire%' THEN 'C2H'
            WHEN title ILIKE '%contract%' OR employment_type IN ('CONTRACT', 'C2C', 'W2', '1099') THEN 'CONTRACT'
            WHEN title ILIKE '%perm%' OR title ILIKE '%full time%' OR title ILIKE '%fte%' THEN 'PERM'
            ELSE 'UNKNOWN'
          END
        WHERE vrs.id IN (
          SELECT id FROM vendor_req_signal
          WHERE actionability_score IS NULL OR actionability_score = 0
          LIMIT ${BATCH_SIZE}
        )
      `;

      totalUpdated += Number(result);
      this.logger.log(`Batch ${batchNum}: scored ${result} rows (total: ${totalUpdated})`);

      if (Number(result) < BATCH_SIZE) break;
    }

    this.logger.log(`Completed: scored ${totalUpdated} req signals total`);

    const distribution = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE actionability_score >= 80)::int as "highAction",
        COUNT(*) FILTER (WHERE actionability_score >= 50 AND actionability_score < 80)::int as "mediumAction",
        COUNT(*) FILTER (WHERE actionability_score >= 20 AND actionability_score < 50)::int as "lowAction",
        COUNT(*) FILTER (WHERE actionability_score < 20)::int as "junk",
        ROUND(AVG(actionability_score)::numeric, 1) as "avgScore"
      FROM vendor_req_signal
      WHERE actionability_score IS NOT NULL
    ` as any[];

    const engagementBreakdown = await this.prisma.$queryRaw`
      SELECT engagement_model as model, employment_nature as nature, COUNT(*)::int as count
      FROM vendor_req_signal
      WHERE engagement_model IS NOT NULL
      GROUP BY engagement_model, employment_nature
      ORDER BY count DESC
    ` as any[];

    return { updated: totalUpdated, distribution: distribution[0], engagementBreakdown };
  }
}
