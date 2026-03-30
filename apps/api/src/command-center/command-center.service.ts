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

  /* ── Helper: check if title contains junk patterns ── */
  private isJunkTitle(title: string): boolean {
    const junk = /unsubscribe|no third party|no c2c|w2 only|hot\s?list|bench|available|looking for|h1b/i;
    return junk.test(title);
  }

  /* ── Helper: detect premium skill family ── */
  private detectPremiumSkill(text: string): { family: string | null; bonus: number } {
    const lower = text.toLowerCase();
    if (/machine learning|deep learning|nlp|computer vision|pytorch|tensorflow|ai engineer|ml engineer|artificial intelligence|llm|large language model|generative ai|gen ai|langchain|rag|transformers/.test(lower))
      return { family: 'AI_ML', bonus: 15 };
    if (/mlops|ml ops|kubeflow|mlflow|sagemaker|vertex ai|model deployment|model serving|feature store|genai infra/.test(lower))
      return { family: 'MLOPS_GENAI', bonus: 13 };
    if (/data engineer|spark|airflow|databricks|snowflake|dbt|kafka|data pipeline|etl|data lake|data warehouse/.test(lower))
      return { family: 'DATA_ENGINEERING', bonus: 10 };
    if (/devops|platform engineer|sre|site reliability|kubernetes|terraform|cicd|ci\/cd|cloud architect|infrastructure as code/.test(lower))
      return { family: 'CLOUD_DEVOPS', bonus: 8 };
    if (/cybersecurity|security engineer|penetration test|soc analyst|siem|zero trust|devsecops|cloud security/.test(lower))
      return { family: 'CYBERSECURITY', bonus: 8 };
    return { family: null, bonus: 0 };
  }

  private async getActionableReqs(limit: number) {
    // Fetch email-based req signals using Prisma
    const rawSignals = await this.prisma.vendorReqSignal.findMany({
      where: {
        title: { not: '' },
        employmentType: 'C2C',
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        vendorCompany: { select: { name: true, domain: true } },
        vendorContact: { select: { name: true, email: true } },
      },
    });

    // Filter out junk and short titles, compute scores in JS
    const emailReqs = rawSignals
      .filter((s) => s.title && s.title.length > 15 && !this.isJunkTitle(s.title))
      .map((s) => {
        const skills = Array.isArray(s.skills) ? (s.skills as string[]) : [];
        const combined = `${s.title || ''} ${skills.join(' ')}`;
        const premium = this.detectPremiumSkill(combined);
        return {
          id: s.id,
          title: s.title,
          location: s.location,
          rateText: s.rateText,
          employmentType: s.employmentType,
          skills,
          actionabilityScore: s.actionabilityScore ?? 50,
          createdAt: s.createdAt,
          premiumSkillFamily: premium.family,
          premiumSkillBonus: premium.bonus,
          vendorName: s.vendorCompany?.name ?? null,
          vendorDomain: s.vendorCompany?.domain ?? null,
          contactEmail: s.vendorContact?.email ?? null,
          contactName: s.vendorContact?.name ?? null,
          vendorTrustScore: 30,
          vendorTier: 'UNCLASSIFIED',
          source: 'EMAIL',
        };
      });

    // Enrich vendor tier/trust from Vendor table
    const domains = [...new Set(emailReqs.map((r) => r.vendorDomain).filter(Boolean))] as string[];
    if (domains.length > 0) {
      const vendors = await this.prisma.vendor.findMany({
        where: { domain: { in: domains } },
        select: { domain: true, trustScore: true, tier: true },
      });
      const vendorMap = new Map(vendors.map((v) => [v.domain, v]));
      for (const req of emailReqs) {
        if (req.vendorDomain) {
          const v = vendorMap.get(req.vendorDomain);
          if (v) {
            req.vendorTrustScore = v.trustScore ?? 30;
            req.vendorTier = (v.tier as string) ?? 'UNCLASSIFIED';
          }
        }
      }
    }

    // Fetch market jobs
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    let marketJobs: any[] = [];
    try {
      const rawJobs = await this.prisma.marketJob.findMany({
        where: {
          title: { not: '' },
          postedAt: { gte: threeDaysAgo },
          source: { in: ['JSEARCH', 'CORPTOCORP'] },
        },
        orderBy: { postedAt: 'desc' },
        take: 50,
      });

      marketJobs = rawJobs.map((m) => {
        const skills = Array.isArray(m.skills) ? (m.skills as string[]) : [];
        const rateText = m.rateText || (m.rateMax && m.rateMax > 0 ? `$${Math.round(m.rateMin || 0)}-$${Math.round(m.rateMax)}` : null);
        return {
          id: m.id,
          title: m.title,
          location: m.location,
          rateText,
          employmentType: (m.employmentType as string) || 'C2C',
          skills,
          actionabilityScore: m.actionabilityScore ?? 70,
          createdAt: m.postedAt,
          vendorName: m.company,
          vendorDomain: m.source,
          contactEmail: m.applyUrl || m.sourceUrl,
          contactName: m.recruiterName,
          vendorTrustScore: m.realnessScore ?? 80,
          vendorTier: 'HIGH',
          source: m.source,
        };
      });
    } catch {
      // MarketJob table may not exist in all environments
    }

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
    try {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      // Get recent actionable reqs with skills
      const reqs = await this.prisma.vendorReqSignal.findMany({
        where: {
          createdAt: { gte: twoDaysAgo },
          NOT: { skills: { equals: [] } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // Get bench consultants
      const consultants = await this.prisma.consultant.findMany({
        where: {
          readiness: { in: ['SUBMISSION_READY', 'VERIFIED'] },
          firstName: { not: '' },
        },
        orderBy: { qualityScore: 'desc' },
        take: 10,
        select: { id: true, firstName: true, lastName: true, skills: true },
      });

      // Match in JS
      const matches: any[] = [];
      for (const req of reqs) {
        const reqSkills = Array.isArray(req.skills) ? (req.skills as string[]).map((s) => s.toLowerCase()) : [];
        if (reqSkills.length === 0) continue;

        for (const c of consultants) {
          const cSkills = Array.isArray(c.skills) ? (c.skills as string[]).map((s) => s.toLowerCase()) : [];
          const overlap = reqSkills.filter((s) => cSkills.includes(s)).length;
          if (overlap >= 2) {
            matches.push({
              id: req.id,
              title: req.title,
              location: req.location,
              rateText: req.rateText,
              employmentType: req.employmentType,
              skills: req.skills,
              createdAt: req.createdAt,
              premiumSkillFamily: req.premiumSkillFamily,
              vendorName: null,
              contactEmail: null,
              consultantId: c.id,
              consultantName: `${c.firstName} ${c.lastName}`,
              skill_overlap: overlap,
            });
          }
        }
      }

      matches.sort((a, b) => b.skill_overlap - a.skill_overlap);
      return matches.slice(0, limit);
    } catch (err) {
      this.logger.warn(`getBenchMatchReqs error: ${(err as Error).message}`);
      return [];
    }
  }

  private async getSubmissionPipelineStats(tenantId: string) {
    try {
      const stats = await this.prisma.submission.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: todayStart } },
      });

      return {
        byStatus: stats.map((s) => ({ status: s.status, count: s._count._all })),
        todayCount,
      };
    } catch {
      return { byStatus: [], todayCount: 0 };
    }
  }

  private async getDueFollowups() {
    // submission_followup may not exist in SQLite schema
    return [];
  }

  private async getStuckSubmissions(tenantId: string) {
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const stuck = await this.prisma.submission.findMany({
        where: {
          tenantId,
          status: 'SUBMITTED',
          updatedAt: { lt: cutoff },
        },
        orderBy: { updatedAt: 'asc' },
        take: 20,
        select: { id: true, jobId: true, consultantId: true, status: true, createdAt: true, updatedAt: true },
      });

      return stuck.map((s) => ({
        ...s,
        stuckHours: Math.round((Date.now() - new Date(s.updatedAt).getTime()) / (1000 * 60 * 60)),
      }));
    } catch {
      return [];
    }
  }

  private async getTodayActivity(tenantId: string) {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [submissionsCreated, submissionsSent, responsesReceived, interviewsScheduled] = await Promise.all([
        this.prisma.submission.count({
          where: { tenantId, createdAt: { gte: todayStart } },
        }),
        this.prisma.submission.count({
          where: { tenantId, status: 'SUBMITTED', updatedAt: { gte: todayStart } },
        }),
        this.prisma.submission.count({
          where: { tenantId, feedbackReceivedAt: { gte: todayStart } },
        }),
        this.prisma.submission.count({
          where: { tenantId, status: 'INTERVIEWING', updatedAt: { gte: todayStart } },
        }),
      ]);

      return { submissionsCreated, submissionsSent, responsesReceived, interviewsScheduled };
    } catch {
      return { submissionsCreated: 0, submissionsSent: 0, responsesReceived: 0, interviewsScheduled: 0 };
    }
  }

  private async getVendorLeaderboard() {
    try {
      const vendors = await this.prisma.vendor.findMany({
        where: { trustScore: { gte: 40 } },
        orderBy: { trustScore: 'desc' },
        take: 20,
        select: {
          companyName: true,
          domain: true,
          trustScore: true,
          tier: true,
          responseRate: true,
          interviewGrantRate: true,
          placementCount: true,
          avgBillRateMin: true,
          avgBillRateMax: true,
        },
      });

      return vendors.map((v) => ({
        vendorName: v.companyName,
        domain: v.domain,
        trustScore: v.trustScore ?? 0,
        tier: v.tier,
        responseRate: v.responseRate,
        interviewGrantRate: v.interviewGrantRate,
        placementCount: v.placementCount,
        avgBillRateMin: v.avgBillRateMin,
        avgBillRateMax: v.avgBillRateMax,
      }));
    } catch {
      return [];
    }
  }

  private async getLaneMetrics(tenantId: string) {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Auto-submit lane metrics
      let lanes: any[] = [];
      try {
        const items = await this.prisma.autoSubmitQueueItem.findMany({
          where: { tenantId, createdAt: { gte: sevenDaysAgo } },
          select: { sourcingLane: true, status: true, opportunityPriority: true, matchScore: true, premiumSkillBonus: true },
        });

        const laneMap = new Map<string, { total: number; queued: number; sent: number; approved: number; priorities: number[]; matchScores: number[]; premiumBonuses: number[] }>();
        for (const item of items) {
          const lane = (item.sourcingLane as string) || 'UNASSIGNED';
          if (!laneMap.has(lane)) laneMap.set(lane, { total: 0, queued: 0, sent: 0, approved: 0, priorities: [], matchScores: [], premiumBonuses: [] });
          const l = laneMap.get(lane)!;
          l.total++;
          if (item.status === 'QUEUED') l.queued++;
          if (item.status === 'SENT') l.sent++;
          if (item.status === 'APPROVED') l.approved++;
          if (item.opportunityPriority != null) l.priorities.push(item.opportunityPriority);
          if (item.matchScore != null) l.matchScores.push(item.matchScore);
          if (item.premiumSkillBonus != null) l.premiumBonuses.push(item.premiumSkillBonus);
        }

        lanes = [...laneMap.entries()].map(([lane, l]) => ({
          lane,
          total: l.total,
          queued: l.queued,
          sent: l.sent,
          approved: l.approved,
          avgPriority: l.priorities.length > 0 ? Math.round(l.priorities.reduce((a, b) => a + b, 0) / l.priorities.length * 10) / 10 : null,
          avgMatchScore: l.matchScores.length > 0 ? Math.round(l.matchScores.reduce((a, b) => a + b, 0) / l.matchScores.length * 10) / 10 : null,
          avgPremiumBonus: l.premiumBonuses.length > 0 ? Math.round(l.premiumBonuses.reduce((a, b) => a + b, 0) / l.premiumBonuses.length * 10) / 10 : null,
        })).sort((a, b) => b.total - a.total);
      } catch { /* table may not exist */ }

      // Vendor tier distribution
      let vendorTiers: any[] = [];
      try {
        const tiers = await this.prisma.vendor.groupBy({
          by: ['tier'],
          where: { trustScore: { not: null } },
          _count: { _all: true },
          _avg: { trustScore: true },
        });
        vendorTiers = tiers.map((t) => ({
          tier: t.tier,
          count: t._count._all,
          avgTrust: t._avg.trustScore ? Math.round(t._avg.trustScore * 10) / 10 : null,
        }));
      } catch { /* ok */ }

      // Available supply
      let availableSupply: any[] = [];
      try {
        const supply = await this.prisma.consultant.groupBy({
          by: ['readiness'],
          where: { readiness: { in: ['SUBMISSION_READY', 'VERIFIED'] } },
          _count: { _all: true },
        });
        availableSupply = supply.map((s) => ({ readiness: s.readiness, count: s._count._all }));
      } catch { /* ok */ }

      return {
        lanes,
        vendorTiers,
        availableSupply,
        strategy: {
          PRIME_C2C: 'Prioritize: margin + speed. Trust >= 60, margin >= $10/hr. Fast follow-up.',
          BROAD_C2C_W2: 'Volume play: strict dedupe, lower priority than Lane 1. Auto-deprioritize low-conversion vendors.',
          FTE_HIGH_COMP: 'Premium vertical: comp-verified only, shortlist top candidates, human review for mega roles.',
          OPT_JUNIOR_FTE: 'Early-career pipeline: separate scoring, compliance-aware, junior-friendly employers.',
        },
      };
    } catch {
      return {
        lanes: [],
        vendorTiers: [],
        availableSupply: [],
        strategy: {},
      };
    }
  }

  private calculateDailyQuota(stats: any): number {
    const todaySoFar = stats.todayCount || 0;
    return Math.max(0, 25 - todaySoFar);
  }

  private estimateClosureProbability(stats: any): number {
    const submitted = (stats.byStatus || []).find((s: any) => s.status === 'SUBMITTED')?.count || 0;
    const interviewing = (stats.byStatus || []).find((s: any) => s.status === 'INTERVIEWING')?.count || 0;
    const offered = (stats.byStatus || []).find((s: any) => s.status === 'OFFERED')?.count || 0;

    return Math.min(99, Math.round(offered * 60 + interviewing * 15 + submitted * 2));
  }

  /* ═══════ Actionability Scoring for Req Signals ═══════ */

  async computeActionabilityScores() {
    this.logger.log('Computing actionability + premium skill scores...');

    const BATCH_SIZE = 500;
    let totalUpdated = 0;

    // Process VendorReqSignal in batches
    while (true) {
      const batch = await this.prisma.vendorReqSignal.findMany({
        where: { OR: [{ actionabilityScore: null }, { actionabilityScore: 0 }] },
        take: BATCH_SIZE,
        select: {
          id: true,
          title: true,
          vendorContactId: true,
          rateText: true,
          location: true,
          skills: true,
          employmentType: true,
          createdAt: true,
          vendorCompanyId: true,
        },
      });

      if (batch.length === 0) break;

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      for (const row of batch) {
        let score = 0;
        const title = row.title || '';
        const skills = Array.isArray(row.skills) ? (row.skills as string[]) : [];
        const combined = `${title} ${skills.join(' ')}`;

        if (title) score += 20;
        if (row.vendorContactId) score += 20;
        if (row.rateText) score += 15;
        if (row.location) score += 10;
        if (skills.length > 0) score += 10;
        if (['C2C', 'W2', 'CONTRACT'].includes(row.employmentType ?? '')) score += 10;
        if (row.createdAt >= threeDaysAgo) score += 10;
        if (/no third party|no c2c|w2 only/i.test(title)) score -= 30;

        const premium = this.detectPremiumSkill(combined);
        score += premium.bonus;

        let engagementModel = 'UNKNOWN';
        if (/c2c|corp to corp|corp-to-corp/i.test(title)) engagementModel = 'C2C';
        else if (/w2/i.test(title)) engagementModel = 'W2';
        else if (/1099/i.test(title)) engagementModel = '1099';
        else if (/full time|fte|permanent/i.test(title)) engagementModel = 'FTE';

        let employmentNature = 'UNKNOWN';
        if (/contract to hire|c2h|contract-to-hire/i.test(title)) employmentNature = 'C2H';
        else if (/contract/i.test(title) || ['CONTRACT', 'C2C', 'W2', '1099'].includes(row.employmentType ?? '')) employmentNature = 'CONTRACT';
        else if (/perm|full time|fte/i.test(title)) employmentNature = 'PERM';

        await this.prisma.vendorReqSignal.update({
          where: { id: row.id },
          data: {
            actionabilityScore: Math.max(0, score),
            engagementModel,
            employmentNature,
            premiumSkillFamily: premium.family,
            premiumSkillBonus: premium.bonus,
          },
        });
      }

      totalUpdated += batch.length;
      this.logger.log(`Batch scored ${batch.length} rows (total: ${totalUpdated})`);

      if (batch.length < BATCH_SIZE) break;
    }

    this.logger.log(`Completed: scored ${totalUpdated} req signals total`);

    // Distribution stats
    const allScored = await this.prisma.vendorReqSignal.findMany({
      where: { actionabilityScore: { not: null } },
      select: { actionabilityScore: true, premiumSkillFamily: true, engagementModel: true, employmentNature: true },
    });

    let highAction = 0, mediumAction = 0, lowAction = 0, junk = 0;
    let totalScore = 0;
    const premiumMap = new Map<string, { count: number; totalScore: number }>();
    const engagementMap = new Map<string, number>();

    for (const row of allScored) {
      const s = row.actionabilityScore ?? 0;
      totalScore += s;
      if (s >= 80) highAction++;
      else if (s >= 50) mediumAction++;
      else if (s >= 20) lowAction++;
      else junk++;

      if (row.premiumSkillFamily) {
        const p = premiumMap.get(row.premiumSkillFamily) ?? { count: 0, totalScore: 0 };
        p.count++;
        p.totalScore += s;
        premiumMap.set(row.premiumSkillFamily, p);
      }

      const key = `${row.engagementModel || 'UNKNOWN'}|${row.employmentNature || 'UNKNOWN'}`;
      engagementMap.set(key, (engagementMap.get(key) ?? 0) + 1);
    }

    return {
      updated: totalUpdated,
      distribution: {
        highAction,
        mediumAction,
        lowAction,
        junk,
        avgScore: allScored.length > 0 ? Math.round(totalScore / allScored.length * 10) / 10 : 0,
      },
      premiumBreakdown: [...premiumMap.entries()].map(([family, p]) => ({
        family,
        count: p.count,
        avgScore: Math.round(p.totalScore / p.count * 10) / 10,
      })).sort((a, b) => b.count - a.count),
      engagementBreakdown: [...engagementMap.entries()].map(([key, count]) => {
        const [model, nature] = key.split('|');
        return { model, nature, count };
      }).sort((a, b) => b.count - a.count),
    };
  }
}
