import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionsService } from '../submissions/submissions.service';

interface ReqCandidate {
  id: string;
  title: string;
  location: string | null;
  rateText: string | null;
  skills: string[];
  source: string;
  vendorName: string | null;
  vendorDomain: string | null;
  vendorTrustScore: number | null;
  contactEmail: string | null;
  contactName: string | null;
  createdAt: Date;
}

interface ConsultantCandidate {
  id: string;
  tenantId: string;
  name: string;
  skills: string[];
  desiredRate: number | null;
  readiness: string;
  qualityScore: number | null;
  interviewCount: number;
  offerCount: number;
  placementCount: number;
}

interface MatchResult {
  consultant: ConsultantCandidate;
  score: number;
  reasons: string[];
  marginEstimate: number | null;
  premiumSkillBonus: number;
  supplyFitScore: number;
  opportunityPriority: number;
  sourcingLane: string;
}

const PREMIUM_SKILL_KEYWORDS: Record<string, string[]> = {
  AI_ML: ['machine learning', 'deep learning', 'nlp', 'computer vision', 'pytorch', 'tensorflow', 'ai engineer', 'ml engineer', 'artificial intelligence', 'neural network', 'llm', 'large language model', 'generative ai', 'gen ai', 'chatgpt', 'openai', 'langchain', 'rag', 'fine-tuning', 'transformers', 'hugging face'],
  MLOPS_GENAI: ['mlops', 'ml ops', 'kubeflow', 'mlflow', 'sagemaker', 'vertex ai', 'model deployment', 'model serving', 'feature store', 'model monitoring', 'genai infra', 'llmops'],
  DATA_ENGINEERING: ['data engineer', 'spark', 'airflow', 'databricks', 'snowflake', 'dbt', 'kafka', 'data pipeline', 'etl', 'data lake', 'data warehouse', 'bigquery', 'redshift'],
  CLOUD_DEVOPS: ['devops', 'platform engineer', 'sre', 'site reliability', 'kubernetes', 'k8s', 'terraform', 'ansible', 'cicd', 'ci/cd', 'aws architect', 'azure architect', 'gcp architect', 'cloud architect', 'infrastructure as code'],
  CYBERSECURITY: ['cybersecurity', 'security engineer', 'penetration test', 'soc analyst', 'siem', 'zero trust', 'identity access', 'iam', 'devsecops', 'cloud security', 'threat', 'vulnerability'],
  SWE_CORE: ['java', '.net', 'python', 'full stack', 'react', 'angular', 'node.js', 'golang', 'rust', 'microservices', 'spring boot'],
};

const PREMIUM_BONUS_POINTS: Record<string, number> = {
  AI_ML: 15,
  MLOPS_GENAI: 13,
  DATA_ENGINEERING: 10,
  CLOUD_DEVOPS: 8,
  CYBERSECURITY: 8,
  SWE_CORE: 3,
};

@Injectable()
export class AutoSubmitService {
  private readonly logger = new Logger(AutoSubmitService.name);

  constructor(
    private prisma: PrismaService,
    private submissionsService: SubmissionsService,
  ) {}

  /**
   * Runs daily at 7 AM — generates the day's auto-submit queue.
   */
  @Cron('0 7 * * 1-5')
  async generateDailyQueue() {
    this.logger.log('Generating daily auto-submit queue...');

    try {
      const stats = await this.buildQueue();
      this.logger.log(
        `Queue generated: ${stats.itemsCreated} items from ${stats.reqsScanned} reqs, ${stats.consultantsMatched} consultants matched`,
      );
    } catch (err: any) {
      this.logger.error(`Queue generation failed: ${err.message}`);
    }
  }

  /**
   * Expire stale queue items every hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleItems() {
    const result = await this.prisma.$executeRaw`
      UPDATE "AutoSubmitQueueItem"
      SET status = 'EXPIRED'
      WHERE status = 'QUEUED'
        AND "expiresAt" < NOW()
    `;
    if (result > 0) {
      this.logger.log(`Expired ${result} stale queue items`);
    }
  }

  async buildQueue(): Promise<{ reqsScanned: number; consultantsMatched: number; itemsCreated: number }> {
    // Fetch premium reqs from trusted vendors (last 48h)
    const emailReqs = await this.prisma.$queryRaw`
      SELECT
        vrs.id::text as id,
        vrs.title,
        vrs.location,
        vrs."rateText",
        vrs.skills,
        'EMAIL' as source,
        vc.name as "vendorName",
        vc.domain as "vendorDomain",
        COALESCE(v."trustScore", 50) as "vendorTrustScore",
        vct.email as "contactEmail",
        vct.name as "contactName",
        vrs."createdAt"
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      LEFT JOIN "Vendor" v ON v.domain = vc.domain
      WHERE vrs."createdAt" >= NOW() - interval '48 hours'
        AND vrs.title IS NOT NULL AND length(vrs.title) > 15
        AND vrs."employmentType" = 'C2C'
        AND COALESCE(vrs."actionabilityScore", 50) >= 50
        AND vrs.title !~* '(unsubscribe|no third party|no c2c|w2 only|hot.?list|bench|available|looking for|h1b)'
        AND COALESCE(v."trustScore", 50) >= 40
      ORDER BY COALESCE(v."trustScore", 50) DESC, vrs."createdAt" DESC
      LIMIT 100
    ` as ReqCandidate[];

    const marketReqs = await this.prisma.$queryRaw`
      SELECT
        m.id::text as id,
        m.title,
        m.location,
        COALESCE(m."rateText", CASE WHEN m."rateMax" > 0 THEN '$' || m."rateMin"::int || '-$' || m."rateMax"::int ELSE NULL END) as "rateText",
        CASE WHEN m.skills IS NOT NULL THEN ARRAY(SELECT jsonb_array_elements_text(m.skills)) ELSE ARRAY[]::text[] END as skills,
        m.source::text as source,
        m.company as "vendorName",
        m.source::text as "vendorDomain",
        COALESCE(m."realnessScore", 70) as "vendorTrustScore",
        COALESCE(m."applyUrl", m."sourceUrl") as "contactEmail",
        m."recruiterName" as "contactName",
        m."postedAt" as "createdAt"
      FROM "MarketJob" m
      WHERE m."postedAt" >= NOW() - interval '48 hours'
        AND m.title IS NOT NULL AND m.title != ''
        AND m.source IN ('JSEARCH', 'CORPTOCORP')
        AND COALESCE(m."actionabilityScore", 70) >= 50
      ORDER BY m."postedAt" DESC
      LIMIT 50
    ` as ReqCandidate[];

    const allReqs = [...marketReqs, ...emailReqs];
    if (allReqs.length === 0) return { reqsScanned: 0, consultantsMatched: 0, itemsCreated: 0 };

    // Fetch available consultants (fixed readiness filter to match actual enum values)
    const consultants = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c."tenantId",
        c."firstName" || ' ' || c."lastName" as name,
        c.skills,
        c."desiredRate",
        c.readiness::text as readiness,
        c."qualityScore",
        COALESCE(c."interviewCount", 0) as "interviewCount",
        COALESCE(c."offerCount", 0) as "offerCount",
        COALESCE(c."placementCount", 0) as "placementCount"
      FROM "Consultant" c
      WHERE c.readiness IN ('SUBMISSION_READY', 'VERIFIED', 'NEW', 'DOCS_PENDING')
        AND c.readiness != 'ON_ASSIGNMENT'
        AND c.readiness != 'OFFBOARDED'
      ORDER BY c."qualityScore" DESC NULLS LAST, c."desiredRate" DESC NULLS LAST
      LIMIT 200
    ` as ConsultantCandidate[];

    if (consultants.length === 0) return { reqsScanned: allReqs.length, consultantsMatched: 0, itemsCreated: 0 };

    // Parse consultant skills into searchable arrays
    const parsedConsultants = consultants.map((c) => ({
      ...c,
      skillSet: this.parseSkills(c.skills),
    }));

    let itemsCreated = 0;
    const consultantsMatched = new Set<string>();
    const expiresAt = new Date(Date.now() + 24 * 3600_000); // 24h from now

    for (const req of allReqs) {
      if (itemsCreated >= 50) break; // Cap at 50 items per day

      const reqSkillSet = this.parseSkills(req.skills);
      if (reqSkillSet.length === 0) continue;

      const matches = this.findTopMatches(req, reqSkillSet, parsedConsultants, 3);

      for (const match of matches) {
        // Dedup: don't queue same consultant+req combo
        const existingCount = await this.prisma.$queryRaw`
          SELECT COUNT(*)::int as c FROM "AutoSubmitQueueItem"
          WHERE "consultantId" = ${match.consultant.id}
            AND "reqTitle" = ${req.title}
            AND status IN ('QUEUED', 'APPROVED', 'SENT')
            AND "createdAt" >= NOW() - interval '7 days'
        ` as any[];

        if (existingCount[0]?.c > 0) continue;

        await this.prisma.autoSubmitQueueItem.create({
          data: {
            tenantId: match.consultant.tenantId,
            reqSignalId: req.source === 'EMAIL' ? req.id : null,
            marketJobId: req.source !== 'EMAIL' ? req.id : null,
            consultantId: match.consultant.id,
            reqTitle: req.title,
            reqLocation: req.location,
            reqRate: req.rateText,
            reqSkills: req.skills || [],
            reqSource: req.source,
            vendorName: req.vendorName,
            vendorDomain: req.vendorDomain,
            vendorTrustScore: req.vendorTrustScore,
            contactEmail: req.contactEmail,
            contactName: req.contactName,
            consultantName: match.consultant.name,
            consultantSkills: match.consultant.skills || [],
            matchScore: match.score,
            matchReasons: match.reasons,
            marginEstimate: match.marginEstimate,
            status: 'QUEUED',
            expiresAt,
            sourcingLane: match.sourcingLane as any,
            premiumSkillBonus: match.premiumSkillBonus,
            supplyFitScore: match.supplyFitScore,
            opportunityPriority: match.opportunityPriority,
          },
        });

        itemsCreated++;
        consultantsMatched.add(match.consultant.id);
      }
    }

    return {
      reqsScanned: allReqs.length,
      consultantsMatched: consultantsMatched.size,
      itemsCreated,
    };
  }

  private findTopMatches(
    req: ReqCandidate,
    reqSkillSet: string[],
    consultants: Array<ConsultantCandidate & { skillSet: string[] }>,
    topN: number,
  ): MatchResult[] {
    const scored: MatchResult[] = [];

    for (const c of consultants) {
      const result = this.computeMatchScore(reqSkillSet, c.skillSet, req, c);
      if (result.score < 30) continue;

      let marginEstimate: number | null = null;
      if (c.desiredRate && req.rateText) {
        const rateMatch = req.rateText.match(/\$?(\d+)/);
        if (rateMatch?.[1]) {
          marginEstimate = parseInt(rateMatch[1], 10) - c.desiredRate;
        }
      }

      scored.push({
        consultant: c,
        score: result.score,
        reasons: result.reasons,
        marginEstimate,
        premiumSkillBonus: result.premiumSkillBonus,
        supplyFitScore: result.supplyFitScore,
        opportunityPriority: result.opportunityPriority,
        sourcingLane: result.sourcingLane,
      });
    }

    // Sort by opportunityPriority first (best closable openings), then score
    scored.sort((a, b) => b.opportunityPriority - a.opportunityPriority || b.score - a.score);
    return scored.slice(0, topN);
  }

  private computeMatchScore(
    reqSkills: string[],
    consultantSkills: string[],
    req: ReqCandidate,
    consultant: ConsultantCandidate,
  ): { score: number; reasons: string[]; premiumSkillBonus: number; supplyFitScore: number; opportunityPriority: number; sourcingLane: string } {
    let score = 0;
    const reasons: string[] = [];

    // ── 1. Skill overlap (max 50 points, reduced from 60 to make room for premium bonus)
    const reqLower = new Set(reqSkills.map((s) => s.toLowerCase()));
    const overlapCount = consultantSkills.filter((s) => reqLower.has(s.toLowerCase())).length;

    if (overlapCount >= 4) {
      score += 50;
      reasons.push(`${overlapCount} skills matched (excellent)`);
    } else if (overlapCount >= 3) {
      score += 38;
      reasons.push(`${overlapCount} skills matched (good)`);
    } else if (overlapCount >= 2) {
      score += 25;
      reasons.push(`${overlapCount} skills matched`);
    } else if (overlapCount === 1) {
      score += 12;
      reasons.push(`1 skill matched`);
    }

    // ── 2. Premium Skill Family Bonus (max 15 points)
    const allText = [req.title, ...(req.skills || [])].join(' ').toLowerCase();
    let premiumSkillBonus = 0;
    for (const [family, keywords] of Object.entries(PREMIUM_SKILL_KEYWORDS)) {
      const hasMatch = keywords.some((kw) => allText.includes(kw));
      if (hasMatch) {
        const bonus = PREMIUM_BONUS_POINTS[family] || 0;
        if (bonus > premiumSkillBonus) {
          premiumSkillBonus = bonus;
          reasons.push(`Premium: ${family.replace('_', '/')} (+${bonus})`);
        }
      }
    }
    // Cap so a bad vendor+bad rate+no fit doesn't float just because it says "AI"
    const cappedPremiumBonus = Math.min(premiumSkillBonus, 15);
    score += cappedPremiumBonus;

    // ── 3. Vendor trust bonus (max 15 points)
    const trust = req.vendorTrustScore ?? 0;
    if (trust >= 70) {
      score += 15;
      reasons.push(`Trusted vendor (${Math.round(trust)})`);
    } else if (trust >= 50) {
      score += 8;
    } else if (trust >= 30) {
      score += 3;
    }

    // ── 4. Source quality bonus (max 8 points)
    if (req.source === 'JSEARCH') {
      score += 8;
      reasons.push('JSearch source');
    } else if (req.source === 'CORPTOCORP') {
      score += 7;
      reasons.push('CorpToCorp source');
    } else if (req.source === 'EMAIL') {
      score += 5;
    }

    // ── 5. Consultant readiness + quality (max 10 points)
    if (consultant.readiness === 'SUBMISSION_READY') {
      score += 10;
      reasons.push('Submission-ready');
    } else if (consultant.readiness === 'VERIFIED') {
      score += 7;
      reasons.push('Verified consultant');
    } else if (consultant.readiness === 'DOCS_PENDING') {
      score += 3;
    }

    // ── 6. Candidate track record bonus (max 7 points)
    if (consultant.placementCount > 0) {
      score += 4;
      reasons.push(`${consultant.placementCount} prior placement(s)`);
    }
    if (consultant.interviewCount >= 3) {
      score += 2;
      reasons.push('Interview-proven');
    }
    if (consultant.offerCount > 0) {
      score += 1;
    }

    // ── 7. Rate fit (max 5 points)
    let marginEstimateForPriority = 0;
    if (consultant.desiredRate && req.rateText) {
      const rateMatch = req.rateText.match(/\$?(\d+)/);
      if (rateMatch?.[1]) {
        const reqRate = parseInt(rateMatch[1], 10);
        marginEstimateForPriority = reqRate - consultant.desiredRate;
        if (marginEstimateForPriority >= 15) {
          score += 5;
          reasons.push(`Strong margin ($${Math.round(marginEstimateForPriority)}/hr)`);
        } else if (marginEstimateForPriority >= 10) {
          score += 3;
          reasons.push('Good margin');
        }
      }
    }

    const baseScore = Math.min(score, 110);

    // ── 8. Supply-fit score: how well does our supply match this demand?
    const supplyFitScore = Math.min(100,
      (overlapCount >= 3 ? 40 : overlapCount >= 2 ? 25 : overlapCount >= 1 ? 10 : 0) +
      (consultant.readiness === 'SUBMISSION_READY' ? 25 : consultant.readiness === 'VERIFIED' ? 15 : 5) +
      (consultant.placementCount > 0 ? 20 : consultant.interviewCount > 0 ? 10 : 0) +
      (marginEstimateForPriority >= 10 ? 15 : marginEstimateForPriority >= 5 ? 8 : 0),
    );

    // ── 9. Opportunity Priority = combined signal
    // OpportunityPriority = Actionability × Trust × Margin × Supply × Readiness × Close probability
    const trustNorm = Math.min(trust / 100, 1);
    const marginNorm = Math.min(Math.max(marginEstimateForPriority, 0) / 30, 1);
    const supplyNorm = supplyFitScore / 100;
    const skillNorm = Math.min(baseScore / 80, 1);
    const opportunityPriority = Math.round(
      (skillNorm * 0.30 + trustNorm * 0.25 + supplyNorm * 0.25 + marginNorm * 0.15 + (cappedPremiumBonus / 15) * 0.05) * 100,
    );

    // ── 10. Determine sourcing lane
    let sourcingLane = 'BROAD_C2C_W2';
    if (trust >= 60 && req.source === 'EMAIL' && marginEstimateForPriority >= 10) {
      sourcingLane = 'PRIME_C2C';
    } else if (allText.includes('full time') || allText.includes('fulltime') || allText.includes('fte')) {
      if (allText.match(/\b(opt|cpt|entry.?level|junior|associate|new grad)\b/i)) {
        sourcingLane = 'OPT_JUNIOR_FTE';
      } else {
        sourcingLane = 'FTE_HIGH_COMP';
      }
    }

    return {
      score: Math.min(baseScore, 110),
      reasons,
      premiumSkillBonus: cappedPremiumBonus,
      supplyFitScore,
      opportunityPriority,
      sourcingLane,
    };
  }

  private parseSkills(skills: any): string[] {
    if (Array.isArray(skills)) return skills.map(String);
    if (typeof skills === 'string') {
      try { return JSON.parse(skills); } catch { return skills.split(',').map((s: string) => s.trim()); }
    }
    if (typeof skills === 'object' && skills !== null) {
      try { return Object.values(skills).map(String); } catch { return []; }
    }
    return [];
  }

  /* ═══════ Queue Management API ═══════ */

  async getQueue(tenantId: string, status?: string, lane?: string, limit = 50) {
    const where: any = { tenantId };
    if (status) where.status = status;
    else where.status = 'QUEUED';
    if (lane) where.sourcingLane = lane;

    return this.prisma.autoSubmitQueueItem.findMany({
      where,
      orderBy: [{ opportunityPriority: 'desc' }, { matchScore: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async getQueueStats(tenantId: string) {
    const stats = await this.prisma.autoSubmitQueueItem.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      _count: true,
    });

    const result: Record<string, number> = {
      queued: 0, approved: 0, rejected: 0, sent: 0, expired: 0,
    };
    for (const s of stats) {
      result[s.status.toLowerCase()] = s._count;
    }
    return { ...result, total: Object.values(result).reduce((a, b) => a + b, 0) };
  }

  async batchApprove(tenantId: string, itemIds: string[], userId: string) {
    const results: Array<{ id: string; status: string; submissionId?: string; error?: string }> = [];

    for (const itemId of itemIds) {
      try {
        const item = await this.prisma.autoSubmitQueueItem.findFirst({
          where: { id: itemId, tenantId, status: 'QUEUED' },
        });

        if (!item) {
          results.push({ id: itemId, status: 'error', error: 'Not found or already processed' });
          continue;
        }

        // Create the submission via the existing flow
        let submission: any;

        if (item.reqSignalId) {
          submission = await this.submissionsService.createFromReqSignal(tenantId, userId, {
            reqSignalId: item.reqSignalId,
            consultantId: item.consultantId,
            notes: `[auto-submit] Match score: ${item.matchScore} | ${(item.matchReasons as string[]).join(', ')}`,
          });
        } else {
          // For market jobs, create a job first then submit
          const vendor = await this.findOrCreateVendor(tenantId, item.vendorName, item.vendorDomain, item.contactEmail, item.contactName);

          const job = await this.prisma.job.create({
            data: {
              tenantId,
              vendorId: vendor.id,
              title: item.reqTitle,
              description: `Location: ${item.reqLocation || 'N/A'}\nRate: ${item.reqRate || 'N/A'}\nSource: ${item.reqSource}\nVendor: ${item.vendorName || 'Unknown'}`,
              skills: item.reqSkills || [],
              location: item.reqLocation,
              status: 'ACTIVE',
            } as any,
          });

          submission = await this.submissionsService.create(tenantId, userId, {
            jobId: job.id,
            consultantId: item.consultantId,
            notes: `[auto-submit] Match score: ${item.matchScore} | Source: ${item.reqSource}`,
          });
        }

        // Send immediately
        const sendResult = await this.submissionsService.send(tenantId, submission.id, userId);

        await this.prisma.autoSubmitQueueItem.update({
          where: { id: itemId },
          data: {
            status: 'SENT',
            reviewedBy: userId,
            reviewedAt: new Date(),
            submissionId: submission.id,
            sentAt: new Date(),
          },
        });

        results.push({ id: itemId, status: 'sent', submissionId: submission.id });

        this.logger.log(
          `Auto-submit approved+sent: ${item.consultantName} → ${item.reqTitle} (score: ${item.matchScore})`,
        );
      } catch (err: any) {
        this.logger.error(`Auto-submit ${itemId} failed: ${err.message}`);
        results.push({ id: itemId, status: 'error', error: err.message });
      }
    }

    return results;
  }

  async batchReject(tenantId: string, itemIds: string[], userId: string) {
    const updated = await this.prisma.autoSubmitQueueItem.updateMany({
      where: {
        id: { in: itemIds },
        tenantId,
        status: 'QUEUED',
      },
      data: {
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });

    return { rejected: updated.count };
  }

  async triggerQueueBuild(tenantId: string) {
    return this.buildQueue();
  }

  private async findOrCreateVendor(
    tenantId: string,
    companyName: string | null,
    domain: string | null,
    contactEmail: string | null,
    contactName: string | null,
  ) {
    if (domain) {
      const existing = await this.prisma.vendor.findFirst({
        where: { tenantId, domain },
      });
      if (existing) return existing;
    }

    return this.prisma.vendor.create({
      data: {
        tenantId,
        companyName: companyName || domain || 'Unknown Vendor',
        domain,
        contactEmail,
        contactName,
      },
    });
  }
}
