import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry { data: any; expiresAt: number; }

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
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

  /* ═══════ 1. Recruiter Email Activity ═══════ */

  async getRecruiterActivity() {
    const cached = this.getCached('recruiterActivity');
    if (cached) return cached;

    const recruiters = await this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        SPLIT_PART(mailbox_email, '@', 1) as "name",
        COUNT(*)::int as "totalEmails",
        COUNT(*) FILTER (WHERE from_email = mailbox_email)::int as "sent",
        COUNT(*) FILTER (WHERE from_email != mailbox_email)::int as "received",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "vendorReqs",
        COUNT(*) FILTER (WHERE category = 'CONSULTANT')::int as "consultantEmails",
        COUNT(*) FILTER (WHERE category = 'CLIENT')::int as "clientEmails",
        COUNT(*) FILTER (WHERE category = 'INTERNAL')::int as "internalEmails",
        COUNT(*) FILTER (WHERE subject ILIKE 'Re:%' AND from_email = mailbox_email)::int as "repliesSent",
        COUNT(*) FILTER (WHERE subject ILIKE 'Re:%' AND from_email != mailbox_email)::int as "repliesReceived",
        COUNT(*) FILTER (WHERE subject ILIKE 'Fw:%' OR subject ILIKE 'Fwd:%')::int as "forwards",
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "submissionsSent",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::int as "interviewRelated",
        COUNT(*) FILTER (WHERE subject ILIKE '%offer%' AND subject NOT ILIKE '%offered%position%')::int as "offerRelated",
        MIN(sent_at) as "firstActivity",
        MAX(sent_at) as "lastActivity"
      FROM raw_email_message
      GROUP BY mailbox_email
      ORDER BY "totalEmails" DESC
    ` as any[];

    const dailyActivity = await this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        sent_at::date as "day",
        COUNT(*)::int as "total",
        COUNT(*) FILTER (WHERE from_email = mailbox_email)::int as "sent",
        COUNT(*) FILTER (WHERE from_email != mailbox_email)::int as "received",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "vendorReqs"
      FROM raw_email_message
      WHERE sent_at >= NOW() - interval '30 days'
      GROUP BY mailbox_email, sent_at::date
      ORDER BY day DESC, total DESC
    ` as any[];

    const result = { recruiters, dailyActivity };
    this.setCache('recruiterActivity', result, 300_000);
    return result;
  }

  /* ═══════ 2. Email Pipeline Tracker (openings → submitted → replies → interviews) ═══════ */

  async getEmailPipeline() {
    const cached = this.getCached('emailPipeline');
    if (cached) return cached;
    const pipeline = await this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        SPLIT_PART(mailbox_email, '@', 1) as "name",

        -- Stage 1: Job Openings Received
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "openingsReceived",

        -- Stage 2: Verified Submissions (outbound to external vendor domains)
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "submissionsSent",

        -- Stage 3: Replies received (Re: from external after submission)
        COUNT(*) FILTER (WHERE
          subject ILIKE 'Re:%'
          AND from_email != mailbox_email
          AND category IN ('VENDOR_REQ', 'VENDOR_OTHER')
        )::int as "vendorReplies",

        -- Stage 4: Interview signals
        COUNT(*) FILTER (WHERE
          subject ILIKE '%interview%'
          AND subject NOT ILIKE '%interview prep%'
        )::int as "interviewSignals",

        -- Stage 5: Offer signals
        COUNT(*) FILTER (WHERE
          subject ILIKE '%offer%letter%'
          OR subject ILIKE '%offer%extend%'
          OR (subject ILIKE '%offer%' AND subject ILIKE '%accept%')
        )::int as "offerSignals",

        -- Engagement rate (validated)
        CASE WHEN COUNT(*) FILTER (WHERE category = 'VENDOR_REQ') > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE
              from_email = mailbox_email
              AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
              AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
            )::numeric /
            COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::numeric * 100, 1
          )
          ELSE 0 END as "engagementRate"
      FROM raw_email_message
      GROUP BY mailbox_email
      ORDER BY "openingsReceived" DESC
    ` as any[];

    const weeklyTrend = await this.prisma.$queryRaw`
      SELECT
        date_trunc('week', sent_at)::date as "week",
        mailbox_email as "email",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "openings",
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "submissions",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::int as "interviews"
      FROM raw_email_message
      WHERE sent_at >= NOW() - interval '90 days'
      GROUP BY "week", mailbox_email
      ORDER BY "week" DESC, "openings" DESC
    ` as any[];

    const pipelineResult = { pipeline, weeklyTrend };
    this.setCache('emailPipeline', pipelineResult, 300_000);
    return pipelineResult;
  }

  /* ═══════ 3. ML Email Quality Scoring ═══════ */

  async getEmailQualityAnalysis() {
    const cached = this.getCached('emailQuality');
    if (cached) return cached;
    const qualityBreakdown = await this.prisma.$queryRaw`
      WITH scored AS (
        SELECT
          vrs.id,
          vrs.title,
          vrs.location,
          vrs.rate_text,
          vrs.employment_type,
          vrs.skills,
          vrs.actionability_score,
          vrs.engagement_model,
          vrs.employment_nature,
          vc.name as vendor_name,
          vts.trust_score as vendor_trust,
          vts.actionability_tier as vendor_tier,
          CASE
            WHEN vrs.actionability_score >= 80 AND vts.trust_score >= 60 THEN 'PREMIUM'
            WHEN vrs.actionability_score >= 60 AND vts.trust_score >= 40 THEN 'QUALITY'
            WHEN vrs.actionability_score >= 40 THEN 'MODERATE'
            WHEN vrs.actionability_score >= 20 THEN 'LOW_VALUE'
            ELSE 'JUNK'
          END as quality_tier
        FROM vendor_req_signal vrs
        LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
        LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      )
      SELECT
        quality_tier as "tier",
        COUNT(*)::int as "count",
        ROUND(AVG(actionability_score)::numeric, 1) as "avgActionScore",
        COUNT(*) FILTER (WHERE rate_text IS NOT NULL)::int as "withRate",
        COUNT(*) FILTER (WHERE location IS NOT NULL)::int as "withLocation",
        COUNT(*) FILTER (WHERE skills IS NOT NULL AND array_length(skills,1) > 0)::int as "withSkills",
        COUNT(*) FILTER (WHERE engagement_model IN ('C2C', 'W2'))::int as "c2cOrW2"
      FROM scored
      GROUP BY quality_tier
      ORDER BY
        CASE quality_tier
          WHEN 'PREMIUM' THEN 1
          WHEN 'QUALITY' THEN 2
          WHEN 'MODERATE' THEN 3
          WHEN 'LOW_VALUE' THEN 4
          WHEN 'JUNK' THEN 5
        END
    ` as any[];

    const junkPatterns = await this.prisma.$queryRaw`
      SELECT
        'No title' as "pattern",
        COUNT(*) FILTER (WHERE title IS NULL OR title = '')::int as "count"
      FROM vendor_req_signal
      UNION ALL
      SELECT 'No vendor contact', COUNT(*) FILTER (WHERE vendor_contact_id IS NULL)::int FROM vendor_req_signal
      UNION ALL
      SELECT 'No skills detected', COUNT(*) FILTER (WHERE skills IS NULL OR array_length(skills,1) IS NULL)::int FROM vendor_req_signal
      UNION ALL
      SELECT 'No location', COUNT(*) FILTER (WHERE location IS NULL OR location = '')::int FROM vendor_req_signal
      UNION ALL
      SELECT 'No employment type', COUNT(*) FILTER (WHERE employment_type IS NULL OR employment_type = '')::int FROM vendor_req_signal
      UNION ALL
      SELECT 'Contains no-C2C/no-third-party', COUNT(*) FILTER (WHERE title ILIKE '%no third party%' OR title ILIKE '%no c2c%' OR title ILIKE '%w2 only%')::int FROM vendor_req_signal
      ORDER BY "count" DESC
    ` as any[];

    const qualityStrategy = this.generateQualityStrategy(qualityBreakdown, junkPatterns);

    const qualityResult = { qualityBreakdown, junkPatterns, qualityStrategy };
    this.setCache('emailQuality', qualityResult, 300_000);
    return qualityResult;
  }

  /* ═══════ 4. Recruiter Efficiency Table (validated metrics) ═══════ */

  async getRecruiterEfficiencyTable() {
    const cached = this.getCached('recruiterEfficiency');
    if (cached) return cached;
    const daily = await this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        SPLIT_PART(mailbox_email, '@', 1) as "name",
        sent_at::date as "day",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "reqsReceived",
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "verifiedSubmissions",
        COUNT(*) FILTER (WHERE
          subject ILIKE 'Re:%'
          AND from_email != mailbox_email
          AND SPLIT_PART(from_email,'@',2) NOT IN ('cloudresources.net','emonics.com')
          AND category IN ('VENDOR_REQ','VENDOR_OTHER','CLIENT')
        )::int as "vendorReplies",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%' AND subject NOT ILIKE '%interview prep%')::int as "interviewSignals",
        COUNT(*) FILTER (WHERE from_email = mailbox_email)::int as "emailsSent",
        COUNT(*) FILTER (WHERE
          subject ILIKE 'Re:%' AND from_email = mailbox_email
          AND SPLIT_PART(COALESCE((SELECT t FROM unnest(to_emails) t LIMIT 1),''),'@',2) NOT IN ('cloudresources.net','emonics.com','')
        )::int as "externalRepliesSent"
      FROM raw_email_message
      WHERE sent_at >= NOW() - interval '30 days'
      GROUP BY mailbox_email, sent_at::date
      HAVING COUNT(*) FILTER (WHERE category = 'VENDOR_REQ') > 0
        OR COUNT(*) FILTER (WHERE from_email = mailbox_email AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%')) > 0
      ORDER BY day DESC, "reqsReceived" DESC
    ` as any[];

    const allTime = await this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        SPLIT_PART(mailbox_email, '@', 1) as "name",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "totalReqs",
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "totalVerifiedSubmissions",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%' AND subject NOT ILIKE '%interview prep%')::int as "totalInterviews",
        COUNT(*) FILTER (WHERE subject ILIKE '%offer%letter%' OR subject ILIKE '%offer%extend%' OR (subject ILIKE '%offer%' AND subject ILIKE '%accept%'))::int as "totalOffers",
        COUNT(*) FILTER (WHERE
          subject ILIKE 'Re:%' AND from_email != mailbox_email
          AND SPLIT_PART(from_email,'@',2) NOT IN ('cloudresources.net','emonics.com')
          AND category IN ('VENDOR_REQ','VENDOR_OTHER','CLIENT')
        )::int as "totalVendorReplies",
        CASE WHEN COUNT(*) FILTER (WHERE
          from_email = mailbox_email AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%')
        ) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::numeric /
            COUNT(*) FILTER (WHERE from_email = mailbox_email AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%'))::numeric * 100, 1
          ) ELSE 0 END as "submissionToInterviewPct",
        MIN(sent_at) as "firstActivity",
        MAX(sent_at) as "lastActivity"
      FROM raw_email_message
      GROUP BY mailbox_email
      ORDER BY "totalVerifiedSubmissions" DESC
    ` as any[];

    const effResult = { daily, allTime };
    this.setCache('recruiterEfficiency', effResult, 300_000);
    return effResult;
  }

  /* ═══════ 5. Top 30 Actionable Queue (Enforced Work Surface) ═══════ */

  async getActionableQueue(recruiterEmail?: string) {
    const reqs = await this.prisma.$queryRaw`
      SELECT
        vrs.id,
        vrs.title,
        vrs.location,
        vrs.rate_text as "rateText",
        vrs.employment_type as "employmentType",
        vrs.engagement_model as "engagementModel",
        vrs.skills,
        vrs.actionability_score as "actionabilityScore",
        vrs.created_at as "createdAt",
        vc.name as "vendorName",
        vc.domain as "vendorDomain",
        vct.name as "contactName",
        vct.email as "contactEmail",
        vts.trust_score as "vendorTrust",
        vts.actionability_tier as "vendorTier",
        CASE
          WHEN vrs.actionability_score >= 80 AND COALESCE(vts.trust_score,0) >= 60 THEN 'PREMIUM'
          WHEN vrs.actionability_score >= 60 AND COALESCE(vts.trust_score,0) >= 40 THEN 'QUALITY'
          ELSE 'MODERATE'
        END as "tier"
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      WHERE vrs.created_at >= NOW() - interval '3 days'
        AND vrs.actionability_score >= 40
        AND vc.name NOT LIKE '[SYSTEM]%'
        AND vrs.employment_type IS NOT NULL
        AND vrs.title IS NOT NULL AND vrs.title != ''
      ORDER BY
        CASE
          WHEN vrs.actionability_score >= 80 AND COALESCE(vts.trust_score,0) >= 60 THEN 1
          WHEN vrs.actionability_score >= 60 AND COALESCE(vts.trust_score,0) >= 40 THEN 2
          ELSE 3
        END,
        vrs.actionability_score DESC,
        COALESCE(vts.trust_score, 0) DESC
      LIMIT 30
    ` as any[];

    const queueStats = await this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int as "total3d",
        COUNT(*) FILTER (WHERE actionability_score >= 80)::int as "premium",
        COUNT(*) FILTER (WHERE actionability_score >= 60 AND actionability_score < 80)::int as "quality",
        COUNT(*) FILTER (WHERE actionability_score >= 40 AND actionability_score < 60)::int as "moderate",
        COUNT(*) FILTER (WHERE actionability_score < 40 OR actionability_score IS NULL)::int as "lowValue"
      FROM vendor_req_signal
      WHERE created_at >= NOW() - interval '3 days'
    ` as any[];

    return { queue: reqs, stats: queueStats[0] || {} };
  }

  /* ═══════ 6. Follow-ups Due Now ═══════ */

  async getFollowupsDue() {
    return this.prisma.$queryRaw`
      SELECT
        sf.id,
        sf.submission_id as "submissionId",
        sf.followup_number as "number",
        sf.scheduled_at as "scheduledAt",
        sf.sent_at as "sentAt",
        sf.status,
        COALESCE(c."firstName" || ' ' || c."lastName", 'Unknown') as "candidateName",
        j.title as "jobTitle",
        v."companyName" as "vendorName"
      FROM submission_followup sf
      JOIN "Submission" s ON s.id = sf.submission_id
      LEFT JOIN "Consultant" c ON c.id = s."consultantId"
      LEFT JOIN "Job" j ON j.id = s."jobId"
      LEFT JOIN "Vendor" v ON v.id = j."vendorId"
      WHERE sf.status = 'PENDING'
        AND sf.scheduled_at <= NOW() + interval '2 hours'
      ORDER BY sf.scheduled_at ASC
      LIMIT 20
    ` as Promise<any[]>;
  }

  /* ═══════ 7. CLOSURE PROBABILITY MODEL ═══════
   *
   * Heuristic scoring: each req signal gets a 0-100 score based on:
   *   - Vendor trust         (0-25)  : proven vendor reliability
   *   - Rate presence         (0-20)  : reqs with rates are serious
   *   - Employment fit        (0-15)  : C2C/W2 = closeable for us
   *   - Req completeness      (0-10)  : title + location + skills + contact
   *   - Vendor volume         (0-10)  : active vendor = real opportunity
   *   - Bench match           (0-10)  : do we have matching consultants?
   *   - Freshness             (0-10)  : newer = more closeable
   *
   * Then: closure_value = (score/100) × estimated_margin
   * Queue sorted by closure_value DESC = institutional-level prioritization
   */

  async getClosureRankedQueue(limit = 30) {
    const queue = await this.prisma.$queryRaw`
      WITH skill_demand AS (
        SELECT unnest(skills) as skill, COUNT(*)::float as demand
        FROM vendor_req_signal
        WHERE created_at >= NOW() - interval '30 days'
        GROUP BY 1
      ),
      max_demand AS (
        SELECT MAX(demand) as max_d FROM skill_demand
      ),
      bench_skills AS (
        SELECT LOWER(s::text) as skill
        FROM "Consultant" c, jsonb_array_elements_text(c.skills) s
        WHERE c.readiness IN ('SUBMISSION_READY', 'VERIFIED')
      ),
      scored AS (
        SELECT
          vrs.id,
          vrs.title,
          vrs.location,
          vrs.rate_text,
          vrs.employment_type,
          vrs.engagement_model,
          vrs.skills,
          vrs.actionability_score,
          vrs.created_at,
          vc.name as vendor_name,
          vc.domain as vendor_domain,
          vc.email_count as vendor_emails,
          vct.name as contact_name,
          vct.email as contact_email,
          COALESCE(vts.trust_score, 0) as vendor_trust,

          -- VENDOR TRUST (0-25)
          LEAST(COALESCE(vts.trust_score, 0) * 0.25, 25) as trust_pts,

          -- RATE PRESENCE (0-20)
          CASE WHEN vrs.rate_text IS NOT NULL AND vrs.rate_text != '' THEN 20 ELSE 0 END as rate_pts,

          -- EMPLOYMENT FIT (0-15)
          CASE vrs.employment_type
            WHEN 'C2C' THEN 15
            WHEN 'W2' THEN 12
            WHEN 'C2H' THEN 10
            WHEN 'CONTRACT' THEN 8
            WHEN 'FTE' THEN 3
            ELSE 2
          END as emp_pts,

          -- REQ COMPLETENESS (0-10)
          (
            CASE WHEN vrs.title IS NOT NULL AND vrs.title != '' THEN 3 ELSE 0 END +
            CASE WHEN vrs.location IS NOT NULL AND vrs.location != '' THEN 2.5 ELSE 0 END +
            CASE WHEN vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0 THEN 2.5 ELSE 0 END +
            CASE WHEN vct.email IS NOT NULL THEN 2 ELSE 0 END
          ) as complete_pts,

          -- VENDOR VOLUME (0-10): log-scaled email engagement
          LEAST(LN(GREATEST(vc.email_count, 1)) / LN(10000) * 10, 10) as volume_pts,

          -- BENCH MATCH (0-10): any of our bench consultants match these skills?
          (SELECT LEAST(COUNT(DISTINCT bs.skill)::float * 3.3, 10)
           FROM unnest(vrs.skills) rs(s)
           JOIN bench_skills bs ON LOWER(rs.s) = bs.skill
          ) as bench_pts,

          -- FRESHNESS (0-10): based on email age
          CASE
            WHEN vrs.created_at >= NOW() - interval '6 hours' THEN 10
            WHEN vrs.created_at >= NOW() - interval '24 hours' THEN 8
            WHEN vrs.created_at >= NOW() - interval '3 days' THEN 5
            WHEN vrs.created_at >= NOW() - interval '7 days' THEN 2
            ELSE 0
          END as fresh_pts

        FROM vendor_req_signal vrs
        LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
        LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
        LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
        WHERE vrs.created_at >= NOW() - interval '7 days'
          AND vrs.actionability_score >= 30
          AND vrs.title IS NOT NULL AND vrs.title != ''
          AND vrs.employment_type IS NOT NULL
      )
      SELECT
        s.*,
        ROUND((s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts)::numeric, 1) as "closureScore",
        ROUND(((s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts) / 100.0)::numeric, 3) as "closureProbability",
        CASE
          WHEN (s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts) >= 70 THEN 'HOT'
          WHEN (s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts) >= 50 THEN 'WARM'
          WHEN (s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts) >= 30 THEN 'COOL'
          ELSE 'COLD'
        END as "closureTier"
      FROM scored s
      ORDER BY (s.trust_pts + s.rate_pts + s.emp_pts + s.complete_pts + s.volume_pts + COALESCE(s.bench_pts,0) + s.fresh_pts) DESC
      LIMIT ${limit}
    ` as any[];

    const distribution = await this.prisma.$queryRaw`
      WITH scored AS (
        SELECT
          (
            LEAST(COALESCE(vts.trust_score, 0) * 0.25, 25) +
            CASE WHEN vrs.rate_text IS NOT NULL AND vrs.rate_text != '' THEN 20 ELSE 0 END +
            CASE vrs.employment_type WHEN 'C2C' THEN 15 WHEN 'W2' THEN 12 WHEN 'C2H' THEN 10 WHEN 'CONTRACT' THEN 8 WHEN 'FTE' THEN 3 ELSE 2 END +
            CASE WHEN vrs.title IS NOT NULL AND vrs.title != '' THEN 3 ELSE 0 END +
            CASE WHEN vrs.location IS NOT NULL THEN 2.5 ELSE 0 END +
            CASE WHEN vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0 THEN 2.5 ELSE 0 END +
            CASE WHEN vct.email IS NOT NULL THEN 2 ELSE 0 END +
            LEAST(LN(GREATEST(vc.email_count, 1)) / LN(10000) * 10, 10) +
            CASE WHEN vrs.created_at >= NOW() - interval '6 hours' THEN 10
                 WHEN vrs.created_at >= NOW() - interval '24 hours' THEN 8
                 WHEN vrs.created_at >= NOW() - interval '3 days' THEN 5
                 ELSE 2 END
          ) as score
        FROM vendor_req_signal vrs
        LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
        LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
        LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
        WHERE vrs.created_at >= NOW() - interval '7 days'
          AND vrs.title IS NOT NULL AND vrs.title != ''
      )
      SELECT
        COUNT(*)::int as "total",
        COUNT(*) FILTER (WHERE score >= 70)::int as "hot",
        COUNT(*) FILTER (WHERE score >= 50 AND score < 70)::int as "warm",
        COUNT(*) FILTER (WHERE score >= 30 AND score < 50)::int as "cool",
        COUNT(*) FILTER (WHERE score < 30)::int as "cold",
        ROUND(AVG(score)::numeric, 1) as "avgScore",
        ROUND(MAX(score)::numeric, 1) as "maxScore"
      FROM scored
    ` as any[];

    return {
      queue: queue.map((r: any) => ({
        id: r.id,
        title: r.title,
        location: r.location,
        rateText: r.rate_text,
        employmentType: r.employment_type,
        engagementModel: r.engagement_model,
        skills: r.skills,
        actionabilityScore: r.actionability_score,
        createdAt: r.created_at,
        vendorName: r.vendor_name,
        vendorDomain: r.vendor_domain,
        contactName: r.contact_name,
        contactEmail: r.contact_email,
        vendorTrust: r.vendor_trust,
        closureScore: Number(r.closureScore),
        closureProbability: Number(r.closureProbability),
        closureTier: r.closureTier,
        breakdown: {
          trust: Number(r.trust_pts),
          rate: Number(r.rate_pts),
          employment: Number(r.emp_pts),
          completeness: Number(r.complete_pts),
          vendorVolume: Number(r.volume_pts),
          benchMatch: Number(r.bench_pts || 0),
          freshness: Number(r.fresh_pts),
        },
      })),
      distribution: distribution[0] || {},
    };
  }

  /* ═══════ 8. RECRUITER WORKLOAD OPTIMIZATION ═══════ */

  async getRecruiterWorkload() {
    const cached = this.getCached('recruiterWorkload');
    if (cached) return cached;

    const workload = await this.prisma.$queryRaw`
      SELECT
        m.email as "recruiterEmail",
        SPLIT_PART(m.email, '@', 1) as "name",
        COALESCE(rq.assigned_today, 0)::int as "assignedToday",
        COALESCE(rq.submitted_today, 0)::int as "submittedToday",
        COALESCE(rq.skipped_today, 0)::int as "skippedToday",
        COALESCE(rq.in_progress, 0)::int as "inProgress",
        30 - COALESCE(rq.assigned_today, 0)::int as "remainingCapacity"
      FROM mailbox m
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE assigned_date = CURRENT_DATE) as assigned_today,
          COUNT(*) FILTER (WHERE assigned_date = CURRENT_DATE AND status = 'SUBMITTED') as submitted_today,
          COUNT(*) FILTER (WHERE assigned_date = CURRENT_DATE AND status = 'SKIPPED') as skipped_today,
          COUNT(*) FILTER (WHERE status = 'ASSIGNED' OR status = 'IN_PROGRESS') as in_progress
        FROM recruiter_queue rq2
        WHERE rq2.recruiter_email = m.email
      ) rq ON true
      WHERE m.email NOT IN ('akkayya.chavala@cloudresources.net', 'accounts@cloudresources.net', 'info@cloudresources.net')
      ORDER BY "remainingCapacity" DESC
    ` as any[];

    const wlResult = { workload, maxQueueSize: 30, date: new Date().toISOString().split('T')[0] };
    this.setCache('recruiterWorkload', wlResult, 120_000);
    return wlResult;
  }

  async autoAssignQueue() {
    const recruiters = await this.prisma.$queryRaw`
      SELECT m.email,
        COALESCE((
          SELECT COUNT(*) FROM recruiter_queue rq
          WHERE rq.recruiter_email = m.email AND rq.assigned_date = CURRENT_DATE
        ), 0)::int as today_count
      FROM mailbox m
      WHERE m.email NOT IN ('akkayya.chavala@cloudresources.net', 'accounts@cloudresources.net', 'info@cloudresources.net', 'jobs@cloudresources.net')
      ORDER BY today_count ASC, m.email
    ` as any[];

    const eligibleRecruiters = recruiters.filter((r: any) => r.today_count < 30);
    if (eligibleRecruiters.length === 0) {
      return { assigned: 0, message: 'All recruiters at capacity (30/day)' };
    }

    const unassigned = await this.prisma.$queryRaw`
      SELECT vrs.id,
        (
          LEAST(COALESCE(vts.trust_score, 0) * 0.25, 25) +
          CASE WHEN vrs.rate_text IS NOT NULL AND vrs.rate_text != '' THEN 20 ELSE 0 END +
          CASE vrs.employment_type WHEN 'C2C' THEN 15 WHEN 'W2' THEN 12 WHEN 'C2H' THEN 10 WHEN 'CONTRACT' THEN 8 ELSE 2 END +
          CASE WHEN vrs.title IS NOT NULL AND vrs.title != '' THEN 3 ELSE 0 END +
          CASE WHEN vrs.location IS NOT NULL THEN 2.5 ELSE 0 END +
          CASE WHEN vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0 THEN 2.5 ELSE 0 END +
          CASE WHEN vct.email IS NOT NULL THEN 2 ELSE 0 END +
          LEAST(LN(GREATEST(vc.email_count, 1)) / LN(10000) * 10, 10) +
          CASE WHEN vrs.created_at >= NOW() - interval '6 hours' THEN 10
               WHEN vrs.created_at >= NOW() - interval '24 hours' THEN 8
               WHEN vrs.created_at >= NOW() - interval '3 days' THEN 5
               ELSE 2 END
        ) as closure_score
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      WHERE vrs.created_at >= NOW() - interval '3 days'
        AND vrs.actionability_score >= 40
        AND vrs.title IS NOT NULL AND vrs.title != ''
        AND vrs.employment_type IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM recruiter_queue rq
          WHERE rq.req_signal_id = vrs.id AND rq.assigned_date = CURRENT_DATE
        )
      ORDER BY closure_score DESC
      LIMIT ${eligibleRecruiters.length * 30}
    ` as any[];

    let assigned = 0;
    let recruiterIdx = 0;
    const capacity = new Map(eligibleRecruiters.map((r: any) => [r.email, 30 - r.today_count]));

    for (const req of unassigned) {
      const recruiter = eligibleRecruiters[recruiterIdx % eligibleRecruiters.length];
      const cap = capacity.get(recruiter.email) || 0;
      if (cap <= 0) {
        recruiterIdx++;
        if (recruiterIdx >= eligibleRecruiters.length) break;
        continue;
      }

      try {
        await this.prisma.$executeRaw`
          INSERT INTO recruiter_queue (recruiter_email, req_signal_id, assigned_date, closure_score, status)
          VALUES (${recruiter.email}, ${req.id}::uuid, CURRENT_DATE, ${Number(req.closure_score)}, 'ASSIGNED')
          ON CONFLICT (recruiter_email, req_signal_id, assigned_date) DO NOTHING
        `;
        capacity.set(recruiter.email, cap - 1);
        assigned++;
        recruiterIdx++;
      } catch {
        continue;
      }
    }

    return {
      assigned,
      recruiters: eligibleRecruiters.map((r: any) => ({
        email: r.email,
        previousCount: r.today_count,
        newCount: r.today_count + (30 - (capacity.get(r.email) || 0) - r.today_count),
      })),
    };
  }

  async updateQueueItem(id: number, status: string) {
    await this.prisma.$executeRaw`
      UPDATE recruiter_queue SET status = ${status}, updated_at = NOW() WHERE id = ${id}
    `;
    return { success: true };
  }

  /* ═══════ 9. VENDOR CONVERSION FEEDBACK LOOPS ═══════ */

  async getVendorFeedbackLoop() {
    const cached = this.getCached('vendorFeedback');
    if (cached) return cached;

    const feedbackByVendor = await this.prisma.$queryRaw`
      WITH sub_events AS (
        SELECT
          SPLIT_PART(COALESCE(
            (SELECT t FROM unnest(to_emails) t WHERE SPLIT_PART(t,'@',2) NOT IN ('cloudresources.net','emonics.com','') LIMIT 1),
            ''
          ), '@', 2) as vendor_domain,
          mailbox_email as recruiter,
          subject,
          sent_at,
          id as eid
        FROM raw_email_message
        WHERE from_email LIKE '%@cloudresources.net'
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%')
          AND sent_at >= NOW() - interval '90 days'
      ),
      reply_events AS (
        SELECT
          SPLIT_PART(from_email, '@', 2) as vendor_domain,
          mailbox_email as recruiter,
          subject,
          sent_at,
          CASE
            WHEN subject ILIKE '%interview%' THEN 'INTERVIEW_REQUEST'
            WHEN subject ILIKE '%reject%' OR subject ILIKE '%not selected%' OR subject ILIKE '%not moving%' THEN 'REJECTION'
            WHEN subject ILIKE '%offer%' THEN 'OFFER'
            WHEN subject ILIKE '%more info%' OR subject ILIKE '%additional%' THEN 'INFO_REQUEST'
            ELSE 'REPLY'
          END as feedback_type
        FROM raw_email_message
        WHERE from_email NOT LIKE '%@cloudresources.net'
          AND from_email NOT LIKE '%@emonics.com'
          AND subject ILIKE '%Re:%Submission%'
          AND sent_at >= NOW() - interval '90 days'
      )
      SELECT
        s.vendor_domain as "vendorDomain",
        COUNT(DISTINCT s.eid)::int as "submissionsSent",
        COUNT(DISTINCT r.subject)::int as "totalReplies",
        COUNT(DISTINCT r.subject) FILTER (WHERE r.feedback_type = 'INTERVIEW_REQUEST')::int as "interviewRequests",
        COUNT(DISTINCT r.subject) FILTER (WHERE r.feedback_type = 'REJECTION')::int as "rejections",
        COUNT(DISTINCT r.subject) FILTER (WHERE r.feedback_type = 'OFFER')::int as "offers",
        COUNT(DISTINCT r.subject) FILTER (WHERE r.feedback_type = 'INFO_REQUEST')::int as "infoRequests",
        ROUND(
          CASE WHEN COUNT(DISTINCT s.eid) > 0
            THEN COUNT(DISTINCT r.subject)::numeric / COUNT(DISTINCT s.eid) * 100
            ELSE 0
          END, 1
        ) as "replyRate",
        ROUND(
          CASE WHEN COUNT(DISTINCT s.eid) > 0
            THEN COUNT(DISTINCT r.subject) FILTER (WHERE r.feedback_type = 'INTERVIEW_REQUEST')::numeric / COUNT(DISTINCT s.eid) * 100
            ELSE 0
          END, 1
        ) as "interviewRate"
      FROM sub_events s
      LEFT JOIN reply_events r ON r.vendor_domain = s.vendor_domain AND r.recruiter = s.recruiter
      WHERE s.vendor_domain != '' AND s.vendor_domain IS NOT NULL
      GROUP BY s.vendor_domain
      HAVING COUNT(DISTINCT s.eid) >= 2
      ORDER BY "interviewRate" DESC, "submissionsSent" DESC
      LIMIT 50
    ` as any[];

    const summary = await this.prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE
          from_email LIKE '%@cloudresources.net'
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%')
          AND sent_at >= NOW() - interval '90 days'
        )::int as "totalSubmissions90d",
        COUNT(*) FILTER (WHERE
          from_email NOT LIKE '%@cloudresources.net'
          AND subject ILIKE '%Re:%Submission%'
          AND sent_at >= NOW() - interval '90 days'
        )::int as "totalReplies90d",
        COUNT(*) FILTER (WHERE
          subject ILIKE '%interview%'
          AND from_email NOT LIKE '%@cloudresources.net'
          AND sent_at >= NOW() - interval '90 days'
        )::int as "interviewSignals90d",
        COUNT(*) FILTER (WHERE
          (subject ILIKE '%offer%letter%' OR (subject ILIKE '%offer%' AND subject ILIKE '%accept%'))
          AND from_email NOT LIKE '%@cloudresources.net'
          AND sent_at >= NOW() - interval '90 days'
        )::int as "offerSignals90d"
      FROM raw_email_message
    ` as any[];

    const fbResult = { vendors: feedbackByVendor, summary: summary[0] || {} };
    this.setCache('vendorFeedback', fbResult, 300_000);
    return fbResult;
  }

  /* ═══════ 10. BENCH READINESS AUTOMATION ═══════ */

  async computeBenchReadiness() {
    const cached = this.getCached('benchReadiness');
    if (cached) return cached;

    const consultants = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c."firstName",
        c."lastName",
        c.email,
        c.skills,
        c.readiness,
        c."desiredRate",
        c."currentRate",
        c."availableFrom",
        c."trustScore",
        c."verificationStatus",
        c."verificationChecklist",

        -- Document completeness: check ComplianceDocument count
        COALESCE((
          SELECT COUNT(*)::int FROM "ComplianceDocument" cd
          WHERE cd."entityId" = c.id AND cd."entityType" = 'CONSULTANT'
        ), 0) as doc_count,

        -- Work authorization: current and not expired
        COALESCE((
          SELECT CASE
            WHEN cwa."isCurrent" = true AND (cwa."expiryDate" IS NULL OR cwa."expiryDate" > NOW()) THEN 'ACTIVE'
            WHEN cwa."isCurrent" = true THEN 'EXPIRING'
            ELSE 'INACTIVE'
          END
          FROM "ConsultantWorkAuth" cwa WHERE cwa."consultantId" = c.id
          ORDER BY cwa."createdAt" DESC LIMIT 1
        ), 'UNKNOWN') as work_auth_status,

        -- Active assignments
        COALESCE((
          SELECT COUNT(*)::int FROM "Assignment" a WHERE a."consultantId" = c.id AND a.status = 'ACTIVE'
        ), 0) as active_assignments,

        -- Total past assignments
        COALESCE((
          SELECT COUNT(*)::int FROM "Assignment" a WHERE a."consultantId" = c.id
        ), 0) as total_assignments

      FROM "Consultant" c
      WHERE c.readiness NOT IN ('OFFBOARDED')
      ORDER BY c."createdAt" DESC
    ` as any[];

    const skillDemand = await this.prisma.$queryRaw`
      SELECT LOWER(unnest(skills)) as skill, COUNT(*)::int as demand
      FROM vendor_req_signal
      WHERE created_at >= NOW() - interval '7 days'
      GROUP BY 1
      ORDER BY demand DESC
      LIMIT 100
    ` as any[];

    const demandMap = new Map(skillDemand.map((s: any) => [s.skill, s.demand]));
    const maxDemand = Math.max(...skillDemand.map((s: any) => s.demand), 1);

    const scored = consultants.map((c: any) => {
      const skills = Array.isArray(c.skills) ? c.skills : [];

      // Skills freshness / market demand (0-30)
      let skillScore = 0;
      const matchingSkills: string[] = [];
      for (const sk of skills) {
        const d = demandMap.get(String(sk).toLowerCase()) || 0;
        if (d > 0) {
          matchingSkills.push(String(sk));
          skillScore += (d / maxDemand) * 10;
        }
      }
      skillScore = Math.min(skillScore, 30);

      // Doc completeness (0-20)
      const docScore = Math.min(c.doc_count * 5, 20);

      // Availability (0-25)
      let availScore = 0;
      if (c.readiness === 'SUBMISSION_READY') availScore = 25;
      else if (c.readiness === 'VERIFIED') availScore = 20;
      else if (c.readiness === 'DOCS_PENDING') availScore = 10;
      else if (c.readiness === 'NEW') availScore = 5;
      else if (c.readiness === 'ON_ASSIGNMENT') availScore = 0;

      if (c.availableFrom && new Date(c.availableFrom) <= new Date()) availScore = Math.min(availScore + 5, 25);

      // Experience / trust (0-15)
      let expScore = Math.min(c.total_assignments * 5, 10);
      if (c.trustScore) expScore += Math.min(c.trustScore / 20, 5);

      // Work auth (0-10)
      let authScore = 0;
      if (c.work_auth_status === 'APPROVED' || c.work_auth_status === 'ACTIVE') authScore = 10;
      else if (c.work_auth_status === 'PENDING') authScore = 5;

      const overall = skillScore + docScore + availScore + expScore + authScore;
      const tier = overall >= 70 ? 'HOT' : overall >= 50 ? 'WARM' : overall >= 30 ? 'READY' : 'COLD';

      return {
        consultantId: c.id,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
        email: c.email,
        readiness: c.readiness,
        overallScore: Math.round(overall * 10) / 10,
        tier,
        breakdown: {
          skillsDemand: Math.round(skillScore * 10) / 10,
          docCompleteness: docScore,
          availability: availScore,
          experience: Math.round(expScore * 10) / 10,
          workAuth: authScore,
        },
        matchingSkills: matchingSkills.slice(0, 10),
        desiredRate: c.desiredRate,
        currentRate: c.currentRate,
        activeAssignments: c.active_assignments,
      };
    });

    scored.sort((a: any, b: any) => b.overallScore - a.overallScore);

    // Upsert scores into bench_readiness_score
    for (const s of scored) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO bench_readiness_score (consultant_id, overall_score, skills_freshness, doc_completeness, availability_score, market_demand, readiness_tier, top_matching_skills, computed_at)
          VALUES (${s.consultantId}, ${s.overallScore}, ${s.breakdown.skillsDemand}, ${s.breakdown.docCompleteness}, ${s.breakdown.availability}, ${s.breakdown.skillsDemand}, ${s.tier}, ${s.matchingSkills}::text[], NOW())
          ON CONFLICT (consultant_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            skills_freshness = EXCLUDED.skills_freshness,
            doc_completeness = EXCLUDED.doc_completeness,
            availability_score = EXCLUDED.availability_score,
            market_demand = EXCLUDED.market_demand,
            readiness_tier = EXCLUDED.readiness_tier,
            top_matching_skills = EXCLUDED.top_matching_skills,
            computed_at = NOW()
        `;
      } catch (e) {
        this.logger.warn(`Failed to upsert bench score for ${s.consultantId}: ${e}`);
      }
    }

    const tierSummary = {
      hot: scored.filter((s: any) => s.tier === 'HOT').length,
      warm: scored.filter((s: any) => s.tier === 'WARM').length,
      ready: scored.filter((s: any) => s.tier === 'READY').length,
      cold: scored.filter((s: any) => s.tier === 'COLD').length,
      total: scored.length,
    };

    const brResult = { consultants: scored, summary: tierSummary };
    this.setCache('benchReadiness', brResult, 300_000);
    return brResult;
  }

  private generateQualityStrategy(breakdown: any[], junkPatterns: any[]): string[] {
    const strategies: string[] = [];
    const premium = breakdown.find((b: any) => b.tier === 'PREMIUM');
    const junk = breakdown.find((b: any) => b.tier === 'JUNK');
    const total = breakdown.reduce((s: number, b: any) => s + b.count, 0);

    if (premium) {
      const premiumPct = ((premium.count / total) * 100).toFixed(1);
      strategies.push(`PREMIUM reqs are ${premiumPct}% of total (${premium.count}). Focus submissions here first — these have high vendor trust + complete data.`);
    }

    if (junk && junk.count > total * 0.3) {
      strategies.push(`${junk.count} JUNK reqs (${((junk.count / total) * 100).toFixed(0)}%) are noise. Auto-archive these to save recruiter time.`);
    }

    const noContact = junkPatterns.find((p: any) => p.pattern === 'No vendor contact');
    if (noContact && noContact.count > total * 0.2) {
      strategies.push(`${noContact.count} reqs have no vendor contact — these are unactionable. Prioritize vendors who include recruiter contact in emails.`);
    }

    const noC2C = junkPatterns.find((p: any) => p.pattern === 'Contains no-C2C/no-third-party');
    if (noC2C && noC2C.count > 0) {
      strategies.push(`${noC2C.count} reqs explicitly block C2C/third-party. Auto-filter these to avoid wasted submissions.`);
    }

    strategies.push('Build vendor whitelist from TOP 122 HIGH-trust vendors. Route their reqs directly to recruiter inbox with priority flag.');
    strategies.push('For MODERATE reqs: auto-enrich missing fields (location, rate) from email body before classification.');
    strategies.push('Track submission-to-response ratio per vendor. Drop vendors with ghost rate >80% from daily action list.');

    return strategies;
  }

  /* ═══════ 11. RECONCILE EXTRACTED CONSULTANTS → PRISMA ═══════ */

  async reconcileConsultants(tenantId: string) {
    const extracted = await this.prisma.$queryRaw`
      SELECT c.id as ext_id, c.full_name, c.email, c.phone, c.primary_skills,
             c.first_seen, c.last_seen
      FROM consultant c
      WHERE c.full_name IS NOT NULL AND c.full_name != ''
        AND c.email IS NOT NULL AND c.email != ''
        AND c.email NOT LIKE '%@cloudresources.net'
        AND c.email NOT LIKE '%@emonics.com'
        AND c.email NOT LIKE '%noreply%'
        AND c.email NOT LIKE '%linkedin.com%'
        AND c.email NOT LIKE '%google.com%'
        AND c.email NOT LIKE '%microsoft.com%'
        AND LENGTH(c.full_name) > 3
        AND c.full_name NOT IN ('LinkedIn', 'Indeed', 'Dice', 'Monster', 'Gmail')
        AND NOT EXISTS (
          SELECT 1 FROM "Consultant" pc WHERE LOWER(pc.email) = LOWER(c.email)
        )
      ORDER BY c.last_seen DESC
      LIMIT 5000
    ` as any[];

    let imported = 0;
    let skipped = 0;

    for (const c of extracted) {
      try {
        const parts = (c.full_name || '').trim().split(/\s+/);
        const firstName = parts[0] || 'Unknown';
        const lastName = parts.slice(1).join(' ') || '';

        const skills = Array.isArray(c.primary_skills) ? c.primary_skills : [];
        const skillsJson = JSON.stringify(skills.map((s: string) => String(s).trim()).filter(Boolean));

        await this.prisma.$executeRaw`
          INSERT INTO "Consultant" (id, "tenantId", "firstName", "lastName", email, phone, skills, readiness, "verificationStatus", "createdAt", "updatedAt")
          VALUES (
            'ext_' || ${c.ext_id}::text,
            ${tenantId},
            ${firstName},
            ${lastName},
            ${c.email},
            ${c.phone || null},
            ${skillsJson}::jsonb,
            'NEW'::"ConsultantReadiness",
            'UNVERIFIED'::"VerificationStatus",
            ${c.first_seen || new Date()},
            NOW()
          )
          ON CONFLICT (id) DO NOTHING
        `;
        imported++;
      } catch (e) {
        skipped++;
      }
    }

    return {
      extracted: extracted.length,
      imported,
      skipped,
      totalConsultantsNow: await this.prisma.consultant.count(),
    };
  }

  /* ═══════ 12. IMPORT EMAIL SUBMISSION SIGNALS → FORMAL SUBMISSIONS ═══════ */

  async importEmailSubmissions(tenantId: string) {
    const signals = await this.prisma.$queryRaw`
      SELECT
        r.id as email_id,
        r.mailbox_email as recruiter_email,
        r.subject,
        r.sent_at,
        r.from_email,
        COALESCE(
          (SELECT t FROM unnest(r.to_emails) t WHERE SPLIT_PART(t,'@',2) NOT IN ('cloudresources.net','emonics.com','') LIMIT 1),
          ''
        ) as vendor_email,
        SPLIT_PART(COALESCE(
          (SELECT t FROM unnest(r.to_emails) t WHERE SPLIT_PART(t,'@',2) NOT IN ('cloudresources.net','emonics.com','') LIMIT 1),
          ''
        ), '@', 2) as vendor_domain
      FROM raw_email_message r
      WHERE r.from_email LIKE '%@cloudresources.net'
        AND (r.subject ILIKE 'Submission -%' OR r.subject ILIKE 'Submission –%')
        AND EXISTS (SELECT 1 FROM unnest(r.to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
      ORDER BY r.sent_at DESC
      LIMIT 3000
    ` as any[];

    let created = 0;
    let skipped = 0;

    const consultantPool = await this.prisma.consultant.findMany({
      where: { tenantId, readiness: { in: ['SUBMISSION_READY', 'VERIFIED', 'NEW'] } },
      select: { id: true, userId: true },
      take: 50,
    });
    if (consultantPool.length === 0) {
      return { signalsFound: signals.length, created: 0, skipped: signals.length, error: 'No eligible consultants' };
    }

    for (const sig of signals) {
      try {
        let vendor = await this.prisma.vendor.findFirst({
          where: { tenantId, domain: sig.vendor_domain },
        });
        if (!vendor && sig.vendor_domain) {
          vendor = await this.prisma.vendor.create({
            data: {
              tenantId,
              companyName: sig.vendor_domain,
              domain: sig.vendor_domain,
              contactEmail: sig.vendor_email || undefined,
            },
          });
        }
        if (!vendor) { skipped++; continue; }

        const existingJob = await this.prisma.job.findFirst({
          where: { tenantId, vendorId: vendor.id, title: sig.subject },
        });

        const job = existingJob || await this.prisma.job.create({
          data: {
            tenantId,
            vendorId: vendor.id,
            title: sig.subject || 'Email Submission',
            description: `[Email submission] From: ${sig.recruiter_email} To: ${sig.vendor_email} Date: ${sig.sent_at}`,
            status: 'ACTIVE',
          },
        });

        // Check if this specific email was already imported
        const alreadyImported = await this.prisma.$queryRaw`
          SELECT id FROM "Submission" WHERE notes LIKE ${'%' + sig.email_id + '%'} LIMIT 1
        ` as any[];
        if (alreadyImported.length > 0) { skipped++; continue; }

        // Pick consultant from pool (rotate)
        if (!consultantPool) {
          skipped++; continue;
        }
        const consultant = consultantPool[created % consultantPool.length]!;

        await this.prisma.submission.create({
          data: {
            tenantId,
            jobId: job.id,
            consultantId: consultant.id,
            submittedById: consultant.userId || consultant.id,
            submitterType: 'USER',
            status: 'SUBMITTED',
            notes: `[email-import] ${sig.recruiter_email} → ${sig.vendor_email} | ref:${sig.email_id}`,
            createdAt: new Date(sig.sent_at),
          } as any,
        });
        created++;
      } catch (e: any) {
        skipped++;
        if (created === 0 && skipped <= 3) {
          this.logger.warn(`Submission import error (sample): ${e?.message || e}`);
        }
      }
    }

    return { signalsFound: signals.length, created, skipped };
  }

  /* ═══════ 13. POPULATE VENDOR FEEDBACK EVENTS ═══════ */

  async populateVendorFeedbackEvents() {
    const result = await this.prisma.$executeRaw`
      INSERT INTO vendor_feedback_event (vendor_domain, recruiter_email, submission_subject, feedback_type, detected_at, raw_subject, confidence)
      SELECT
        SPLIT_PART(from_email, '@', 2) as vendor_domain,
        mailbox_email as recruiter_email,
        subject as submission_subject,
        CASE
          WHEN subject ILIKE '%interview%schedule%' OR subject ILIKE '%schedule%interview%' THEN 'INTERVIEW_SCHEDULED'
          WHEN subject ILIKE '%interview%' THEN 'INTERVIEW_REQUEST'
          WHEN subject ILIKE '%reject%' OR subject ILIKE '%not selected%' OR subject ILIKE '%not move%forward%' OR subject ILIKE '%unfortunately%' THEN 'REJECTION'
          WHEN subject ILIKE '%offer%' AND subject NOT ILIKE '%we offer%' THEN 'OFFER'
          WHEN subject ILIKE '%more info%' OR subject ILIKE '%additional%detail%' OR subject ILIKE '%clarif%' THEN 'INFO_REQUEST'
          WHEN subject ILIKE '%shortlist%' OR subject ILIKE '%selected%' THEN 'SHORTLISTED'
          ELSE 'REPLY'
        END as feedback_type,
        sent_at as detected_at,
        subject as raw_subject,
        CASE
          WHEN subject ILIKE '%interview%schedule%' THEN 0.9
          WHEN subject ILIKE '%reject%' OR subject ILIKE '%not selected%' THEN 0.85
          WHEN subject ILIKE '%offer%' THEN 0.8
          WHEN subject ILIKE '%interview%' THEN 0.7
          ELSE 0.5
        END as confidence
      FROM raw_email_message
      WHERE from_email NOT LIKE '%@cloudresources.net'
        AND from_email NOT LIKE '%@emonics.com'
        AND subject ILIKE '%Re:%Submission%'
        AND sent_at >= NOW() - interval '180 days'
        AND NOT EXISTS (
          SELECT 1 FROM vendor_feedback_event vfe
          WHERE vfe.raw_subject = subject
            AND vfe.recruiter_email = mailbox_email
            AND vfe.detected_at = sent_at
        )
    `;
    
    const summary = await this.prisma.$queryRaw`
      SELECT feedback_type as "type", COUNT(*)::int as "count"
      FROM vendor_feedback_event GROUP BY 1 ORDER BY 2 DESC
    ` as any[];

    return { inserted: Number(result), summary };
  }

  /* ═══════ 14. OUTCOME CAPTURE: auto-update submission status from email ═══════ */

  async captureOutcomes(tenantId: string) {
    const interviewSignals = await this.prisma.$queryRaw`
      SELECT DISTINCT s.id as submission_id, s.status,
        r.subject as trigger_subject, r.sent_at
      FROM "Submission" s
      JOIN "Job" j ON j.id = s."jobId"
      JOIN "Vendor" v ON v.id = j."vendorId"
      JOIN raw_email_message r ON
        r.subject ILIKE '%interview%'
        AND r.from_email NOT LIKE '%@cloudresources.net'
        AND SPLIT_PART(r.from_email, '@', 2) = v.domain
        AND r.sent_at > s."createdAt"
        AND r.sent_at <= s."createdAt" + interval '30 days'
      WHERE s."tenantId" = ${tenantId}
        AND s.status = 'SUBMITTED'
      LIMIT 100
    ` as any[];

    let updated = 0;
    for (const sig of interviewSignals) {
      try {
        await this.prisma.submission.update({
          where: { id: sig.submission_id },
          data: {
            status: 'INTERVIEWING',
            vendorFeedback: `Interview signal detected: ${sig.trigger_subject}`,
            feedbackReceivedAt: new Date(sig.sent_at),
          },
        });
        updated++;
      } catch { /* skip */ }
    }

    const offerSignals = await this.prisma.$queryRaw`
      SELECT DISTINCT s.id as submission_id,
        r.subject as trigger_subject, r.sent_at
      FROM "Submission" s
      JOIN "Job" j ON j.id = s."jobId"
      JOIN "Vendor" v ON v.id = j."vendorId"
      JOIN raw_email_message r ON
        (r.subject ILIKE '%offer%letter%' OR r.subject ILIKE '%offer%extend%')
        AND r.from_email NOT LIKE '%@cloudresources.net'
        AND SPLIT_PART(r.from_email, '@', 2) = v.domain
        AND r.sent_at > s."createdAt"
      WHERE s."tenantId" = ${tenantId}
        AND s.status IN ('SUBMITTED', 'INTERVIEWING')
      LIMIT 50
    ` as any[];

    let offers = 0;
    for (const sig of offerSignals) {
      try {
        await this.prisma.submission.update({
          where: { id: sig.submission_id },
          data: {
            status: 'OFFERED',
            vendorFeedback: `Offer signal: ${sig.trigger_subject}`,
            feedbackReceivedAt: new Date(sig.sent_at),
          },
        });
        offers++;
      } catch { /* skip */ }
    }

    return { interviewsDetected: updated, offersDetected: offers };
  }

  /* ═══════ 15. VENDOR WHITELIST / BLACKLIST ═══════ */

  async computeVendorWhitelistBlacklist() {
    const cached = this.getCached('vendorReputation');
    if (cached) return cached;

    const summary = await this.prisma.$queryRaw`
      SELECT list_status as "status", COUNT(*)::int as "count"
      FROM vendor_reputation GROUP BY 1 ORDER BY 2 DESC
    ` as any[];

    const topWhitelist = await this.prisma.$queryRaw`
      SELECT vendor_domain as "vendorDomain", vendor_name as "vendorName",
        reply_rate as "replyRate", interview_count as "interviews",
        total_reqs as "reqs", ghost_rate as "ghostRate"
      FROM vendor_reputation WHERE list_status = 'WHITELIST'
      ORDER BY total_reqs DESC LIMIT 20
    ` as any[];

    const topBlacklist = await this.prisma.$queryRaw`
      SELECT vendor_domain as "vendorDomain", vendor_name as "vendorName",
        ghost_rate as "ghostRate", total_reqs as "reqs"
      FROM vendor_reputation WHERE list_status = 'BLACKLIST'
      ORDER BY ghost_rate DESC LIMIT 20
    ` as any[];

    const total = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as "total" FROM vendor_reputation
    ` as any[];

    const repResult = { total: total[0]?.total || 0, summary, topWhitelist, topBlacklist };
    this.setCache('vendorReputation', repResult, 300_000);
    return repResult;
  }

  /* ═══════ 16. RATE INTELLIGENCE ═══════ */

  async buildRateIntelligence() {
    const cached = this.getCached('rateIntelligence');
    if (cached) return cached;
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS rate_intelligence (
        id SERIAL PRIMARY KEY,
        skill TEXT NOT NULL,
        location TEXT,
        employment_type TEXT,
        sample_count INT DEFAULT 0,
        rate_min FLOAT,
        rate_max FLOAT,
        rate_avg FLOAT,
        rate_median FLOAT,
        rate_p25 FLOAT,
        rate_p75 FLOAT,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(skill, location, employment_type)
      )
    `;

    const rateData = await this.prisma.$queryRaw`
      WITH parsed_rates AS (
        SELECT
          unnest(skills) as skill,
          COALESCE(NULLIF(location, ''), 'Unknown') as location,
          COALESCE(employment_type, 'CONTRACT') as employment_type,
          (regexp_matches(rate_text, '\\$?(\\d+(?:\\.\\d+)?)', 'g'))[1]::float as rate_val
        FROM vendor_req_signal
        WHERE rate_text IS NOT NULL AND rate_text != ''
          AND rate_text ~ '\\d'
          AND created_at >= NOW() - interval '90 days'
      ),
      filtered AS (
        SELECT skill, location, employment_type, rate_val
        FROM parsed_rates
        WHERE rate_val BETWEEN 15 AND 300
      )
      SELECT
        LOWER(skill) as skill,
        location,
        employment_type,
        COUNT(*)::int as sample_count,
        ROUND(MIN(rate_val)::numeric, 2) as rate_min,
        ROUND(MAX(rate_val)::numeric, 2) as rate_max,
        ROUND(AVG(rate_val)::numeric, 2) as rate_avg,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate_val)::numeric, 2) as rate_median,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY rate_val)::numeric, 2) as rate_p25,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY rate_val)::numeric, 2) as rate_p75
      FROM filtered
      GROUP BY LOWER(skill), location, employment_type
      HAVING COUNT(*) >= 5
      ORDER BY sample_count DESC
      LIMIT 2000
    ` as any[];

    let inserted = 0;
    for (const r of rateData) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO rate_intelligence (skill, location, employment_type, sample_count, rate_min, rate_max, rate_avg, rate_median, rate_p25, rate_p75, computed_at)
          VALUES (${r.skill}, ${r.location}, ${r.employment_type}, ${r.sample_count}, ${Number(r.rate_min)}, ${Number(r.rate_max)}, ${Number(r.rate_avg)}, ${Number(r.rate_median)}, ${Number(r.rate_p25)}, ${Number(r.rate_p75)}, NOW())
          ON CONFLICT (skill, location, employment_type) DO UPDATE SET
            sample_count = EXCLUDED.sample_count, rate_min = EXCLUDED.rate_min, rate_max = EXCLUDED.rate_max,
            rate_avg = EXCLUDED.rate_avg, rate_median = EXCLUDED.rate_median, rate_p25 = EXCLUDED.rate_p25,
            rate_p75 = EXCLUDED.rate_p75, computed_at = NOW()
        `;
        inserted++;
      } catch { /* skip duplicates */ }
    }

    const topRates = await this.prisma.$queryRaw`
      SELECT skill, location, employment_type, sample_count, rate_min, rate_max, rate_avg, rate_median
      FROM rate_intelligence ORDER BY sample_count DESC LIMIT 30
    ` as any[];

    const rateResult = { totalRateCards: inserted, topRates };
    this.setCache('rateIntelligence', rateResult, 300_000);
    return rateResult;
  }

  /* ═══════ 17. SKILL POD ASSIGNMENT ═══════ */

  async autoAssignBySkillPod() {
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS recruiter_skill_pod (
        id SERIAL PRIMARY KEY,
        recruiter_email TEXT NOT NULL,
        skill TEXT NOT NULL,
        proficiency FLOAT DEFAULT 1.0,
        submission_count INT DEFAULT 0,
        interview_rate FLOAT DEFAULT 0,
        computed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(recruiter_email, skill)
      )
    `;

    // Build recruiter skill profiles from email history
    await this.prisma.$executeRaw`
      INSERT INTO recruiter_skill_pod (recruiter_email, skill, submission_count, computed_at)
      SELECT
        r.mailbox_email,
        LOWER(unnest(vrs.skills)) as skill,
        COUNT(*)::int as sub_count,
        NOW()
      FROM raw_email_message r
      JOIN vendor_req_signal vrs ON vrs.raw_email_id = r.id
      WHERE r.from_email = r.mailbox_email
        AND (r.subject ILIKE 'Submission -%' OR r.subject ILIKE 'Submission –%' OR r.subject ILIKE 'Re:%')
        AND vrs.skills IS NOT NULL AND array_length(vrs.skills, 1) > 0
      GROUP BY r.mailbox_email, LOWER(unnest(vrs.skills))
      HAVING COUNT(*) >= 2
      ON CONFLICT (recruiter_email, skill) DO UPDATE SET
        submission_count = EXCLUDED.submission_count,
        computed_at = NOW()
    `;

    // Now do skill-matched assignment
    const recruiters = await this.prisma.$queryRaw`
      SELECT m.email,
        COALESCE((
          SELECT COUNT(*) FROM recruiter_queue rq
          WHERE rq.recruiter_email = m.email AND rq.assigned_date = CURRENT_DATE
        ), 0)::int as today_count,
        ARRAY(
          SELECT rsp.skill FROM recruiter_skill_pod rsp
          WHERE rsp.recruiter_email = m.email
          ORDER BY rsp.submission_count DESC LIMIT 10
        ) as top_skills
      FROM mailbox m
      WHERE m.email NOT IN ('akkayya.chavala@cloudresources.net', 'accounts@cloudresources.net', 'info@cloudresources.net', 'jobs@cloudresources.net')
      ORDER BY today_count ASC
    ` as any[];

    const eligible = recruiters.filter((r: any) => r.today_count < 30);
    if (eligible.length === 0) return { assigned: 0, message: 'All recruiters at capacity' };

    const unassigned = await this.prisma.$queryRaw`
      SELECT vrs.id, vrs.skills
      FROM vendor_req_signal vrs
      WHERE vrs.created_at >= NOW() - interval '3 days'
        AND vrs.actionability_score >= 40
        AND vrs.title IS NOT NULL AND vrs.title != ''
        AND vrs.employment_type IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM recruiter_queue rq
          WHERE rq.req_signal_id = vrs.id AND rq.assigned_date = CURRENT_DATE
        )
      ORDER BY vrs.actionability_score DESC
      LIMIT 500
    ` as any[];

    let assigned = 0;
    const capacity = new Map(eligible.map((r: any) => [r.email, 30 - r.today_count]));

    for (const req of unassigned) {
      const reqSkills = new Set((req.skills || []).map((s: string) => s.toLowerCase()));

      // Find best-matched recruiter by skill overlap
      let bestRecruiter: any = null;
      let bestOverlap = -1;

      for (const r of eligible) {
        const cap = capacity.get(r.email) || 0;
        if (cap <= 0) continue;

        const recruiterSkills = new Set(r.top_skills || []);
        let overlap = 0;
        for (const s of reqSkills) {
          if (recruiterSkills.has(s)) overlap++;
        }
        if (overlap > bestOverlap || (overlap === bestOverlap && (capacity.get(r.email) || 0) > (capacity.get(bestRecruiter?.email) || 0))) {
          bestOverlap = overlap;
          bestRecruiter = r;
        }
      }

      if (!bestRecruiter) {
        // Fallback: assign to recruiter with most capacity
        bestRecruiter = eligible.reduce((best: any, r: any) =>
          (capacity.get(r.email) || 0) > (capacity.get(best.email) || 0) ? r : best
        );
      }

      if (!bestRecruiter || (capacity.get(bestRecruiter.email) || 0) <= 0) break;

      try {
        await this.prisma.$executeRaw`
          INSERT INTO recruiter_queue (recruiter_email, req_signal_id, assigned_date, status)
          VALUES (${bestRecruiter.email}, ${req.id}::uuid, CURRENT_DATE, 'ASSIGNED')
          ON CONFLICT (recruiter_email, req_signal_id, assigned_date) DO NOTHING
        `;
        capacity.set(bestRecruiter.email, (capacity.get(bestRecruiter.email) || 1) - 1);
        assigned++;
      } catch { /* skip */ }
    }

    return {
      assigned,
      recruiterPods: eligible.map((r: any) => ({
        email: r.email,
        topSkills: r.top_skills,
        assignedToday: r.today_count + (30 - (capacity.get(r.email) || 0) - r.today_count),
      })),
    };
  }

  /* ═══════ 18. CLOSURE MODEL TRAINING ═══════ */

  async trainClosureModel() {
    const cached = this.getCached('closureModel');
    if (cached) return cached;

    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS closure_model_weights (
        id SERIAL PRIMARY KEY,
        feature TEXT NOT NULL UNIQUE,
        weight FLOAT NOT NULL DEFAULT 1.0,
        sample_size INT DEFAULT 0,
        trained_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const submissionStats = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'INTERVIEWING')::int as interviews,
        COUNT(*) FILTER (WHERE status IN ('OFFERED','ACCEPTED'))::int as offers,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int as rejections
      FROM "Submission"
    ` as any[];

    const stats = submissionStats[0];
    const totalOutcomes = stats.interviews + stats.offers + stats.rejections;

    if (totalOutcomes < 50) {
      // Not enough data — use heuristic weights and report
      const heuristicWeights = [
        { feature: 'vendor_trust', weight: 0.25, description: 'Vendor trust score (0-100 → 0-25pts)' },
        { feature: 'rate_presence', weight: 0.20, description: 'Rate disclosed in req' },
        { feature: 'employment_fit', weight: 0.15, description: 'C2C > W2 > C2H > FTE preference' },
        { feature: 'req_completeness', weight: 0.10, description: 'Title + location + skills + contact' },
        { feature: 'vendor_volume', weight: 0.10, description: 'Log-scaled email engagement' },
        { feature: 'bench_match', weight: 0.10, description: 'Skill overlap with bench' },
        { feature: 'freshness', weight: 0.10, description: 'Req age (<6h=10, <24h=8, <3d=5)' },
      ];

      for (const hw of heuristicWeights) {
        await this.prisma.$executeRaw`
          INSERT INTO closure_model_weights (feature, weight, sample_size, trained_at)
          VALUES (${hw.feature}, ${hw.weight}, ${totalOutcomes}, NOW())
          ON CONFLICT (feature) DO UPDATE SET weight = EXCLUDED.weight, sample_size = EXCLUDED.sample_size, trained_at = NOW()
        `;
      }

      return {
        modelType: 'heuristic',
        reason: `Only ${totalOutcomes} outcomes available (need 50+). Using heuristic weights.`,
        weights: heuristicWeights,
        submissionStats: stats,
        recommendation: 'Continue collecting submission outcomes. Model will auto-upgrade to data-driven at 50+ outcomes.',
      };
    }

    // Enough data — compute data-driven weights via feature correlation
    const featureCorrelations = await this.prisma.$queryRaw`
      WITH submission_features AS (
        SELECT s.id, s.status,
          CASE WHEN s.status IN ('INTERVIEWING','OFFERED','ACCEPTED') THEN 1 ELSE 0 END as positive,
          COALESCE(vts.trust_score, 0) / 100.0 as vendor_trust,
          CASE WHEN j.description LIKE '%$%' THEN 1 ELSE 0 END as rate_presence,
          CASE WHEN j.description ILIKE '%c2c%' THEN 1.0 WHEN j.description ILIKE '%w2%' THEN 0.8 ELSE 0.5 END as employment_fit,
          (CASE WHEN j.title IS NOT NULL THEN 0.3 ELSE 0 END +
           CASE WHEN j.location IS NOT NULL THEN 0.25 ELSE 0 END +
           CASE WHEN j.skills IS NOT NULL AND json_array_length(j.skills::json) > 0 THEN 0.25 ELSE 0 END +
           CASE WHEN v."contactEmail" IS NOT NULL THEN 0.2 ELSE 0 END) as req_completeness,
          LEAST(LN(GREATEST(COALESCE(vts.req_count, 1), 1)) / LN(10000), 1.0) as vendor_volume
        FROM "Submission" s
        JOIN "Job" j ON j.id = s."jobId"
        JOIN "Vendor" v ON v.id = j."vendorId"
        LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id::text = v.id
        WHERE s.status IN ('SUBMITTED','INTERVIEWING','OFFERED','ACCEPTED','REJECTED')
      )
      SELECT
        CORR(positive, vendor_trust) as trust_corr,
        CORR(positive, rate_presence) as rate_corr,
        CORR(positive, employment_fit) as emp_corr,
        CORR(positive, req_completeness) as complete_corr,
        CORR(positive, vendor_volume) as volume_corr,
        COUNT(*)::int as samples
      FROM submission_features
    ` as any[];

    const corr = featureCorrelations[0] || {};
    const rawWeights = {
      vendor_trust: Math.abs(Number(corr.trust_corr) || 0.25),
      rate_presence: Math.abs(Number(corr.rate_corr) || 0.2),
      employment_fit: Math.abs(Number(corr.emp_corr) || 0.15),
      req_completeness: Math.abs(Number(corr.complete_corr) || 0.1),
      vendor_volume: Math.abs(Number(corr.volume_corr) || 0.1),
      bench_match: 0.1,
      freshness: 0.1,
    };

    // Normalize to sum to 1.0
    const totalWeight = Object.values(rawWeights).reduce((a, b) => a + b, 0);
    const normalizedWeights = Object.entries(rawWeights).map(([feature, w]) => ({
      feature,
      weight: Math.round((w / totalWeight) * 100) / 100,
    }));

    for (const nw of normalizedWeights) {
      await this.prisma.$executeRaw`
        INSERT INTO closure_model_weights (feature, weight, sample_size, trained_at)
        VALUES (${nw.feature}, ${nw.weight}, ${corr.samples || 0}, NOW())
        ON CONFLICT (feature) DO UPDATE SET weight = EXCLUDED.weight, sample_size = EXCLUDED.sample_size, trained_at = NOW()
      `;
    }

    const modelResult = {
      modelType: 'data-driven',
      samples: corr.samples,
      correlations: corr,
      weights: normalizedWeights,
      submissionStats: stats,
    };
    this.setCache('closureModel', modelResult, 600_000);
    return modelResult;
  }

  /* ═══════ 19. SUBMISSION TEMPLATE A/B TESTING ═══════ */

  async getSubmissionTemplates() {
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS submission_template (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        variant TEXT NOT NULL DEFAULT 'A',
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        total_sent INT DEFAULT 0,
        reply_count INT DEFAULT 0,
        interview_count INT DEFAULT 0,
        reply_rate FLOAT DEFAULT 0,
        interview_rate FLOAT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Seed default templates if empty
    const [existing] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM submission_template
    ` as any[];

    if (existing.cnt === 0) {
      await this.prisma.$executeRaw`
        INSERT INTO submission_template (name, variant, subject_template, body_template) VALUES
        ('Concise', 'A',
         'Submission: {{candidateName}} – {{jobTitle}}',
         'Hi {{contactName}},\n\nPlease find attached the resume of {{candidateName}} for {{jobTitle}}{{location}}.\n\nAvailable immediately. Rate: {{rate}}. RTR confirmed.\n\nBest regards'),
        ('Detailed', 'B',
         'Submission: {{candidateName}} – {{jobTitle}} | {{skills}}',
         'Hi {{contactName}},\n\nI''d like to submit {{candidateName}} for the {{jobTitle}} position{{location}}.\n\nCandidate Highlights:\n- Skills: {{skills}}\n- Experience: {{experience}}\n- Rate: {{rate}}\n- Availability: Immediate\n- RTR: Confirmed\n\nResume attached. Happy to schedule a call at your convenience.\n\nBest regards'),
        ('Rate-Forward', 'C',
         'Submission: {{candidateName}} @ {{rate}} – {{jobTitle}}',
         'Hi {{contactName}},\n\n{{candidateName}} is available for {{jobTitle}}{{location}} at {{rate}}.\n\nKey skills match: {{skills}}\n\nResume attached. RTR confirmed. Available for interviews this week.\n\nBest regards')
      `;
    }

    const templates = await this.prisma.$queryRaw`
      SELECT * FROM submission_template ORDER BY variant
    ` as any[];

    return { templates };
  }

  /* ═══════ 20. LIVE JOB FEED — Last 24h C2C/W2/Contract ═══════ */

  async getLiveJobFeed(hours = 24, limit = 500, offset = 0) {
    const cacheKey = `liveFeed:${hours}:${limit}:${offset}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const cutoff = new Date(Date.now() - hours * 3600 * 1000);

    const feed = await this.prisma.$queryRaw`
      SELECT DISTINCT ON (vrs.title, rem.mailbox_email)
        vrs.id::text as id,
        vrs.title,
        COALESCE(vc.name, vc.domain, 'Unknown') as company,
        vrs.location,
        vrs.rate_text as "rateText",
        vrs.employment_type as "employmentType",
        vrs.engagement_model as "engagementModel",
        vrs.skills,
        vrs.actionability_score as "actionabilityScore",
        rem.sent_at as "receivedAt",
        'Email Intel' as source,
        COALESCE(vct.email, '') as "contactEmail",
        COALESCE(vct.name, '') as "contactName",
        vc.domain as "vendorDomain",
        COALESCE(vts.trust_score, 0) as "vendorTrust",
        COALESCE(rem.mailbox_email, '') as "receivedByEmail",
        COALESCE(rem.from_email, '') as "fromEmail",
        COALESCE(rem.from_name, '') as "fromName"
      FROM vendor_req_signal vrs
      JOIN raw_email_message rem ON rem.id = vrs.raw_email_id
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      WHERE rem.sent_at >= ${cutoff}
        AND vrs.employment_type IN ('C2C', 'W2', 'CONTRACT', 'C2H')
        AND vrs.title IS NOT NULL AND vrs.title != ''
        AND COALESCE(vrs.actionability_score, 50) >= 30
      ORDER BY vrs.title, rem.mailbox_email, rem.sent_at DESC
    ` as any[];

    feed.sort((a: any, b: any) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    const paginatedFeed = feed.slice(offset, offset + limit);

    const marketJobs = await this.prisma.$queryRaw`
      SELECT
        id::text as id,
        title,
        company,
        location,
        "rateText",
        "employmentType",
        "employmentType" as "engagementModel",
        skills,
        "actionabilityScore",
        "discoveredAt" as "receivedAt",
        source::text as source,
        COALESCE("recruiterEmail", '') as "contactEmail",
        COALESCE("recruiterName", '') as "contactName",
        COALESCE("companyDomain", '') as "vendorDomain",
        COALESCE("realnessScore", 50) as "vendorTrust",
        '' as "receivedByEmail",
        '' as "fromEmail",
        '' as "fromName",
        COALESCE("applyUrl", '') as "applyUrl",
        COALESCE("sourceUrl", '') as "sourceUrl"
      FROM "MarketJob"
      WHERE "discoveredAt" >= ${cutoff}
        AND "employmentType"::text IN ('C2C', 'W2', 'CONTRACT', 'C2H', 'CONTRACTOR', 'FULLTIME', 'UNKNOWN')
        AND COALESCE(("rawPayload"->>'isHighPaid')::boolean, false) = false
        AND (
          location ~ ', [A-Z]{2}$'
          OR location ~* ', USA'
          OR location ~* ', United States'
          OR location ~* ', India'
          OR location ~* 'Remote'
          OR location ~* ', US$'
          OR location IS NULL
          OR source::text IN ('CORPTOCORP', 'JSEARCH', 'DICE', 'ARBEITNOW')
        )
      ORDER BY "discoveredAt" DESC
      LIMIT 500
    ` as any[];

    const combined = [...paginatedFeed, ...marketJobs]
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    const stats = await this.prisma.$queryRaw`
      SELECT
        vrs.employment_type as type,
        COUNT(*)::int as count
      FROM vendor_req_signal vrs
      JOIN raw_email_message rem ON rem.id = vrs.raw_email_id
      WHERE rem.sent_at >= ${cutoff}
        AND vrs.employment_type IN ('C2C', 'W2', 'CONTRACT', 'C2H')
        AND vrs.title IS NOT NULL AND vrs.title != ''
      GROUP BY 1 ORDER BY 2 DESC
    ` as any[];

    const sourceBreakdown = [
      { source: 'Email Intel', count: paginatedFeed.length },
      { source: 'JSearch', count: marketJobs.filter((j: any) => j.source === 'JSEARCH').length },
      { source: 'Dice', count: marketJobs.filter((j: any) => j.source === 'DICE').length },
      { source: 'Arbeitnow', count: marketJobs.filter((j: any) => j.source === 'ARBEITNOW').length },
      { source: 'RemoteOK', count: marketJobs.filter((j: any) => j.source === 'REMOTEOK').length },
      { source: 'Other', count: marketJobs.filter((j: any) => !['JSEARCH','DICE','ARBEITNOW','REMOTEOK'].includes(j.source)).length },
    ].filter(s => s.count > 0);

    const liveFeedResult = {
      jobs: combined,
      total: combined.length,
      stats,
      sourceBreakdown,
      generatedAt: new Date().toISOString(),
    };
    this.setCache(cacheKey, liveFeedResult, 120_000);
    return liveFeedResult;
  }

  /* ═══════ High-Paid FAANG/Tech Feed ═══════ */

  private static readonly FAANG_COMPANIES = [
    'Google', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Microsoft', 'Nvidia',
    'Stripe', 'Airbnb', 'Databricks', 'Snowflake', 'Palantir', 'Cloudflare',
    'Pinterest', 'DoorDash', 'Coinbase', 'Robinhood', 'Figma', 'Discord',
    'Reddit', 'Block (Square)', 'Twilio', 'Datadog', 'MongoDB', 'CrowdStrike',
    'ServiceNow', 'Roblox', 'Notion', 'Plaid', 'OpenAI', 'Anthropic',
    'Scale AI', 'Salesforce', 'Oracle', 'Adobe', 'Intel', 'AMD',
    'Uber', 'Lyft', 'Shopify', 'Atlassian', 'Spotify', 'Tesla',
    'Cisco', 'VMware', 'Qualcomm', 'Broadcom', 'Palo Alto Networks',
    'HashiCorp', 'Elastic', 'Cockroach Labs', 'Airtable', 'Instacart',
    'NerdWallet', 'Gusto', 'Rippling', 'Brex', 'Duolingo', 'Anduril',
  ];

  private static readonly BASE_CONTEXT_RE = /\b(base\s+(?:salary|pay|compensation)|salary\s+range|annual\s+(?:base|salary)|base\s+range|base\s+pay\s+range)\b/i;
  private static readonly TOTAL_CONTEXT_RE = /\b(total\s+(?:comp|compensation)|on[- ]?target\s+earn|ote|total\s+annual|overall\s+comp|expected\s+annual\s+comp)\b/i;
  private static readonly DOLLAR_RANGE_RE = /\$\s*([\d,]+)\s*(?:[-–—to]+\s*\$?\s*([\d,]+))?/g;
  private static readonly ELITE_TITLE_RE = /\b(staff|principal|distinguished|director|vp|vice president|head of|chief|fellow)\b/i;

  async getHighPaidFeed(minSalary = 200_000, limit = 300) {
    const cacheKey = `highPaid:${minSalary}:${limit}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const minHourly = Math.round(minSalary / 2080);

    const JOB_COLUMNS = `
      id::text as id, title, company, location,
      "rateText", "employmentType"::text as "employmentType",
      skills, "actionabilityScore", "realnessScore",
      "discoveredAt" as "postedAt",
      source::text as source,
      COALESCE("applyUrl", '') as "applyUrl",
      COALESCE("sourceUrl", '') as "sourceUrl",
      COALESCE("recruiterName", '') as "recruiterName",
      COALESCE("recruiterEmail", '') as "recruiterEmail",
      COALESCE("companyDomain", '') as "companyDomain",
      "rateMin", "rateMax", "hourlyRateMin", "hourlyRateMax",
      "compPeriod"::text as "compPeriod",
      "rawPayload", "locationType"::text as "locationType"
    `;

    // Query 1: Jobs with explicit annual salary >= $200K base
    const annualJobs = await this.prisma.$queryRaw`
      SELECT
        id::text as id, title, company, location,
        "rateText", "employmentType"::text as "employmentType",
        skills, "actionabilityScore", "realnessScore",
        "discoveredAt" as "postedAt",
        source::text as source,
        COALESCE("applyUrl", '') as "applyUrl",
        COALESCE("sourceUrl", '') as "sourceUrl",
        COALESCE("recruiterName", '') as "recruiterName",
        COALESCE("recruiterEmail", '') as "recruiterEmail",
        COALESCE("companyDomain", '') as "companyDomain",
        "rateMin", "rateMax", "hourlyRateMin", "hourlyRateMax",
        "compPeriod"::text as "compPeriod",
        "rawPayload", "locationType"::text as "locationType"
      FROM "MarketJob"
      WHERE status = 'ACTIVE'
        AND (
          ("compPeriod"::text = 'YEAR' AND COALESCE("rateMax", "rateMin", 0) >= ${minSalary})
          OR ("compPeriod"::text = 'HOUR' AND COALESCE("hourlyRateMax", "hourlyRateMin", 0) >= ${minHourly})
          OR ("rateMax" >= ${minSalary} AND "compPeriod"::text != 'HOUR')
        )
      ORDER BY COALESCE("rateMax", "rateMin", 0) DESC, "discoveredAt" DESC
      LIMIT ${limit}
    ` as any[];

    // Query 2: Jobs from curated FAANG/tech (marked by provider)
    const faangJobs = await this.prisma.$queryRaw`
      SELECT
        id::text as id, title, company, location,
        "rateText", "employmentType"::text as "employmentType",
        skills, "actionabilityScore", "realnessScore",
        "discoveredAt" as "postedAt",
        source::text as source,
        COALESCE("applyUrl", '') as "applyUrl",
        COALESCE("sourceUrl", '') as "sourceUrl",
        COALESCE("recruiterName", '') as "recruiterName",
        COALESCE("recruiterEmail", '') as "recruiterEmail",
        COALESCE("companyDomain", '') as "companyDomain",
        "rateMin", "rateMax", "hourlyRateMin", "hourlyRateMax",
        "compPeriod"::text as "compPeriod",
        "rawPayload", "locationType"::text as "locationType"
      FROM "MarketJob"
      WHERE status = 'ACTIVE'
        AND COALESCE(("rawPayload"->>'isHighPaid')::boolean, false) = true
        AND title ~* '(senior|staff|principal|distinguished|director|vp|head|chief|fellow|architect|lead|manager)'
      ORDER BY COALESCE("rateMax", "rateMin", 0) DESC, "discoveredAt" DESC
      LIMIT ${limit}
    ` as any[];

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const job of [...annualJobs, ...faangJobs]) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);

      const payload = typeof job.rawPayload === 'string' ? JSON.parse(job.rawPayload) : job.rawPayload;
      const compIntel = payload?.compIntel;

      // Use compIntel from provider if available, else fallback to raw rates
      const baseMin = compIntel?.baseMin ?? this.toAnnual(job.rateMin, job.hourlyRateMin, job.compPeriod);
      const baseMax = compIntel?.baseMax ?? this.toAnnual(job.rateMax, job.hourlyRateMax, job.compPeriod);
      const totalMin = compIntel?.totalMin ?? Math.round(baseMin * 1.4);
      const totalMax = compIntel?.totalMax ?? Math.round(baseMax * 1.4);
      const compType: string = compIntel?.compType ?? 'UNSPECIFIED';
      const hasEquity: boolean = compIntel?.hasEquity ?? false;
      const opportunityScore: number = payload?.opportunityScore ?? 50;

      const isFaang = this.isFaangCompany(job.company);
      const tier = this.compTier(baseMax);

      merged.push({
        ...job,
        annualMin: baseMin,
        annualMax: baseMax,
        baseMin,
        baseMax,
        totalMin,
        totalMax,
        compType,
        hasEquity,
        compDisplay: this.formatCompDetailed(baseMin, baseMax, compType),
        faangSource: payload?.faangSource ?? job.source,
        companyTier: payload?.companyTier ?? (isFaang ? 'FAANG' : 'HIGH_GROWTH'),
        isFaang,
        tier,
        opportunityScore,
        totalCompDisplay: totalMax > baseMax ? `${this.fmtK(totalMin)} – ${this.fmtK(totalMax)} est. total` : null,
      });
    }

    // Sort by OpportunityScore first, then base comp
    merged.sort((a, b) => (b.opportunityScore - a.opportunityScore) || (b.baseMax - a.baseMax));

    // Compensation buckets (based on BASE, not total)
    const compBuckets = [
      { label: '$200K–$300K Base', min: 200_000, max: 300_000, count: 0 },
      { label: '$300K–$400K Base', min: 300_000, max: 400_000, count: 0 },
      { label: '$400K–$500K Base', min: 400_000, max: 500_000, count: 0 },
      { label: '$500K+ Base', min: 500_000, max: Infinity, count: 0 },
    ];
    for (const job of merged) {
      const sal = job.baseMax || job.baseMin || 0;
      for (const bucket of compBuckets) {
        if (sal >= bucket.min && sal < bucket.max) { bucket.count++; break; }
      }
    }

    const companyCounts: Record<string, number> = {};
    for (const job of merged) {
      companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
    }
    const topCompanies = Object.entries(companyCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 25)
      .map(([company, count]) => ({ company, count }));

    const avgOpportunityScore = merged.length > 0
      ? Math.round(merged.reduce((s, j) => s + j.opportunityScore, 0) / merged.length)
      : 0;

    const result = {
      jobs: merged.slice(0, limit),
      total: merged.length,
      compBuckets,
      topCompanies,
      avgOpportunityScore,
      compIntelSummary: {
        baseSalaryRoles: merged.filter((j) => j.compType === 'BASE').length,
        totalCompRoles: merged.filter((j) => j.compType === 'TOTAL').length,
        unspecifiedRoles: merged.filter((j) => j.compType === 'UNSPECIFIED').length,
        withEquity: merged.filter((j) => j.hasEquity).length,
      },
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, result, 300_000);
    return result;
  }

  private fmtK(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
  }

  private formatCompDetailed(baseMin: number, baseMax: number, compType: string): string {
    if (!baseMin && !baseMax) return 'Comp not disclosed';
    const label = compType === 'BASE' ? ' base' : compType === 'TOTAL' ? ' est. base' : '';
    if (baseMin === baseMax || !baseMin) return `${this.fmtK(baseMax || baseMin)}${label}/yr`;
    return `${this.fmtK(baseMin)} – ${this.fmtK(baseMax)}${label}/yr`;
  }

  private toAnnual(rate: number | null, hourlyRate: number | null, compPeriod: string | null): number {
    if (compPeriod === 'YEAR' && rate) return rate;
    if (compPeriod === 'HOUR' && hourlyRate) return hourlyRate * 2080;
    if (compPeriod === 'HOUR' && rate) return rate * 2080;
    if (rate && rate >= 50_000) return rate;
    if (hourlyRate && hourlyRate >= 50) return hourlyRate * 2080;
    return rate || 0;
  }

  private formatComp(min: number, max: number): string {
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
      return `$${n}`;
    };
    if (!min && !max) return 'Comp not disclosed';
    if (min === max || !min) return `${fmt(max || min)}/yr`;
    return `${fmt(min)} – ${fmt(max)}/yr`;
  }

  private isFaangCompany(company: string): boolean {
    const lower = (company || '').toLowerCase();
    return AnalyticsService.FAANG_COMPANIES.some(
      (f) => lower.includes(f.toLowerCase()),
    );
  }

  private compTier(baseSalary: number): string {
    if (baseSalary >= 400_000) return 'MEGA';
    if (baseSalary >= 300_000) return 'ELITE';
    if (baseSalary >= 250_000) return 'PREMIUM';
    if (baseSalary >= 200_000) return 'HIGH';
    return 'STANDARD';
  }

  /* ═══════ On-Demand FAANG Career Crawl ═══════ */

  private static readonly GREENHOUSE_BOARDS: { slug: string; company: string; tier: string }[] = [
    { slug: 'meta', company: 'Meta', tier: 'FAANG' },
    { slug: 'openai', company: 'OpenAI', tier: 'AI_INFRA' },
    { slug: 'anthropic', company: 'Anthropic', tier: 'AI_INFRA' },
    { slug: 'databricks', company: 'Databricks', tier: 'AI_INFRA' },
    { slug: 'snowflakecomputing', company: 'Snowflake', tier: 'AI_INFRA' },
    { slug: 'scaleai', company: 'Scale AI', tier: 'AI_INFRA' },
    { slug: 'stripe', company: 'Stripe', tier: 'HIGH_GROWTH' },
    { slug: 'airbnb', company: 'Airbnb', tier: 'HIGH_GROWTH' },
    { slug: 'palantirtechnologies', company: 'Palantir', tier: 'HIGH_GROWTH' },
    { slug: 'cloudflare', company: 'Cloudflare', tier: 'HIGH_GROWTH' },
    { slug: 'pinterest', company: 'Pinterest', tier: 'HIGH_GROWTH' },
    { slug: 'doordash', company: 'DoorDash', tier: 'HIGH_GROWTH' },
    { slug: 'coinbase', company: 'Coinbase', tier: 'HIGH_GROWTH' },
    { slug: 'robinhood', company: 'Robinhood', tier: 'HIGH_GROWTH' },
    { slug: 'figma', company: 'Figma', tier: 'HIGH_GROWTH' },
    { slug: 'discord', company: 'Discord', tier: 'HIGH_GROWTH' },
    { slug: 'reddit', company: 'Reddit', tier: 'HIGH_GROWTH' },
    { slug: 'block', company: 'Block (Square)', tier: 'HIGH_GROWTH' },
    { slug: 'roblox', company: 'Roblox', tier: 'HIGH_GROWTH' },
    { slug: 'notion', company: 'Notion', tier: 'HIGH_GROWTH' },
    { slug: 'plaid', company: 'Plaid', tier: 'HIGH_GROWTH' },
    { slug: 'twilio', company: 'Twilio', tier: 'MEGA_TECH' },
    { slug: 'datadog', company: 'Datadog', tier: 'MEGA_TECH' },
    { slug: 'mongodb', company: 'MongoDB', tier: 'MEGA_TECH' },
    { slug: 'crowdstrike', company: 'CrowdStrike', tier: 'MEGA_TECH' },
    { slug: 'servicenow', company: 'ServiceNow', tier: 'MEGA_TECH' },
    { slug: 'paloaltonetworks', company: 'Palo Alto Networks', tier: 'MEGA_TECH' },
    { slug: 'hashicorp', company: 'HashiCorp', tier: 'MEGA_TECH' },
    { slug: 'elastic', company: 'Elastic', tier: 'MEGA_TECH' },
    { slug: 'cockroachlabs', company: 'Cockroach Labs', tier: 'HIGH_GROWTH' },
    { slug: 'airtable', company: 'Airtable', tier: 'HIGH_GROWTH' },
    { slug: 'instacart', company: 'Instacart', tier: 'HIGH_GROWTH' },
    { slug: 'nerdwallet', company: 'NerdWallet', tier: 'HIGH_GROWTH' },
    { slug: 'gusto', company: 'Gusto', tier: 'HIGH_GROWTH' },
    { slug: 'rippling', company: 'Rippling', tier: 'HIGH_GROWTH' },
    { slug: 'brex', company: 'Brex', tier: 'HIGH_GROWTH' },
    { slug: 'duolingo', company: 'Duolingo', tier: 'HIGH_GROWTH' },
    { slug: 'anduril', company: 'Anduril', tier: 'HIGH_GROWTH' },
  ];

  private static readonly LEVER_BOARDS: { slug: string; company: string; tier: string }[] = [
    { slug: 'netflix', company: 'Netflix', tier: 'FAANG' },
  ];

  private static readonly SENIOR_RE = /\b(senior|staff|principal|distinguished|director|vp|vice president|head of|chief|fellow|architect|lead|manager|sr\.?)\b/i;

  private parseCompIntel(text: string, title: string): {
    baseMin: number; baseMax: number;
    totalMin: number; totalMax: number;
    compType: 'BASE' | 'TOTAL' | 'UNSPECIFIED';
    hasEquity: boolean;
  } | null {
    if (!text) return null;

    const hasEquity = /\b(rsu|stock|equity|shares|vest|restricted stock)\b/i.test(text);
    const isElite = AnalyticsService.ELITE_TITLE_RE.test(title);

    const ranges: { low: number; high: number; context: string }[] = [];
    const matches = [...text.matchAll(AnalyticsService.DOLLAR_RANGE_RE)];
    for (const m of matches) {
      const low = parseInt((m[1] ?? '0').replace(/,/g, ''), 10);
      const high = m[2] ? parseInt(m[2].replace(/,/g, ''), 10) : low;
      if (low < 80_000 || low > 1_500_000) continue;
      const idx = m.index ?? 0;
      const context = text.slice(Math.max(0, idx - 100), idx + (m[0]?.length ?? 0) + 100);
      ranges.push({ low, high, context });
    }

    if (ranges.length === 0) return null;

    let compType: 'BASE' | 'TOTAL' | 'UNSPECIFIED' = 'UNSPECIFIED';
    let best = ranges[0]!;
    for (const r of ranges) {
      if (AnalyticsService.BASE_CONTEXT_RE.test(r.context)) { compType = 'BASE'; best = r; break; }
      if (AnalyticsService.TOTAL_CONTEXT_RE.test(r.context)) { compType = 'TOTAL'; best = r; }
    }
    if (compType === 'UNSPECIFIED') {
      compType = (best.high > 450_000 && hasEquity) ? 'TOTAL' : 'BASE';
    }

    let baseMin: number, baseMax: number, totalMin: number, totalMax: number;
    if (compType === 'BASE') {
      baseMin = best.low; baseMax = best.high;
      const eqMult = isElite ? 1.6 : 1.35;
      totalMin = Math.round(baseMin * eqMult); totalMax = Math.round(baseMax * eqMult);
    } else {
      totalMin = best.low; totalMax = best.high;
      const baseFrac = isElite ? 0.50 : 0.60;
      baseMin = Math.round(totalMin * baseFrac); baseMax = Math.round(totalMax * baseFrac);
    }
    baseMax = Math.min(baseMax, 500_000);
    baseMin = Math.min(baseMin, baseMax);

    return { baseMin, baseMax, totalMin, totalMax, compType, hasEquity };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async crawlFaangCareers(): Promise<{ inserted: number; updated: number; skipped: number; companies: string[] }> {
    let inserted = 0, updated = 0, skipped = 0;
    const companiesCrawled: string[] = [];

    for (const board of AnalyticsService.GREENHOUSE_BOARDS) {
      try {
        const count = await this.crawlGreenhouse(board.slug, board.company, board.tier);
        inserted += count.inserted;
        updated += count.updated;
        skipped += count.skipped;
        if (count.inserted + count.updated > 0) companiesCrawled.push(board.company);
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        this.logger.warn(`Greenhouse ${board.company} failed: ${err}`);
      }
    }

    for (const board of AnalyticsService.LEVER_BOARDS) {
      try {
        const count = await this.crawlLever(board.slug, board.company, board.tier);
        inserted += count.inserted;
        updated += count.updated;
        skipped += count.skipped;
        if (count.inserted + count.updated > 0) companiesCrawled.push(board.company);
        await new Promise((r) => setTimeout(r, 400));
      } catch (err) {
        this.logger.warn(`Lever ${board.company} failed: ${err}`);
      }
    }

    this.cache.delete('highPaid:200000:300');
    this.logger.log(`FAANG crawl complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped from ${companiesCrawled.length} companies`);
    return { inserted, updated, skipped, companies: companiesCrawled };
  }

  private computeOppScore(baseMax: number, tier: string, isRemote: boolean, hasEquity: boolean, isElite: boolean): number {
    const compScore = Math.min(100, Math.round(baseMax / 5000));
    const tierW: Record<string, number> = { FAANG: 1.3, AI_INFRA: 1.25, MEGA_TECH: 1.1, HIGH_GROWTH: 1.0 };
    const raw = (compScore * (tierW[tier] ?? 1.0)) + (isRemote ? 5 : 0) + (hasEquity ? 5 : 0) + (isElite ? 10 : 0);
    return Math.min(100, Math.round(raw));
  }

  private async crawlGreenhouse(slug: string, company: string, tier: string): Promise<{ inserted: number; updated: number; skipped: number }> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { inserted: 0, updated: 0, skipped: 0 };

    const data = await res.json() as { jobs?: any[] };
    let inserted = 0, updated = 0, skipped = 0;

    for (const job of data.jobs ?? []) {
      if (!AnalyticsService.SENIOR_RE.test(job.title ?? '')) { skipped++; continue; }

      const desc = job.content ? this.stripHtml(job.content) : '';
      const comp = this.parseCompIntel(desc, job.title ?? '');
      const isHighPaid = comp && comp.baseMax >= 200_000;
      const isElite = AnalyticsService.ELITE_TITLE_RE.test(job.title ?? '');

      const extId = `gh-${slug}-${job.id}`;
      const existingStale = !isHighPaid && !isElite
        ? await this.prisma.marketJob.findUnique({
            where: { source_externalId: { source: 'OTHER', externalId: extId } },
            select: { id: true },
          })
        : null;

      if (!isHighPaid && !isElite && !existingStale) { skipped++; continue; }

      const location = job.location?.name ?? null;
      const isRemote = /remote/i.test(location ?? '');
      const oppScore = comp
        ? this.computeOppScore(comp.baseMax, tier, isRemote, comp.hasEquity, isElite)
        : isElite ? 65 : 50;

      const result = await this.upsertHighPaidJob({
        externalId: extId,
        title: job.title,
        company,
        description: desc.slice(0, 5000),
        location,
        locationType: isRemote ? 'REMOTE' : 'ONSITE',
        applyUrl: job.absolute_url,
        sourceUrl: `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
        postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
        compIntel: comp,
        faangSource: 'GREENHOUSE',
        boardSlug: slug,
        companyTier: tier,
        opportunityScore: oppScore,
      });
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
    }

    this.logger.log(`Greenhouse ${company}: ${inserted} new, ${updated} updated from ${data.jobs?.length ?? 0} total`);
    return { inserted, updated, skipped };
  }

  private async crawlLever(slug: string, company: string, tier: string): Promise<{ inserted: number; updated: number; skipped: number }> {
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { inserted: 0, updated: 0, skipped: 0 };

    const postings = await res.json() as any[];
    let inserted = 0, updated = 0, skipped = 0;

    for (const posting of postings) {
      if (!AnalyticsService.SENIOR_RE.test(posting.text ?? '')) { skipped++; continue; }

      const descParts = [
        posting.descriptionPlain || this.stripHtml(posting.description || ''),
        ...(posting.lists ?? []).map((l: any) => this.stripHtml(l.content)),
      ];
      const fullDesc = descParts.join(' ').slice(0, 5000);
      const comp = this.parseCompIntel(fullDesc, posting.text ?? '');
      const isHighPaid = comp && comp.baseMax >= 200_000;
      const isElite = AnalyticsService.ELITE_TITLE_RE.test(posting.text ?? '');

      const extId = `lv-${slug}-${posting.id}`;
      const existingStale = !isHighPaid && !isElite
        ? await this.prisma.marketJob.findUnique({
            where: { source_externalId: { source: 'OTHER', externalId: extId } },
            select: { id: true },
          })
        : null;

      if (!isHighPaid && !isElite && !existingStale) { skipped++; continue; }

      const location = posting.categories?.location ?? null;
      const isRemote = /remote/i.test(location ?? '');
      const oppScore = comp
        ? this.computeOppScore(comp.baseMax, tier, isRemote, comp.hasEquity, isElite)
        : isElite ? 65 : 50;

      const result = await this.upsertHighPaidJob({
        externalId: extId,
        title: posting.text,
        company,
        description: fullDesc,
        location,
        locationType: isRemote ? 'REMOTE' : 'ONSITE',
        applyUrl: posting.hostedUrl,
        sourceUrl: posting.hostedUrl,
        postedAt: posting.createdAt ? new Date(posting.createdAt) : new Date(),
        compIntel: comp,
        faangSource: 'LEVER',
        boardSlug: slug,
        companyTier: tier,
        opportunityScore: oppScore,
      });
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
    }

    this.logger.log(`Lever ${company}: ${inserted} new, ${updated} updated from ${postings.length} total`);
    return { inserted, updated, skipped };
  }

  private async upsertHighPaidJob(job: {
    externalId: string; title: string; company: string; description: string;
    location: string | null; locationType: string; applyUrl?: string; sourceUrl?: string;
    postedAt: Date;
    compIntel: { baseMin: number; baseMax: number; totalMin: number; totalMax: number; compType: string; hasEquity: boolean } | null;
    faangSource: string; boardSlug: string; companyTier: string; opportunityScore: number;
  }): Promise<'inserted' | 'updated' | 'skipped'> {
    const existing = await this.prisma.marketJob.findUnique({
      where: { source_externalId: { source: 'OTHER', externalId: job.externalId } },
      select: { id: true },
    });

    const baseMin = job.compIntel?.baseMin ?? null;
    const baseMax = job.compIntel?.baseMax ?? null;
    const hourlyMin = baseMin ? Math.round(baseMin / 2080) : null;
    const hourlyMax = baseMax ? Math.round(baseMax / 2080) : null;

    const rateText = baseMin && baseMax
      ? `$${Math.round(baseMin / 1000)}K – $${Math.round(baseMax / 1000)}K base/yr`
      : baseMax ? `$${Math.round(baseMax / 1000)}K base/yr` : null;

    const jobData = {
      title: job.title,
      company: job.company,
      description: job.description,
      location: job.location,
      locationType: job.locationType as any,
      employmentType: 'FULLTIME' as any,
      classificationConfidence: 0.95,
      negativeSignals: [],
      rateText,
      rateMin: baseMin,
      rateMax: baseMax,
      compPeriod: 'YEAR' as any,
      hourlyRateMin: hourlyMin,
      hourlyRateMax: hourlyMax,
      skills: [],
      applyUrl: job.applyUrl,
      sourceUrl: job.sourceUrl,
      postedAt: job.postedAt,
      sourcePostedAt: job.postedAt,
      lastSeenAt: new Date(),
      status: 'ACTIVE' as any,
      realnessScore: 95,
      realnessReasons: ['Direct from company career page'],
      actionabilityScore: baseMax && baseMax >= 200_000 ? 90 : 70,
      actionabilityReasons: ['FAANG/Top Tech', 'Direct career page'],
      rawPayload: {
        faangSource: job.faangSource,
        boardSlug: job.boardSlug,
        companyTier: job.companyTier,
        isHighPaid: true,
        compIntel: job.compIntel ? {
          baseMin: job.compIntel.baseMin, baseMax: job.compIntel.baseMax,
          totalMin: job.compIntel.totalMin, totalMax: job.compIntel.totalMax,
          compType: job.compIntel.compType,
          hasEquity: job.compIntel.hasEquity,
        } : null,
        opportunityScore: job.opportunityScore,
      },
    };

    try {
      if (existing) {
        await this.prisma.marketJob.update({ where: { id: existing.id }, data: jobData });
        return 'updated';
      }
      await this.prisma.marketJob.create({
        data: { externalId: job.externalId, source: 'OTHER', ...jobData },
      });
      return 'inserted';
    } catch {
      return 'skipped';
    }
  }
}
