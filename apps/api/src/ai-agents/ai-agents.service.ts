import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiAgentsService {
  private readonly logger = new Logger(AiAgentsService.name);

  constructor(private prisma: PrismaService) {}

  /* ═══════════════════════════════════════════════════════════════════
     AGENT 1: SALES STRATEGIST
     Analyzes market conditions, bill rates, technology closures
     ═══════════════════════════════════════════════════════════════════ */

  async runSalesStrategist() {
    const [
      techDemand,
      billRateAnalysis,
      topVendorsByVolume,
      empTypeDistribution,
      locationHotspots,
      weeklyTrend,
      vendorResponsePatterns,
    ] = await Promise.all([
      this.getTopTechDemand(),
      this.getBillRateAnalysis(),
      this.getTopVendorsByReqVolume(),
      this.getEmploymentTypeDistribution(),
      this.getLocationHotspots(),
      this.getWeeklyReqTrend(),
      this.getVendorResponsePatterns(),
    ]);

    const insights = this.generateSalesInsights({
      techDemand, billRateAnalysis, topVendorsByVolume,
      empTypeDistribution, locationHotspots, weeklyTrend, vendorResponsePatterns,
    });

    return {
      agent: 'Sales Strategist',
      generatedAt: new Date().toISOString(),
      data: {
        techDemand,
        billRateAnalysis,
        topVendorsByVolume: topVendorsByVolume.slice(0, 20),
        empTypeDistribution,
        locationHotspots: locationHotspots.slice(0, 20),
        weeklyTrend,
        vendorResponsePatterns: vendorResponsePatterns.slice(0, 15),
      },
      insights,
    };
  }

  private async getTopTechDemand() {
    return this.prisma.$queryRaw`
      SELECT skill as "technology", COUNT(*)::int as "demand",
             COUNT(*) FILTER (WHERE vrs.created_at >= NOW() - interval '7 days')::int as "demandLast7d",
             COUNT(*) FILTER (WHERE vrs.rate_text IS NOT NULL)::int as "withRate",
             ROUND(
               COUNT(*) FILTER (WHERE vrs.employment_type IN ('C2C', 'W2', 'CONTRACT'))::numeric /
               GREATEST(COUNT(*), 1) * 100, 1
             ) as "contractPct"
      FROM vendor_req_signal vrs, unnest(vrs.skills) as skill
      GROUP BY skill
      HAVING COUNT(*) >= 10
      ORDER BY "demand" DESC
      LIMIT 30
    ` as Promise<any[]>;
  }

  private async getBillRateAnalysis() {
    return this.prisma.$queryRaw`
      SELECT
        CASE
          WHEN rate_text ~* '\$(\d+)' THEN
            CASE
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 30 THEN '$20-29/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 40 THEN '$30-39/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 50 THEN '$40-49/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 60 THEN '$50-59/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 70 THEN '$60-69/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 80 THEN '$70-79/hr'
              WHEN (regexp_match(rate_text, '\$(\d+)'))[1]::int < 100 THEN '$80-99/hr'
              ELSE '$100+/hr'
            END
          ELSE 'Rate not parsed'
        END as "rateRange",
        COUNT(*)::int as "count"
      FROM vendor_req_signal
      WHERE rate_text IS NOT NULL
      GROUP BY "rateRange"
      ORDER BY "count" DESC
    ` as Promise<any[]>;
  }

  private async getTopVendorsByReqVolume() {
    return this.prisma.$queryRaw`
      SELECT vc.name as "vendorName", vc.domain,
             COUNT(vrs.id)::int as "totalReqs",
             COUNT(vrs.id) FILTER (WHERE vrs.created_at >= NOW() - interval '30 days')::int as "reqs30d",
             COALESCE(vts.trust_score, 0) as "trustScore",
             vts.actionability_tier as "tier",
             COUNT(DISTINCT vct.id)::int as "contactCount"
      FROM vendor_company vc
      JOIN vendor_req_signal vrs ON vrs.vendor_company_id = vc.id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      LEFT JOIN vendor_contact vct ON vct.vendor_company_id = vc.id
      WHERE vc.name NOT LIKE '[SYSTEM]%'
      GROUP BY vc.id, vc.name, vc.domain, vts.trust_score, vts.actionability_tier
      ORDER BY "totalReqs" DESC
      LIMIT 30
    ` as Promise<any[]>;
  }

  private async getEmploymentTypeDistribution() {
    return this.prisma.$queryRaw`
      SELECT
        COALESCE(engagement_model, employment_type, 'UNKNOWN') as "type",
        COUNT(*)::int as "count",
        ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM vendor_req_signal) * 100, 1) as "pct"
      FROM vendor_req_signal
      GROUP BY "type"
      ORDER BY "count" DESC
    ` as Promise<any[]>;
  }

  private async getLocationHotspots() {
    return this.prisma.$queryRaw`
      SELECT location as "location", COUNT(*)::int as "count"
      FROM vendor_req_signal
      WHERE location IS NOT NULL AND location != '' AND length(location) > 2
      GROUP BY location
      HAVING COUNT(*) >= 5
      ORDER BY "count" DESC
      LIMIT 30
    ` as Promise<any[]>;
  }

  private async getWeeklyReqTrend() {
    return this.prisma.$queryRaw`
      SELECT
        date_trunc('week', created_at)::date as "week",
        COUNT(*)::int as "totalReqs",
        COUNT(*) FILTER (WHERE employment_type IN ('C2C', 'W2'))::int as "c2cW2Reqs",
        COUNT(*) FILTER (WHERE actionability_score >= 60)::int as "qualityReqs"
      FROM vendor_req_signal
      WHERE created_at >= NOW() - interval '90 days'
      GROUP BY "week"
      ORDER BY "week" DESC
    ` as Promise<any[]>;
  }

  private async getVendorResponsePatterns() {
    return this.prisma.$queryRaw`
      SELECT
        vc.name as "vendorName",
        vc.domain,
        COUNT(DISTINCT vrs.id)::int as "reqsSent",
        COUNT(DISTINCT rem.id) FILTER (WHERE rem.subject ILIKE 'Re:%' AND rem.from_email != rem.mailbox_email)::int as "repliesReceived",
        COALESCE(vts.trust_score, 0) as "trustScore"
      FROM vendor_company vc
      JOIN vendor_req_signal vrs ON vrs.vendor_company_id = vc.id
      LEFT JOIN vendor_contact vct ON vct.vendor_company_id = vc.id
      LEFT JOIN raw_email_message rem ON rem.from_email = vct.email
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      WHERE vc.name NOT LIKE '[SYSTEM]%'
      GROUP BY vc.id, vc.name, vc.domain, vts.trust_score
      HAVING COUNT(DISTINCT vrs.id) >= 10
      ORDER BY "reqsSent" DESC
      LIMIT 20
    ` as Promise<any[]>;
  }

  private generateSalesInsights(data: any): string[] {
    const insights: string[] = [];
    const td = data.techDemand || [];
    const br = data.billRateAnalysis || [];
    const tv = data.topVendorsByVolume || [];

    if (td.length > 0) {
      const top3 = td.slice(0, 3).map((t: any) => `${t.technology} (${t.demand})`);
      insights.push(`Top 3 technologies in demand: ${top3.join(', ')}. Focus bench-building here.`);
    }

    const highRate = br.find((b: any) => b.rateRange === '$80-99/hr' || b.rateRange === '$100+/hr');
    if (highRate) {
      insights.push(`${highRate.count} reqs at ${highRate.rateRange} — these are high-margin opportunities. Prioritize for senior consultants.`);
    }

    const highTrustVendors = tv.filter((v: any) => v.trustScore >= 70);
    if (highTrustVendors.length > 0) {
      insights.push(`${highTrustVendors.length} HIGH-trust vendors identified. Build deeper relationships with top 10 — they represent your most reliable revenue.`);
    }

    insights.push('Strategy: Allocate 60% of submission effort to PREMIUM reqs from HIGH-trust vendors. These have 3-5x higher conversion than cold board postings.');
    insights.push('Pricing insight: Track the gap between vendor-quoted rate and your target bill rate. Vendors consistently offering $10+ below market should be deprioritized.');

    return insights;
  }

  /* ═══════════════════════════════════════════════════════════════════
     AGENT 2: RECRUITING STRATEGIST
     Analyzes talent pool, availability, skill gaps
     ═══════════════════════════════════════════════════════════════════ */

  async runRecruitingStrategist() {
    const [
      talentPool,
      skillSupplyDemand,
      consultantActivity,
      topConsultantSkills,
    ] = await Promise.all([
      this.getTalentPoolAnalysis(),
      this.getSkillSupplyDemandGap(),
      this.getConsultantActivityLevels(),
      this.getTopConsultantSkillCombos(),
    ]);

    const insights = this.generateRecruitingInsights({ talentPool, skillSupplyDemand });

    return {
      agent: 'Recruiting Strategist',
      generatedAt: new Date().toISOString(),
      data: { talentPool, skillSupplyDemand, consultantActivity, topConsultantSkills },
      insights,
    };
  }

  private async getTalentPoolAnalysis() {
    return this.prisma.$queryRaw`
      SELECT
        COUNT(*)::int as "totalConsultants",
        COUNT(*) FILTER (WHERE primary_skills IS NOT NULL AND array_length(primary_skills, 1) > 0)::int as "withSkills",
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int as "withEmail",
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '')::int as "withPhone",
        COUNT(*) FILTER (WHERE last_seen >= NOW() - interval '30 days')::int as "activeLast30d",
        COUNT(*) FILTER (WHERE last_seen >= NOW() - interval '7 days')::int as "activeLast7d"
      FROM consultant
    ` as Promise<any[]>;
  }

  private async getSkillSupplyDemandGap() {
    return this.prisma.$queryRaw`
      WITH demand AS (
        SELECT skill, COUNT(*)::int as demand_count
        FROM vendor_req_signal, unnest(skills) as skill
        GROUP BY skill
      ),
      supply AS (
        SELECT skill, COUNT(*)::int as supply_count
        FROM consultant, unnest(primary_skills) as skill
        GROUP BY skill
      )
      SELECT
        COALESCE(d.skill, s.skill) as "skill",
        COALESCE(d.demand_count, 0) as "demand",
        COALESCE(s.supply_count, 0) as "supply",
        COALESCE(d.demand_count, 0) - COALESCE(s.supply_count, 0) as "gap",
        CASE
          WHEN COALESCE(s.supply_count, 0) = 0 AND COALESCE(d.demand_count, 0) > 0 THEN 'CRITICAL_SHORTAGE'
          WHEN COALESCE(d.demand_count, 0) > COALESCE(s.supply_count, 0) * 3 THEN 'HIGH_DEMAND'
          WHEN COALESCE(s.supply_count, 0) > COALESCE(d.demand_count, 0) * 3 THEN 'OVERSUPPLY'
          ELSE 'BALANCED'
        END as "status"
      FROM demand d
      FULL OUTER JOIN supply s ON d.skill = s.skill
      WHERE COALESCE(d.demand_count, 0) + COALESCE(s.supply_count, 0) >= 10
      ORDER BY "gap" DESC
    ` as Promise<any[]>;
  }

  private async getConsultantActivityLevels() {
    return this.prisma.$queryRaw`
      SELECT
        CASE
          WHEN last_seen >= NOW() - interval '7 days' THEN 'ACTIVE_7D'
          WHEN last_seen >= NOW() - interval '30 days' THEN 'ACTIVE_30D'
          WHEN last_seen >= NOW() - interval '90 days' THEN 'DORMANT_90D'
          ELSE 'INACTIVE'
        END as "activityLevel",
        COUNT(*)::int as "count"
      FROM consultant
      GROUP BY "activityLevel"
      ORDER BY "count" DESC
    ` as Promise<any[]>;
  }

  private async getTopConsultantSkillCombos() {
    return this.prisma.$queryRaw`
      SELECT
        array_to_string(ARRAY(SELECT unnest(primary_skills) ORDER BY 1 LIMIT 3), ' + ') as "skillCombo",
        COUNT(*)::int as "count"
      FROM consultant
      WHERE primary_skills IS NOT NULL AND array_length(primary_skills, 1) >= 2
      GROUP BY "skillCombo"
      HAVING COUNT(*) >= 3
      ORDER BY "count" DESC
      LIMIT 20
    ` as Promise<any[]>;
  }

  private generateRecruitingInsights(data: any): string[] {
    const insights: string[] = [];
    const pool = data.talentPool?.[0];
    const gaps = data.skillSupplyDemand || [];

    if (pool) {
      insights.push(`Talent pool: ${pool.totalConsultants} consultants. ${pool.activeLast30d} active in last 30 days. ${pool.withPhone} have phone numbers for direct reach.`);
    }

    const criticalShortage = gaps.filter((g: any) => g.status === 'CRITICAL_SHORTAGE').slice(0, 5);
    if (criticalShortage.length > 0) {
      const skills = criticalShortage.map((g: any) => `${g.skill} (${g.demand} demand, 0 supply)`).join(', ');
      insights.push(`CRITICAL SHORTAGE: ${skills}. Actively recruit for these skills — high demand, zero bench.`);
    }

    const highDemand = gaps.filter((g: any) => g.status === 'HIGH_DEMAND').slice(0, 5);
    if (highDemand.length > 0) {
      const skills = highDemand.map((g: any) => `${g.skill} (gap: ${g.gap})`).join(', ');
      insights.push(`HIGH DEMAND skills: ${skills}. Build bench aggressively in these areas.`);
    }

    const oversupply = gaps.filter((g: any) => g.status === 'OVERSUPPLY').slice(0, 5);
    if (oversupply.length > 0) {
      const skills = oversupply.map((g: any) => g.skill).join(', ');
      insights.push(`OVERSUPPLY in: ${skills}. Diversify these consultants into adjacent skills to increase placement odds.`);
    }

    insights.push('Action: Cross-train top consultants in shortage skills. A Java dev learning AWS/Cloud increases their placement probability by 40%.');

    return insights;
  }

  /* ═══════════════════════════════════════════════════════════════════
     AGENT 3: JOB SEARCH ANALYST
     Market gaps, hard-to-fill roles, geographic demand
     ═══════════════════════════════════════════════════════════════════ */

  async runJobSearchAnalyst() {
    const [
      hardToFill,
      geoDistribution,
      remoteVsOnsite,
      rateByTech,
      freshness,
    ] = await Promise.all([
      this.getHardToFillRoles(),
      this.getGeoDistribution(),
      this.getRemoteVsOnsite(),
      this.getRateByTechnology(),
      this.getReqFreshness(),
    ]);

    const insights = this.generateJobSearchInsights({ hardToFill, geoDistribution, remoteVsOnsite, rateByTech });

    return {
      agent: 'Job Search Analyst',
      generatedAt: new Date().toISOString(),
      data: { hardToFill, geoDistribution: geoDistribution.slice(0, 20), remoteVsOnsite, rateByTech: rateByTech.slice(0, 20), freshness },
      insights,
    };
  }

  private async getHardToFillRoles() {
    return this.prisma.$queryRaw`
      WITH demand AS (
        SELECT skill, COUNT(*)::int as req_count
        FROM vendor_req_signal, unnest(skills) as skill
        WHERE created_at >= NOW() - interval '30 days'
        GROUP BY skill
      ),
      supply AS (
        SELECT skill, COUNT(*)::int as bench_count
        FROM consultant, unnest(primary_skills) as skill
        GROUP BY skill
      )
      SELECT d.skill as "role",
             d.req_count as "demand",
             COALESCE(s.bench_count, 0) as "supply",
             d.req_count - COALESCE(s.bench_count, 0) as "gap",
             CASE
               WHEN COALESCE(s.bench_count, 0) = 0 THEN 'IMPOSSIBLE'
               WHEN d.req_count > s.bench_count * 5 THEN 'VERY_HARD'
               WHEN d.req_count > s.bench_count * 2 THEN 'HARD'
               ELSE 'FILLABLE'
             END as "difficulty"
      FROM demand d
      LEFT JOIN supply s ON d.skill = s.skill
      WHERE d.req_count >= 5
      ORDER BY "gap" DESC
      LIMIT 20
    ` as Promise<any[]>;
  }

  private async getGeoDistribution() {
    return this.prisma.$queryRaw`
      SELECT location as "location", COUNT(*)::int as "count",
             COUNT(*) FILTER (WHERE employment_type IN ('C2C', 'W2'))::int as "c2cW2",
             COUNT(*) FILTER (WHERE rate_text IS NOT NULL)::int as "withRate"
      FROM vendor_req_signal
      WHERE location IS NOT NULL AND location != '' AND length(location) > 2
        AND created_at >= NOW() - interval '30 days'
      GROUP BY location
      HAVING COUNT(*) >= 3
      ORDER BY "count" DESC
      LIMIT 30
    ` as Promise<any[]>;
  }

  private async getRemoteVsOnsite() {
    return this.prisma.$queryRaw`
      SELECT
        CASE
          WHEN title ILIKE '%remote%' OR location ILIKE '%remote%' THEN 'REMOTE'
          WHEN title ILIKE '%hybrid%' THEN 'HYBRID'
          WHEN title ILIKE '%onsite%' OR title ILIKE '%on-site%' THEN 'ONSITE'
          ELSE 'UNSPECIFIED'
        END as "workModel",
        COUNT(*)::int as "count"
      FROM vendor_req_signal
      WHERE created_at >= NOW() - interval '30 days'
      GROUP BY "workModel"
      ORDER BY "count" DESC
    ` as Promise<any[]>;
  }

  private async getRateByTechnology() {
    return this.prisma.$queryRaw`
      SELECT
        skill as "technology",
        COUNT(*)::int as "totalReqs",
        COUNT(*) FILTER (WHERE rate_text IS NOT NULL)::int as "withRate",
        ROUND(AVG(
          CASE WHEN rate_text ~ '\$(\d+)' THEN (regexp_match(rate_text, '\$(\d+)'))[1]::int ELSE NULL END
        )::numeric, 0) as "avgRate"
      FROM vendor_req_signal, unnest(skills) as skill
      WHERE rate_text IS NOT NULL
      GROUP BY skill
      HAVING COUNT(*) >= 5 AND AVG(
        CASE WHEN rate_text ~ '\$(\d+)' THEN (regexp_match(rate_text, '\$(\d+)'))[1]::int ELSE NULL END
      ) IS NOT NULL
      ORDER BY "avgRate" DESC NULLS LAST
      LIMIT 25
    ` as Promise<any[]>;
  }

  private async getReqFreshness() {
    return this.prisma.$queryRaw`
      SELECT f."freshness", f."count"
      FROM (
        SELECT
          CASE
            WHEN created_at >= NOW() - interval '1 day' THEN 'FRESH_24H'
            WHEN created_at >= NOW() - interval '3 days' THEN 'RECENT_3D'
            WHEN created_at >= NOW() - interval '7 days' THEN 'THIS_WEEK'
            WHEN created_at >= NOW() - interval '30 days' THEN 'THIS_MONTH'
            ELSE 'OLDER'
          END as "freshness",
          COUNT(*)::int as "count"
        FROM vendor_req_signal
        GROUP BY 1
      ) f
      ORDER BY
        CASE f."freshness"
          WHEN 'FRESH_24H' THEN 1
          WHEN 'RECENT_3D' THEN 2
          WHEN 'THIS_WEEK' THEN 3
          WHEN 'THIS_MONTH' THEN 4
          ELSE 5
        END
    ` as Promise<any[]>;
  }

  private generateJobSearchInsights(data: any): string[] {
    const insights: string[] = [];
    const htf = data.hardToFill || [];
    const geo = data.geoDistribution || [];
    const rm = data.remoteVsOnsite || [];
    const rt = data.rateByTech || [];

    const impossible = htf.filter((h: any) => h.difficulty === 'IMPOSSIBLE');
    if (impossible.length > 0) {
      insights.push(`${impossible.length} roles have ZERO bench coverage: ${impossible.slice(0, 5).map((h: any) => h.role).join(', ')}. Critical recruiting gaps.`);
    }

    const remote = rm.find((r: any) => r.workModel === 'REMOTE');
    const onsite = rm.find((r: any) => r.workModel === 'ONSITE');
    if (remote && onsite) {
      insights.push(`Remote: ${remote.count} vs Onsite: ${onsite.count}. ${remote.count > onsite.count ? 'Remote dominates — expand remote bench.' : 'Onsite still strong — maintain local networks.'}`);
    }

    if (rt.length > 0) {
      const highPay = rt.filter((r: any) => r.avgRate >= 70).slice(0, 3);
      if (highPay.length > 0) {
        insights.push(`Highest-paying technologies: ${highPay.map((r: any) => `${r.technology} ($${r.avgRate}/hr avg)`).join(', ')}. Train bench consultants in these for premium placements.`);
      }
    }

    if (geo.length > 0) {
      insights.push(`Top hiring locations: ${geo.slice(0, 5).map((g: any) => `${g.location} (${g.count})`).join(', ')}.`);
    }

    return insights;
  }

  /* ═══════════════════════════════════════════════════════════════════
     AGENT 4: GM/CEO STRATEGIST — 1 CLOSURE/DAY
     ═══════════════════════════════════════════════════════════════════ */

  async runGmStrategist(tenantId: string) {
    const [
      systemHealth,
      closureModelData,
      recruiterEfficiency,
      bottlenecks,
      benchStrength,
    ] = await Promise.all([
      this.getSystemHealth(),
      this.getClosureModelData(tenantId),
      this.getRecruiterEfficiency(),
      this.getBottlenecks(tenantId),
      this.getBenchStrength(),
    ]);

    const closurePlan = this.generate1ClosurePerDayPlan(systemHealth, closureModelData, recruiterEfficiency, bottlenecks, benchStrength);

    return {
      agent: 'GM/CEO Strategist — 1 Closure/Day Engine',
      generatedAt: new Date().toISOString(),
      data: { systemHealth, closureModelData, recruiterEfficiency, bottlenecks, benchStrength },
      closurePlan,
    };
  }

  private async getSystemHealth() {
    const [result] = await this.prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM raw_email_message) as "totalEmails",
        (SELECT COUNT(*)::int FROM vendor_req_signal) as "totalReqs",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE actionability_score >= 60) as "qualityReqs",
        (SELECT COUNT(*)::int FROM consultant) as "totalConsultants",
        (SELECT COUNT(*)::int FROM vendor_company WHERE name NOT LIKE '[SYSTEM]%') as "activeVendors",
        (SELECT COUNT(*)::int FROM vendor_trust_score WHERE trust_score >= 60) as "trustedVendors",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE created_at >= NOW() - interval '1 day') as "reqsToday",
        (SELECT COUNT(*)::int FROM vendor_req_signal WHERE created_at >= NOW() - interval '7 days') as "reqsThisWeek",
        (SELECT MAX(sent_at) FROM raw_email_message) as "lastEmailSync"
    ` as any[];
    return result;
  }

  private async getClosureModelData(tenantId: string) {
    const [result] = await this.prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId}) as "totalSubmissions",
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId} AND status = 'SUBMITTED') as "activeSubmissions",
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId} AND status = 'INTERVIEWING') as "interviewing",
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId} AND status = 'OFFERED') as "offered",
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId} AND status = 'ACCEPTED') as "accepted",
        (SELECT COUNT(*)::int FROM "Submission" WHERE "tenantId" = ${tenantId} AND status = 'REJECTED') as "rejected"
    ` as any[];
    return result;
  }

  private async getRecruiterEfficiency() {
    return this.prisma.$queryRaw`
      SELECT
        mailbox_email as "email",
        SPLIT_PART(mailbox_email, '@', 1) as "name",
        COUNT(*) FILTER (WHERE category = 'VENDOR_REQ')::int as "reqsReceived",
        COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        )::int as "submissionsSent",
        COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::int as "interviews",
        COUNT(*) FILTER (WHERE subject ILIKE 'Re:%' AND from_email = mailbox_email)::int as "repliesSent",
        CASE WHEN COUNT(*) FILTER (WHERE
          from_email = mailbox_email
          AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
          AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
        ) > 0
          THEN ROUND(
            COUNT(*) FILTER (WHERE subject ILIKE '%interview%')::numeric /
            COUNT(*) FILTER (WHERE
              from_email = mailbox_email
              AND (subject ILIKE 'Submission -%' OR subject ILIKE 'Submission –%' OR subject ILIKE '%submit%for%')
              AND EXISTS (SELECT 1 FROM unnest(to_emails) t(a) WHERE SPLIT_PART(t.a,'@',2) NOT IN ('cloudresources.net','emonics.com',''))
            )::numeric * 100, 1
          ) ELSE 0 END as "conversionRate"
      FROM raw_email_message
      GROUP BY mailbox_email
      ORDER BY "submissionsSent" DESC
    ` as Promise<any[]>;
  }

  private async getBottlenecks(tenantId: string) {
    const bottlenecks: string[] = [];

    const [stuckSubs] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM "Submission"
      WHERE "tenantId" = ${tenantId} AND status = 'SUBMITTED'
        AND "updatedAt" < NOW() - interval '48 hours'
    ` as any[];
    if (stuckSubs?.cnt > 0) bottlenecks.push(`${stuckSubs.cnt} submissions stuck >48h without response — follow up immediately`);

    const [noConsentSubs] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM "Submission"
      WHERE "tenantId" = ${tenantId} AND status = 'CONSENT_PENDING'
    ` as any[];
    if (noConsentSubs?.cnt > 0) bottlenecks.push(`${noConsentSubs.cnt} submissions waiting for consultant consent — unblock these`);

    const [lowEngagement] = await this.prisma.$queryRaw`
      SELECT COUNT(*)::int as cnt FROM vendor_req_signal
      WHERE actionability_score >= 80 AND created_at >= NOW() - interval '3 days'
    ` as any[];
    if (lowEngagement?.cnt > 20) bottlenecks.push(`${lowEngagement.cnt} PREMIUM reqs in last 3 days not yet acted on`);

    return bottlenecks;
  }

  private async getBenchStrength() {
    return this.prisma.$queryRaw`
      SELECT skill as "skill",
             COUNT(*)::int as "benchCount"
      FROM consultant, unnest(primary_skills) as skill
      WHERE full_name IS NOT NULL AND full_name != ''
      GROUP BY skill
      HAVING COUNT(*) >= 3
      ORDER BY "benchCount" DESC
      LIMIT 20
    ` as Promise<any[]>;
  }

  private generate1ClosurePerDayPlan(health: any, closure: any, recruiters: any[], bottlenecks: string[], bench: any[]): any {
    const totalSubs = closure?.totalSubmissions || 0;
    const accepted = closure?.accepted || 0;
    const conversionRate = totalSubs > 0 ? (accepted / totalSubs * 100) : 4;
    const subsNeededPerDay = Math.ceil(100 / Math.max(conversionRate, 1));

    return {
      title: '1 Closure/Day Execution Plan',
      currentState: {
        conversionRate: `${conversionRate.toFixed(1)}%`,
        submissionsPerDayNeeded: subsNeededPerDay,
        currentPipeline: {
          submitted: closure?.activeSubmissions || 0,
          interviewing: closure?.interviewing || 0,
          offered: closure?.offered || 0,
          closureProbability: `${Math.min(99, (closure?.offered || 0) * 60 + (closure?.interviewing || 0) * 15)}%`,
        },
        qualityReqsAvailable: health?.qualityReqs || 0,
        benchSize: health?.totalConsultants || 0,
        trustedVendorCount: health?.trustedVendors || 0,
      },
      dailyTargets: {
        submissions: Math.max(25, subsNeededPerDay),
        replyFollowups: 15,
        newVendorOutreach: 5,
        benchCallsScheduled: 10,
      },
      weeklyTargets: {
        interviews: 20,
        offers: 5,
        closures: 5,
        newConsultantsOnboarded: 10,
      },
      bottlenecks,
      topActions: [
        `Submit to ${subsNeededPerDay}+ PREMIUM reqs/day from HIGH-trust vendors`,
        'Follow up on every submission at T+4h, T+24h, T+48h — no exceptions',
        'Every recruiter must action their top 10 inbox reqs before 11am daily',
        'Weekly: onboard 10 new consultants in TOP 5 shortage skills',
        'Monthly: drop bottom 20% vendors by response rate, add 10 new',
      ],
      recruiterScorecard: recruiters.map((r: any) => ({
        name: r.name,
        reqsReceived: r.reqsReceived,
        submissionsSent: r.submissionsSent,
        interviews: r.interviews,
        conversionRate: `${r.conversionRate}%`,
        grade: r.conversionRate >= 5 ? 'A' : r.conversionRate >= 2 ? 'B' : r.conversionRate >= 1 ? 'C' : 'D',
      })),
    };
  }

  /* ═══════════════════════════════════════════════════════════════════
     AGENT 5: MANAGERIAL COACH — Productivity Improvement
     ═══════════════════════════════════════════════════════════════════ */

  async runManagerialCoach() {
    const recruiterMetrics = await this.getRecruiterEfficiency();
    const coaching = this.generateCoachingPlan(recruiterMetrics);

    return {
      agent: 'Managerial AI Coach',
      generatedAt: new Date().toISOString(),
      coaching,
    };
  }

  private generateCoachingPlan(recruiters: any[]): any {
    const plans: any[] = [];

    for (const r of recruiters) {
      const name = r.name;
      const strengths: string[] = [];
      const improvements: string[] = [];
      const actions: string[] = [];

      if (r.repliesSent > 1000) strengths.push('High reply volume — responsive to vendors');
      if (r.submissionsSent > 100) strengths.push('Active submitter — good hustle');
      if (r.interviews > 500) strengths.push('Strong interview pipeline');

      if (r.reqsReceived > 10000 && r.submissionsSent < 100) {
        improvements.push(`Receiving ${r.reqsReceived} reqs but only ${r.submissionsSent} submissions — very low conversion`);
        actions.push('Set daily target: action top 20 PREMIUM reqs by 11am');
        actions.push('Use "Quick Submit" from Mail Intel to speed up workflow');
      }

      if (r.repliesSent < r.reqsReceived * 0.1) {
        improvements.push('Low reply rate to incoming reqs — missed opportunities');
        actions.push('Respond to every C2C/W2 req within 4 hours during business hours');
      }

      if (r.interviews < r.submissionsSent * 0.05) {
        improvements.push('Low submission-to-interview conversion');
        actions.push('Improve resume formatting and submission quality');
        actions.push('Focus on vendors with >20% historical response rate');
      }

      const grade = r.conversionRate >= 5 ? 'A' : r.conversionRate >= 2 ? 'B' : r.conversionRate >= 1 ? 'C' : 'D';

      plans.push({
        name,
        email: r.email,
        grade,
        metrics: {
          reqsReceived: r.reqsReceived,
          submissionsSent: r.submissionsSent,
          interviews: r.interviews,
          repliesSent: r.repliesSent,
          conversionRate: `${r.conversionRate}%`,
        },
        strengths,
        improvements,
        actions,
      });
    }

    const teamActions = [
      'Daily 9am standup: each recruiter shares top 3 reqs they will submit to',
      'Weekly Friday: review per-recruiter scorecard and celebrate top performer',
      'Monthly: rotate vendor assignments to prevent stale relationships',
      'Implement "Speed to Submit" metric: time from req receipt to submission should be <2 hours',
      'Create submission templates for top 5 technologies to reduce prep time by 50%',
    ];

    return { individual: plans, teamActions };
  }
}
