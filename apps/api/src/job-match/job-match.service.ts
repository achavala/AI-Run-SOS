import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/* ═══════════════════════════════════════════════════════════════════
 *  Interfaces
 * ═══════════════════════════════════════════════════════════════════ */

interface ScoreBreakdown {
  mustHaveSkills: number;      // max 30
  niceToHaveSkills: number;    // max 15
  yearsExperience: number;     // max 10
  domainRelevance: number;     // max 10
  toolsPlatformFit: number;    // max 10
  projectRelevance: number;    // max 10
  locationFit: number;         // max 5
  visaEligibility: number;     // max 5
  rateAttractiveness: number;  // max 5
  total: number;
}

interface ScoreResult {
  breakdown: ScoreBreakdown;
  reasons: string[];
  gaps: string[];
  visaEligible: boolean;
  visaNote: string | null;
  empTypeMatch: boolean;
}

interface JobData {
  id: string;
  title: string;
  description: string;
  skills: string[];
  location: string | null;
  locationType: string;
  employmentType?: string | null;
  rateMin: number | null;
  rateMax: number | null;
  rateType?: string;
  company?: string | null;
  vendorOrClient?: string | null;
  source?: string;
  jobType: 'internal' | 'market';
}

/* ═══════════════════════════════════════════════════════════════════
 *  Constants
 * ═══════════════════════════════════════════════════════════════════ */

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  fintech: ['fintech', 'banking', 'payments', 'credit', 'trading', 'financial', 'hedge fund', 'investment'],
  healthcare: ['healthcare', 'health', 'medical', 'pharma', 'clinical', 'hipaa', 'ehr', 'epic', 'cerner'],
  ecommerce: ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'shopify', 'magento'],
  telecom: ['telecom', 'telecommunications', '5g', 'network', 'carrier'],
  insurance: ['insurance', 'insurtech', 'underwriting', 'claims', 'actuarial'],
  media: ['media', 'streaming', 'content', 'entertainment', 'publishing'],
  logistics: ['logistics', 'supply chain', 'shipping', 'warehouse', 'transportation'],
  energy: ['energy', 'oil', 'gas', 'renewable', 'solar', 'utilities'],
  government: ['government', 'federal', 'dod', 'clearance', 'public sector'],
  education: ['education', 'edtech', 'learning', 'university', 'academic'],
};

const TOOLS_PLATFORM_KEYWORDS = [
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ansible', 'jenkins', 'circleci', 'github actions', 'gitlab ci',
  'kafka', 'rabbitmq', 'redis', 'elasticsearch', 'mongodb', 'postgres',
  'postgresql', 'mysql', 'dynamodb', 'snowflake', 'databricks', 'spark',
  'airflow', 'mlflow', 'sagemaker', 'vertex ai', 'openai', 'langchain',
  'datadog', 'splunk', 'grafana', 'prometheus', 'new relic',
  'jira', 'confluence', 'figma', 'tableau', 'power bi',
];

const NICE_TO_HAVE_KEYWORDS = [
  'agile', 'scrum', 'kanban', 'ci/cd', 'microservices', 'rest', 'graphql',
  'grpc', 'oauth', 'saml', 'sso', 'tdd', 'bdd', 'unit testing',
  'integration testing', 'devops', 'sre', 'monitoring', 'observability',
  'design patterns', 'solid', 'clean architecture', 'ddd', 'event-driven',
  'cqrs', 'serverless', 'lambda', 'ecs', 'eks', 'fargate',
  'linux', 'bash', 'shell scripting', 'git', 'version control',
  'communication', 'leadership', 'mentoring', 'cross-functional',
];

const POD_TEMPLATES: Record<string, { headerColor: string; sections: string[] }> = {
  SWE: {
    headerColor: '#1a56db',
    sections: ['Summary', 'Technical Skills', 'Professional Experience', 'Education', 'Certifications'],
  },
  CLOUD_DEVOPS: {
    headerColor: '#047857',
    sections: ['Summary', 'Cloud & DevOps Skills', 'Certifications', 'Professional Experience', 'Education'],
  },
  DATA: {
    headerColor: '#7c3aed',
    sections: ['Summary', 'Data & Analytics Skills', 'Professional Experience', 'Projects', 'Education'],
  },
  CYBER: {
    headerColor: '#dc2626',
    sections: ['Summary', 'Security Certifications', 'Security Skills', 'Professional Experience', 'Education'],
  },
  DEFAULT: {
    headerColor: '#374151',
    sections: ['Summary', 'Skills', 'Professional Experience', 'Education'],
  },
};

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  python: ['py'],
  kubernetes: ['k8s', 'kube'],
  react: ['reactjs', 'react.js'],
  angular: ['angularjs', 'angular.js'],
  node: ['nodejs', 'node.js'],
  vue: ['vuejs', 'vue.js'],
  'c#': ['csharp', 'c-sharp'],
  '.net': ['dotnet', 'dot-net'],
  postgres: ['postgresql', 'pg'],
  mongodb: ['mongo'],
  elasticsearch: ['elastic', 'es'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp'],
  'microsoft azure': ['azure'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'continuous integration': ['ci', 'ci/cd'],
  'continuous deployment': ['cd', 'ci/cd'],
  devops: ['dev-ops'],
  microservices: ['micro-services'],
};

const TECH_FAMILIES: Record<string, string[]> = {
  Java: ['java', 'spring', 'springboot', 'hibernate'],
  Python: ['python', 'django', 'flask', 'fastapi'],
  JavaScript: ['javascript', 'typescript', 'react', 'angular', 'vue', 'node', 'next'],
  DotNet: ['c#', '.net', 'dotnet', 'asp.net'],
  Cloud: ['aws', 'azure', 'gcp', 'cloud'],
  DevOps: ['docker', 'kubernetes', 'terraform', 'ansible', 'jenkins'],
  Data: ['spark', 'hadoop', 'airflow', 'snowflake', 'databricks', 'etl'],
  AI_ML: ['machine learning', 'ml', 'ai', 'tensorflow', 'pytorch', 'nlp', 'llm'],
  Cyber: ['security', 'cybersecurity', 'soc', 'siem', 'penetration'],
};

/* ═══════════════════════════════════════════════════════════════════
 *  Service
 * ═══════════════════════════════════════════════════════════════════ */

@Injectable()
export class JobMatchService {
  private readonly logger = new Logger(JobMatchService.name);
  private readonly resumeBaseDir =
    process.env.CONSULTANT_RESUME_BASE_DIR || path.join(process.cwd(), 'storage', 'resumes');
  private readonly appBaseUrl =
    process.env.APP_BASE_URL || 'http://localhost:3000';
  private readonly senderEmail =
    process.env.SUBMISSION_SENDER_EMAIL || 'recruiter@apex-staffing.com';

  private matchCache = new Map<string, { data: any; at: number }>();
  private readonly MATCH_CACHE_TTL = 5 * 60_000; // 5 minutes
  private resumeGenTasks = new Map<string, { status: string; result?: any; at: number }>();

  constructor(
    private prisma: PrismaService,
    private emailSender: EmailSenderService,
  ) {}

  private getCachedMatch(key: string): any | null {
    const entry = this.matchCache.get(key);
    if (entry && Date.now() - entry.at < this.MATCH_CACHE_TTL) return entry.data;
    if (entry) this.matchCache.delete(key);
    return null;
  }

  private setCachedMatch(key: string, data: any): void {
    this.matchCache.set(key, { data, at: Date.now() });
    if (this.matchCache.size > 500) {
      const cutoff = Date.now() - this.MATCH_CACHE_TTL;
      for (const [k, v] of this.matchCache) {
        if (v.at < cutoff) this.matchCache.delete(k);
      }
    }
  }

  trackResumeGeneration(taskId: string, status: string, result?: any): void {
    this.resumeGenTasks.set(taskId, { status, result, at: Date.now() });
    // Evict tasks older than 30 minutes
    if (this.resumeGenTasks.size > 100) {
      const cutoff = Date.now() - 30 * 60_000;
      for (const [k, v] of this.resumeGenTasks) {
        if (v.at < cutoff) this.resumeGenTasks.delete(k);
      }
    }
  }

  getResumeGenerationStatus(taskId: string): { status: string; result?: any } {
    const entry = this.resumeGenTasks.get(taskId);
    if (!entry) return { status: 'not_found' };
    return { status: entry.status, result: entry.result };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  1. MATCH CONSULTANTS TO JOB
   *  Fetch a single Job or MarketJob, score every eligible consultant,
   *  persist JobMatch rows, and return top 30.
   * ═══════════════════════════════════════════════════════════════ */

  async matchConsultantsToJob(
    tenantId: string,
    jobId: string,
    jobType: 'internal' | 'market',
  ) {
    const cacheKey = `match:${tenantId}:${jobId}:${jobType}`;
    const cached = this.getCachedMatch(cacheKey);
    if (cached) {
      this.logger.log(`matchConsultantsToJob: returning cached result for ${cacheKey}`);
      return cached;
    }

    this.logger.log(`matchConsultantsToJob: tenantId=${tenantId} jobId=${jobId} type=${jobType}`);

    // ── Fetch job data ────────────────────────────────────
    const jobData = await this.fetchJobData(tenantId, jobId, jobType);

    // ── Fetch eligible consultants with work auths & resume versions ──
    const consultants = await this.prisma.consultant.findMany({
      where: {
        tenantId,
        readiness: { in: ['SUBMISSION_READY', 'VERIFIED', 'ON_ASSIGNMENT'] },
      },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { where: { isCurrent: true }, take: 3, orderBy: { createdAt: 'desc' } },
      },
    });

    this.logger.log(`Found ${consultants.length} eligible consultants for scoring`);

    // ── Score each consultant ─────────────────────────────
    const scored = consultants.map((c) => {
      const currentAuth = c.workAuths.find((wa) => wa.isCurrent) ?? null;
      const scoreResult = this.computeScore(jobData, c, currentAuth);

      // Bill rate estimate: use desired rate, fall back to current rate, then median of job range
      let billRateEstimate: number | null = null;
      if (c.desiredRate) {
        billRateEstimate = c.desiredRate;
      } else if (c.currentRate) {
        billRateEstimate = c.currentRate * 1.25; // 25% markup for billing
      } else if (jobData.rateMax && jobData.rateMin) {
        billRateEstimate = (jobData.rateMin + jobData.rateMax) / 2;
      }

      return {
        consultant: c,
        scoreResult,
        billRateEstimate,
      };
    });

    // ── Sort by overallScore DESC, then billRateEstimate DESC ──
    scored.sort((a, b) => {
      const scoreDiff = b.scoreResult.breakdown.total - a.scoreResult.breakdown.total;
      if (scoreDiff !== 0) return scoreDiff;
      return (b.billRateEstimate ?? 0) - (a.billRateEstimate ?? 0);
    });

    // ── Upsert JobMatch rows ──────────────────────────────
    const top30 = scored.slice(0, 30);
    const upsertPromises = top30.map(({ consultant: c, scoreResult, billRateEstimate }) => {
      const data = {
        tenantId,
        ...(jobType === 'internal' ? { jobId } : { marketJobId: jobId }),
        consultantId: c.id,
        overallScore: scoreResult.breakdown.total,
        scoreBreakdown: scoreResult.breakdown as any,
        matchReasons: scoreResult.reasons as any,
        gaps: scoreResult.gaps as any,
        visaEligible: scoreResult.visaEligible,
        visaNote: scoreResult.visaNote,
        empTypeMatch: scoreResult.empTypeMatch,
        billRateEstimate,
        status: 'computed',
      };

      if (jobType === 'internal') {
        return this.prisma.jobMatch.upsert({
          where: {
            tenantId_jobId_consultantId: { tenantId, jobId, consultantId: c.id },
          },
          create: data,
          update: {
            overallScore: data.overallScore,
            scoreBreakdown: data.scoreBreakdown,
            matchReasons: data.matchReasons,
            gaps: data.gaps,
            visaEligible: data.visaEligible,
            visaNote: data.visaNote,
            empTypeMatch: data.empTypeMatch,
            billRateEstimate: data.billRateEstimate,
            status: 'computed',
          },
        });
      }

      // For market jobs: find existing or create
      return this.upsertMarketJobMatch(data);
    });

    await Promise.all(upsertPromises);

    this.logger.log(`Upserted ${top30.length} JobMatch records for ${jobType} job ${jobId}`);

    // ── Build response ────────────────────────────────────
    const result = {
      job: {
        id: jobData.id,
        title: jobData.title,
        type: jobType,
        skills: jobData.skills,
        location: jobData.location,
        locationType: jobData.locationType,
        employmentType: jobData.employmentType ?? null,
        rateMin: jobData.rateMin,
        rateMax: jobData.rateMax,
      },
      totalCandidatesScored: consultants.length,
      matches: top30.map(({ consultant: c, scoreResult, billRateEstimate }) => ({
        consultantId: c.id,
        consultantName: `${c.firstName} ${c.lastName}`,
        email: c.email,
        skills: c.skills as string[],
        readiness: c.readiness,
        qualityScore: c.qualityScore,
        overallScore: scoreResult.breakdown.total,
        scoreBreakdown: scoreResult.breakdown,
        matchReasons: scoreResult.reasons,
        gaps: scoreResult.gaps,
        visaEligible: scoreResult.visaEligible,
        visaNote: scoreResult.visaNote,
        empTypeMatch: scoreResult.empTypeMatch,
        billRateEstimate,
        hasResume: c.resumeVersions.length > 0,
      })),
    };

    this.setCachedMatch(cacheKey, result);
    return result;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  2. COMPUTE SCORE (private)
   *  Weighted scoring model — 100 points total.
   *  Points allocation:
   *    mustHaveSkills     30
   *    niceToHaveSkills   15
   *    yearsExperience    10
   *    domainRelevance    10
   *    toolsPlatformFit   10
   *    projectRelevance   10
   *    locationFit         5
   *    visaEligibility     5
   *    rateAttractiveness  5
   * ═══════════════════════════════════════════════════════════════ */

  private computeScore(
    jobData: JobData,
    consultant: any,
    workAuth: any | null,
  ): ScoreResult {
    const reasons: string[] = [];
    const gaps: string[] = [];

    const consultantSkills: string[] = Array.isArray(consultant.skills)
      ? (consultant.skills as string[]).map((s: string) =>
          typeof s === 'string' ? s.toLowerCase().trim() : '',
        )
      : [];

    let jobSkills: string[] = jobData.skills.map((s) => s.toLowerCase().trim()).filter(Boolean);
    const jobDescLower = (jobData.description || '').toLowerCase();
    const jobTitleLower = (jobData.title || '').toLowerCase();

    // Fallback: extract skills from title/description when job has 0 explicit skills
    if (jobSkills.length === 0) {
      jobSkills = this.extractSkillsFromText(`${jobTitleLower} ${jobDescLower}`);
    }

    // ── Must-have skills (max 30) ─────────────────────────
    let mustHaveMatched = 0;
    const matchedSkillNames: string[] = [];
    const missingSkillNames: string[] = [];

    for (const js of jobSkills) {
      if (!js) continue;
      const found = consultantSkills.some(
        (cs) => this.wordBoundaryMatch(cs, js) || this.fuzzySkillMatch(cs, js),
      );
      if (found) {
        mustHaveMatched++;
        matchedSkillNames.push(js);
      } else {
        missingSkillNames.push(js);
      }
    }

    const mustHaveRatio = jobSkills.length > 0 ? mustHaveMatched / jobSkills.length : 0;
    const mustHaveSkills = Math.round(mustHaveRatio * 30);

    if (matchedSkillNames.length > 0) {
      reasons.push(
        `Matched ${matchedSkillNames.length}/${jobSkills.length} must-have skills: ${matchedSkillNames.slice(0, 6).join(', ')}`,
      );
    }
    if (missingSkillNames.length > 0) {
      gaps.push(`Missing skills: ${missingSkillNames.slice(0, 5).join(', ')}`);
    }

    // ── Nice-to-have skills (max 15) ──────────────────────
    const niceToHaveInDesc = NICE_TO_HAVE_KEYWORDS.filter(
      (kw) => jobDescLower.includes(kw) && !jobSkills.includes(kw),
    );
    let niceMatched = 0;
    for (const nth of niceToHaveInDesc) {
      if (consultantSkills.some((cs) => cs.includes(nth) || nth.includes(cs))) {
        niceMatched++;
      }
    }
    const niceRatio = niceToHaveInDesc.length > 0 ? niceMatched / niceToHaveInDesc.length : 0.5;
    const niceToHaveSkills = Math.round(niceRatio * 15);

    if (niceMatched > 0) {
      reasons.push(`Matched ${niceMatched}/${niceToHaveInDesc.length} nice-to-have skills`);
    } else if (niceToHaveInDesc.length > 0) {
      gaps.push(`Matched 0/${niceToHaveInDesc.length} nice-to-have skills`);
    }

    // ── Years experience (max 10) ─────────────────────────
    let yearsExperience = 5; // default mid-range if no data
    const performanceHistory = consultant.performanceHistory as any;

    if (Array.isArray(performanceHistory) && performanceHistory.length > 0) {
      const entryCount = performanceHistory.length;
      if (entryCount >= 5) {
        yearsExperience = 10;
        reasons.push(`Strong experience track record (${entryCount} historical entries)`);
      } else if (entryCount >= 3) {
        yearsExperience = 8;
        reasons.push(`Good experience track record (${entryCount} entries)`);
      } else {
        yearsExperience = 6;
      }
    } else if (consultant.placementCount > 0) {
      yearsExperience = Math.min(10, 5 + consultant.placementCount * 2);
      reasons.push(`${consultant.placementCount} prior placements indicate experience`);
    }

    // Check if job description specifies years requirement
    const yearsMatch = jobDescLower.match(
      /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?experience/,
    );
    if (yearsMatch) {
      const requiredYears = parseInt(yearsMatch[1] ?? '0', 10);
      if (yearsExperience < requiredYears) {
        gaps.push(`Job requires ${requiredYears}+ years experience`);
        yearsExperience = Math.max(3, yearsExperience - 2);
      }
    }

    // ── Domain relevance (max 10) ─────────────────────────
    let domainRelevance = 0;
    const combinedJobText = `${jobTitleLower} ${jobDescLower}`;
    const consultantHistoryStr = JSON.stringify(
      consultant.performanceHistory || [],
    ).toLowerCase();
    const consultantSkillsStr = consultantSkills.join(' ');

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const jobHasDomain = keywords.some((kw) => combinedJobText.includes(kw));
      if (jobHasDomain) {
        const consultantHasDomain =
          keywords.some((kw) => consultantHistoryStr.includes(kw)) ||
          keywords.some((kw) => consultantSkillsStr.includes(kw));
        if (consultantHasDomain) {
          domainRelevance = 10;
          reasons.push(`Domain match: ${domain}`);
          break;
        } else {
          domainRelevance = 3; // some base credit
          gaps.push(`Job is in ${domain} domain — no matching consultant history`);
        }
      }
    }
    if (domainRelevance === 0) {
      domainRelevance = 5; // neutral — no strong domain signal
      reasons.push('No specific domain requirement detected — neutral score');
    }

    // ── Tools/platform fit (max 10) ───────────────────────
    const toolsInJob = TOOLS_PLATFORM_KEYWORDS.filter(
      (t) => jobDescLower.includes(t) || jobSkills.includes(t),
    );
    let toolsMatched = 0;
    for (const tool of toolsInJob) {
      if (consultantSkills.some((cs) => cs.includes(tool) || tool.includes(cs))) {
        toolsMatched++;
      }
    }
    const toolsRatio = toolsInJob.length > 0 ? toolsMatched / toolsInJob.length : 0.5;
    const toolsPlatformFit = Math.round(toolsRatio * 10);

    if (toolsMatched > 0) {
      reasons.push(`Matched ${toolsMatched}/${toolsInJob.length} tools/platforms`);
    }
    if (toolsInJob.length > 0 && toolsMatched < toolsInJob.length) {
      const missingTools = toolsInJob
        .filter((t) => !consultantSkills.some((cs) => cs.includes(t) || t.includes(cs)))
        .slice(0, 4);
      if (missingTools.length > 0) {
        gaps.push(`Missing tools/platforms: ${missingTools.join(', ')}`);
      }
    }

    // ── Project relevance (max 10) ────────────────────────
    let projectRelevance = 5; // default mid-range
    if (Array.isArray(performanceHistory) && performanceHistory.length > 0) {
      const importantJobWords = jobSkills
        .concat(toolsInJob)
        .filter((w) => w.length > 2);

      let projectHits = 0;
      for (const entry of performanceHistory) {
        const entryStr = JSON.stringify(entry).toLowerCase();
        if (importantJobWords.some((w) => entryStr.includes(w))) {
          projectHits++;
        }
      }
      if (projectHits >= 3) {
        projectRelevance = 10;
        reasons.push(`${projectHits} prior projects with matching tech stack`);
      } else if (projectHits >= 1) {
        projectRelevance = 7;
        reasons.push(`${projectHits} prior project(s) with some tech overlap`);
      } else {
        projectRelevance = 3;
        gaps.push('No prior projects with overlapping technologies found');
      }
    }

    // ── Location fit (max 5) ──────────────────────────────
    let locationFit = 3; // default neutral
    const jobLocType = (jobData.locationType || 'REMOTE').toUpperCase();

    if (jobLocType === 'REMOTE') {
      locationFit = 5;
      reasons.push('Remote position — location-flexible');
    } else if (jobLocType === 'HYBRID') {
      locationFit = 3;
      reasons.push('Hybrid position — confirm commute feasibility');
    } else if (jobLocType === 'ONSITE') {
      locationFit = 2;
      gaps.push('Onsite position — confirm consultant relocation/proximity');
    }

    // ── Visa eligibility (max 5) ──────────────────────────
    let visaEligibility = 5;
    let visaEligible = true;
    let visaNote: string | null = null;
    let empTypeMatch = true;

    if (workAuth) {
      const authType = workAuth.authType as string;
      const jobEmpType = (jobData.employmentType || '').toUpperCase();

      if (authType === 'USC' || authType === 'GC') {
        visaEligibility = 5;
        visaNote = `${authType} — no restrictions`;
        reasons.push(`Visa: ${authType} — fully eligible`);
      } else if (authType === 'H1B') {
        // H1B consultants can ONLY do C2C/CONTRACT (through employer)
        if (jobEmpType && !['C2C', 'CONTRACT', 'UNKNOWN', ''].includes(jobEmpType)) {
          visaEligibility = 0;
          visaEligible = false;
          empTypeMatch = false;
          visaNote = `H1B cannot accept ${jobEmpType} positions — C2C/CONTRACT only`;
          gaps.push(`H1B visa restricts to C2C/CONTRACT; job requires ${jobEmpType}`);
        } else {
          visaEligibility = 4;
          visaNote = 'H1B — eligible for C2C/CONTRACT';
          reasons.push('H1B visa — C2C/CONTRACT eligible');
        }

        // Check expiry
        if (workAuth.expiryDate) {
          const expiryDate = new Date(workAuth.expiryDate);
          const monthsUntilExpiry = (expiryDate.getTime() - Date.now()) / (30 * 86400_000);
          if (monthsUntilExpiry < 3) {
            visaEligibility = Math.max(0, visaEligibility - 2);
            gaps.push(`H1B expires in ${Math.round(monthsUntilExpiry)} months`);
          }
        }
      } else if (authType === 'OPT' || authType === 'CPT') {
        // OPT/CPT typically cannot do C2C
        if (jobEmpType === 'C2C') {
          visaEligibility = 1;
          visaEligible = false;
          empTypeMatch = false;
          visaNote = `${authType} typically cannot do C2C`;
          gaps.push(`${authType} not eligible for C2C`);
        } else {
          visaEligibility = 3;
          visaNote = `${authType} — eligible for W2/FTE positions`;
          reasons.push(`${authType} visa — W2/FTE eligible`);
        }

        // Check expiry
        if (workAuth.expiryDate) {
          const expiryDate = new Date(workAuth.expiryDate);
          const monthsUntilExpiry = (expiryDate.getTime() - Date.now()) / (30 * 86400_000);
          if (monthsUntilExpiry < 2) {
            visaEligibility = Math.max(0, visaEligibility - 2);
            gaps.push(`${authType} expires in ${Math.round(monthsUntilExpiry)} months — limited eligibility`);
          }
        }
      } else if (authType === 'EAD') {
        visaEligibility = 4;
        visaNote = 'EAD — broad eligibility';
        reasons.push('EAD — eligible for most employment types');
      } else if (authType === 'L1') {
        if (jobEmpType && !['C2C', 'CONTRACT', 'UNKNOWN', ''].includes(jobEmpType)) {
          visaEligibility = 1;
          visaEligible = false;
          empTypeMatch = false;
          visaNote = `L1 restricted to employer — ${jobEmpType} not compatible`;
          gaps.push(`L1 visa employer-specific — ${jobEmpType} not compatible`);
        } else {
          visaEligibility = 3;
          visaNote = 'L1 — employer-bound, C2C through employer';
        }
      } else if (authType === 'TN') {
        visaEligibility = 4;
        visaNote = 'TN — eligible, employer-specific';
        reasons.push('TN visa — eligible for contracted work');
      } else {
        visaEligibility = 3;
        visaNote = `Work auth: ${authType}`;
      }
    } else {
      // No work auth on file
      visaEligibility = 3;
      visaNote = 'No work authorization on file';
      gaps.push('Work authorization not documented');
    }

    // ── Rate attractiveness (max 5) ───────────────────────
    let rateAttractiveness = 3; // default mid
    const consultantRate = consultant.desiredRate ?? consultant.currentRate ?? null;

    if (consultantRate && jobData.rateMax && jobData.rateMax > 0) {
      if (consultantRate <= jobData.rateMax) {
        rateAttractiveness = 5;
        reasons.push(`Rate $${consultantRate}/hr within job range (max $${jobData.rateMax}/hr)`);
      } else {
        const overage = consultantRate - jobData.rateMax;
        const overagePct = overage / jobData.rateMax;
        if (overagePct <= 0.1) {
          rateAttractiveness = 4;
          reasons.push(`Rate $${consultantRate}/hr slightly above max ($${jobData.rateMax}/hr) — may negotiate`);
        } else if (overagePct <= 0.25) {
          rateAttractiveness = 2;
          gaps.push(`Consultant rate $${consultantRate}/hr exceeds job max $${jobData.rateMax}/hr by ${Math.round(overagePct * 100)}%`);
        } else {
          rateAttractiveness = 0;
          gaps.push(`Consultant rate $${consultantRate}/hr significantly exceeds job max $${jobData.rateMax}/hr`);
        }
      }
    } else if (consultantRate && jobData.rateMin && !jobData.rateMax) {
      rateAttractiveness = consultantRate >= jobData.rateMin ? 4 : 3;
      reasons.push(`Rate $${consultantRate}/hr vs job min $${jobData.rateMin}/hr`);
    } else {
      gaps.push('Rate comparison unavailable — consultant or job rate not specified');
    }

    // ── Total ─────────────────────────────────────────────
    const total =
      mustHaveSkills +
      niceToHaveSkills +
      yearsExperience +
      domainRelevance +
      toolsPlatformFit +
      projectRelevance +
      locationFit +
      visaEligibility +
      rateAttractiveness;

    const breakdown: ScoreBreakdown = {
      mustHaveSkills,
      niceToHaveSkills,
      yearsExperience,
      domainRelevance,
      toolsPlatformFit,
      projectRelevance,
      locationFit,
      visaEligibility,
      rateAttractiveness,
      total,
    };

    return {
      breakdown,
      reasons,
      gaps,
      visaEligible,
      visaNote,
      empTypeMatch,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  3. MATCH JOBS TO CONSULTANT
   *  Reverse perspective: given a consultant, find best-fit jobs.
   * ═══════════════════════════════════════════════════════════════ */

  async matchJobsToConsultant(
    tenantId: string,
    consultantId: string,
    limit = 10,
  ) {
    this.logger.log(`matchJobsToConsultant: tenantId=${tenantId} consultantId=${consultantId}`);

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { where: { isCurrent: true }, take: 3, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    const currentAuth = consultant.workAuths.find((wa) => wa.isCurrent) ?? null;
    const authType = currentAuth?.authType as string | undefined;

    // Determine employment type filter for H1B
    const h1bRestricted = authType === 'H1B';
    const optRestricted = authType === 'OPT' || authType === 'CPT';

    // ── Fetch active MarketJobs ───────────────────────────
    const marketJobWhere: any = { status: 'ACTIVE' };
    if (h1bRestricted) {
      marketJobWhere.employmentType = { in: ['C2C', 'CONTRACT', 'UNKNOWN'] };
    } else if (optRestricted) {
      marketJobWhere.employmentType = { notIn: ['C2C'] };
    }

    const [marketJobs, internalJobs] = await Promise.all([
      this.prisma.marketJob.findMany({
        where: marketJobWhere,
        orderBy: { postedAt: 'desc' },
        take: 200,
      }),
      this.prisma.job.findMany({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'NEW', 'QUALIFYING'] },
        },
        include: { vendor: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    this.logger.log(`Scoring ${marketJobs.length} market jobs + ${internalJobs.length} internal jobs`);

    // ── Score all jobs ────────────────────────────────────
    type ScoredJob = {
      jobData: JobData;
      scoreResult: ScoreResult;
      freshness: Date | null;
    };

    const scoredJobs: ScoredJob[] = [];

    for (const mj of marketJobs) {
      const jd: JobData = {
        id: mj.id,
        title: mj.title,
        description: mj.description,
        skills: Array.isArray(mj.skills) ? (mj.skills as string[]) : [],
        location: mj.location,
        locationType: mj.locationType,
        employmentType: mj.employmentType,
        rateMin: mj.hourlyRateMin ?? mj.rateMin,
        rateMax: mj.hourlyRateMax ?? mj.rateMax,
        company: mj.company,
        vendorOrClient: mj.company,
        source: mj.source,
        jobType: 'market',
      };

      const result = this.computeScore(jd, consultant, currentAuth);
      scoredJobs.push({
        jobData: jd,
        scoreResult: result,
        freshness: mj.postedAt ?? mj.discoveredAt,
      });
    }

    for (const ij of internalJobs) {
      const jd: JobData = {
        id: ij.id,
        title: ij.title,
        description: ij.description,
        skills: Array.isArray(ij.skills) ? (ij.skills as string[]) : [],
        location: ij.location,
        locationType: ij.locationType,
        rateMin: ij.rateMin,
        rateMax: ij.rateMax,
        rateType: ij.rateType,
        vendorOrClient: (ij as any).vendor?.companyName ?? null,
        jobType: 'internal',
      };

      const result = this.computeScore(jd, consultant, currentAuth);
      scoredJobs.push({
        jobData: jd,
        scoreResult: result,
        freshness: ij.createdAt,
      });
    }

    // ── Sort: score DESC, then rate DESC, then freshness DESC ──
    scoredJobs.sort((a, b) => {
      const scoreDiff = b.scoreResult.breakdown.total - a.scoreResult.breakdown.total;
      if (scoreDiff !== 0) return scoreDiff;

      const rateA = a.jobData.rateMax ?? 0;
      const rateB = b.jobData.rateMax ?? 0;
      if (rateB !== rateA) return rateB - rateA;

      const freshA = a.freshness?.getTime() ?? 0;
      const freshB = b.freshness?.getTime() ?? 0;
      return freshB - freshA;
    });

    const topMatches = scoredJobs.slice(0, limit);

    return {
      consultant: {
        id: consultant.id,
        name: `${consultant.firstName} ${consultant.lastName}`,
        skills: consultant.skills as string[],
        desiredRate: consultant.desiredRate,
        readiness: consultant.readiness,
        visaType: authType ?? 'UNKNOWN',
      },
      totalJobsScored: scoredJobs.length,
      matches: topMatches.map((m) => ({
        jobId: m.jobData.id,
        jobType: m.jobData.jobType,
        title: m.jobData.title,
        company: m.jobData.vendorOrClient ?? m.jobData.company ?? null,
        location: m.jobData.location,
        locationType: m.jobData.locationType,
        employmentType: m.jobData.employmentType ?? null,
        rateMin: m.jobData.rateMin,
        rateMax: m.jobData.rateMax,
        overallScore: m.scoreResult.breakdown.total,
        scoreBreakdown: m.scoreResult.breakdown,
        matchReasons: m.scoreResult.reasons,
        gaps: m.scoreResult.gaps,
        visaEligible: m.scoreResult.visaEligible,
        visaNote: m.scoreResult.visaNote,
        empTypeMatch: m.scoreResult.empTypeMatch,
        postedAt: m.freshness?.toISOString() ?? null,
      })),
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  4. GENERATE OPTIMIZED RESUME
   *  Build truthful tailored resume from existing consultant data.
   *  Reorder sections to highlight most relevant experience for
   *  this specific JD. Save HTML + metadata to filesystem and
   *  persist a ResumeArtifact record.
   * ═══════════════════════════════════════════════════════════════ */

  async generateOptimizedResume(
    tenantId: string,
    consultantId: string,
    jobId: string,
    jobType: 'internal' | 'market',
  ) {
    this.logger.log(`generateOptimizedResume: consultant=${consultantId} job=${jobId} type=${jobType}`);

    // ── Fetch consultant data ─────────────────────────────
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    // ── Fetch job data ────────────────────────────────────
    const jobData = await this.fetchJobData(tenantId, jobId, jobType);

    // ── Compute match score ───────────────────────────────
    const currentAuth = consultant.workAuths.find((wa) => wa.isCurrent) ?? null;
    const scoreResult = this.computeScore(jobData, consultant, currentAuth);

    // ── Build structured resume JSON from existing data ONLY ──
    const consultantSkills = Array.isArray(consultant.skills)
      ? (consultant.skills as string[])
      : [];
    const performanceHistory = Array.isArray(consultant.performanceHistory)
      ? (consultant.performanceHistory as any[])
      : [];

    const jobSkillsLower = jobData.skills.map((s) => s.toLowerCase());

    // Reorder skills: matched skills first, then remaining
    const matchedSkills = consultantSkills.filter((s) =>
      jobSkillsLower.some(
        (js) => s.toLowerCase().includes(js) || js.includes(s.toLowerCase()),
      ),
    );
    const otherSkills = consultantSkills.filter((s) => !matchedSkills.includes(s));
    const orderedSkills = [...matchedSkills, ...otherSkills];

    // Reorder experience: entries with matching keywords first
    const sortedHistory = [...performanceHistory].sort((a, b) => {
      const aStr = JSON.stringify(a).toLowerCase();
      const bStr = JSON.stringify(b).toLowerCase();
      const aRelevance = jobSkillsLower.filter((js) => aStr.includes(js)).length;
      const bRelevance = jobSkillsLower.filter((js) => bStr.includes(js)).length;
      return bRelevance - aRelevance;
    });

    const resumeJson = {
      name: `${consultant.firstName} ${consultant.lastName}`,
      email: consultant.email,
      phone: consultant.phone,
      skills: orderedSkills,
      matchedSkills,
      experience: sortedHistory,
      tailoredFor: {
        jobId: jobData.id,
        jobTitle: jobData.title,
        company: jobData.vendorOrClient ?? jobData.company ?? null,
        matchScore: scoreResult.breakdown.total,
      },
      generatedAt: new Date().toISOString(),
    };

    // ── Determine pod template ────────────────────────────
    const podKey = consultant.pods?.[0] ?? 'DEFAULT';
    const template = POD_TEMPLATES[podKey] ?? POD_TEMPLATES.DEFAULT!;

    // ── Generate HTML ─────────────────────────────────────
    const html = this.buildTailoredHtml(resumeJson, template, jobData, scoreResult);

    // ── Build folder path ─────────────────────────────────
    const candidateName = `${consultant.firstName}_${consultant.lastName}`.replace(/[^a-zA-Z0-9_-]/g, '');
    const primaryTech = this.determinePrimaryTech(consultantSkills, jobData.skills);
    const vendorOrClient = (jobData.vendorOrClient ?? jobData.company ?? 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const score = scoreResult.breakdown.total;

    const folderPath = path.join(
      this.resumeBaseDir,
      candidateName,
      primaryTech,
      'tailored',
      vendorOrClient,
      dateStr,
    );

    const fileName = `${candidateName}_${primaryTech}_${jobId.slice(-8)}_${score}.html`;
    const htmlPath = path.join(folderPath, fileName);
    const metadataPath = path.join(folderPath, 'metadata.json');

    // Resume content stored in DB (htmlContent column) — filesystem write kept as optional fallback
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(htmlPath, html, 'utf-8');
      this.logger.log(`Resume also written to filesystem: ${htmlPath}`);
    } catch (err: any) {
      this.logger.warn(`Filesystem write skipped (non-fatal): ${err.message}`);
    }

    // ── Compute file checksum ─────────────────────────────
    const fileChecksum = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);

    // ── Store ResumeArtifact in DB ────────────────────────
    const isSubmissionReady = score >= 90;

    const artifact = await this.prisma.resumeArtifact.create({
      data: {
        tenantId,
        consultantId: consultant.id,
        consultantName: `${consultant.firstName} ${consultant.lastName}`,
        primaryTech,
        ...(jobType === 'internal' ? { jobId } : { marketJobId: jobId }),
        jobTitle: jobData.title,
        jobSource: jobData.source ?? null,
        vendorOrClient,
        matchScore: score,
        resumeType: 'tailored',
        htmlContent: html,
        htmlPath,
        fileChecksum,
        resumeJson: resumeJson as any,
        isSubmissionReady,
      },
    });

    this.logger.log(`ResumeArtifact created: id=${artifact.id} score=${score} ready=${isSubmissionReady}`);

    return {
      artifact: {
        id: artifact.id,
        htmlPath,
        metadataPath,
        matchScore: score,
        isSubmissionReady,
        fileChecksum,
        primaryTech,
      },
      scoreBreakdown: scoreResult.breakdown,
      matchReasons: scoreResult.reasons,
      gaps: scoreResult.gaps,
      visaEligible: scoreResult.visaEligible,
      visaNote: scoreResult.visaNote,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  5. SUBMIT CONSULTANT
   *  Duplicate detection + approval workflow.
   *  If duplicate found: create SubmissionApproval, send email.
   *  If no duplicate: create Submission, send confirmation email.
   * ═══════════════════════════════════════════════════════════════ */

  async submitConsultant(
    tenantId: string,
    userId: string,
    data: {
      consultantId: string;
      jobId: string;
      jobType: 'internal' | 'market';
      resumeArtifactId?: string;
      notes?: string;
    },
  ) {
    this.logger.log(
      `submitConsultant: tenantId=${tenantId} consultant=${data.consultantId} job=${data.jobId} type=${data.jobType}`,
    );

    // ── Fetch consultant ──────────────────────────────────
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: data.consultantId, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    // ── Validate readiness ──────────────────────────────
    const allowedReadiness = ['SUBMISSION_READY', 'VERIFIED', 'ON_ASSIGNMENT'];
    if (!allowedReadiness.includes(consultant.readiness)) {
      throw new BadRequestException(
        `Consultant readiness is "${consultant.readiness}" — must be one of: ${allowedReadiness.join(', ')}`,
      );
    }

    // ── Fetch job ─────────────────────────────────────────
    const jobData = await this.fetchJobData(tenantId, data.jobId, data.jobType);

    // ── Fetch resume artifact if provided ─────────────────
    let resumeArtifact: any = null;
    if (data.resumeArtifactId) {
      resumeArtifact = await this.prisma.resumeArtifact.findFirst({
        where: { id: data.resumeArtifactId, tenantId, consultantId: data.consultantId },
      });
      if (!resumeArtifact) {
        throw new BadRequestException('Resume artifact not found or does not belong to this consultant');
      }
    }

    // ── Duplicate detection ───────────────────────────────
    const vendorOrClient = (jobData.vendorOrClient ?? jobData.company ?? 'Unknown').trim();
    const duplicateSubmission = await this.findDuplicateSubmission(
      tenantId,
      data.consultantId,
      vendorOrClient,
      data.jobId,
      data.jobType,
    );

    if (duplicateSubmission) {
      this.logger.warn(
        `Duplicate found: consultant=${data.consultantId} vendor=${vendorOrClient} prev=${duplicateSubmission.id}`,
      );

      // ── Create SubmissionApproval ───────────────────────
      const approval = await this.prisma.submissionApproval.create({
        data: {
          tenantId,
          consultantId: data.consultantId,
          ...(data.jobType === 'internal' ? { jobId: data.jobId } : { marketJobId: data.jobId }),
          vendorOrClient,
          previousSubmissionId: duplicateSubmission.id,
          previousSubmissionDate: duplicateSubmission.createdAt,
          jobTitle: jobData.title,
          consultantEmail: consultant.email,
          requestReason: `Duplicate submission detected to ${vendorOrClient}. Previous submission: ${duplicateSubmission.id} on ${duplicateSubmission.createdAt.toISOString().slice(0, 10)}.`,
          resumeArtifactId: data.resumeArtifactId ?? null,
          expiresAt: new Date(Date.now() + 72 * 3600_000), // 72h expiry
        },
      });

      // ── Send approval request email ─────────────────────
      const emailHtml = this.buildDuplicateApprovalEmail(
        consultant,
        jobData,
        duplicateSubmission,
        approval.approvalToken,
      );

      await this.sendAndAuditEmail(
        tenantId,
        'duplicate_approval_request',
        consultant.email,
        `Action Required: Duplicate Submission — ${jobData.title}`,
        emailHtml,
        'approval',
        approval.id,
      );

      return {
        requiresApproval: true,
        approvalId: approval.id,
        reason: `Duplicate submission to ${vendorOrClient} detected. Approval email sent to ${consultant.email}.`,
        previousSubmission: {
          id: duplicateSubmission.id,
          date: duplicateSubmission.createdAt.toISOString(),
          status: duplicateSubmission.status,
        },
      };
    }

    // ── No duplicate — create Submission directly ─────────
    let internalJobId = data.jobType === 'internal' ? data.jobId : null;

    if (data.jobType === 'market' && !internalJobId) {
      const marketJob = await this.prisma.marketJob.findUnique({ where: { id: data.jobId } });
      if (marketJob?.convertedToJobId) {
        internalJobId = marketJob.convertedToJobId;
      }
    }

    // Need an internal Job ID for the Submission model (jobId is required FK).
    if (!internalJobId) {
      const placeholderJob = await this.createPlaceholderJob(tenantId, jobData);
      internalJobId = placeholderJob.id;

      if (data.jobType === 'market') {
        await this.prisma.marketJob.update({
          where: { id: data.jobId },
          data: { convertedToJobId: internalJobId, convertedAt: new Date(), status: 'CONVERTED' },
        });
      }
    }

    const submission = await this.prisma.submission.create({
      data: {
        tenantId,
        jobId: internalJobId,
        consultantId: data.consultantId,
        submittedById: userId,
        submitterType: 'USER',
        resumeVersionId: data.resumeArtifactId ?? null,
        notes: data.notes ?? null,
        status: 'SUBMITTED',
        duplicateCheckResult: { checked: true, duplicateFound: false },
      },
    });

    this.logger.log(`Submission created: id=${submission.id} job=${internalJobId}`);

    // ── Send confirmation email ───────────────────────────
    const confirmHtml = this.buildSubmissionConfirmationEmail(consultant, jobData, resumeArtifact);

    await this.sendAndAuditEmail(
      tenantId,
      'submission_confirmation',
      consultant.email,
      `Submission Confirmed: ${jobData.title}`,
      confirmHtml,
      'submission',
      submission.id,
    );

    return {
      requiresApproval: false,
      submissionId: submission.id,
      jobId: internalJobId,
      status: 'SUBMITTED',
      consultantName: `${consultant.firstName} ${consultant.lastName}`,
      jobTitle: jobData.title,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  6. HANDLE APPROVAL
   *  Process approve/reject response from consultant via token.
   * ═══════════════════════════════════════════════════════════════ */

  async handleApproval(
    token: string,
    approved: boolean,
    responseNote?: string,
  ) {
    this.logger.log(`handleApproval: token=${token} approved=${approved}`);

    const approval = await this.prisma.submissionApproval.findUnique({
      where: { approvalToken: token },
    });
    if (!approval) {
      throw new NotFoundException('Approval token not found');
    }

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Approval already processed: status=${approval.status}`);
    }

    if (new Date() > approval.expiresAt) {
      await this.prisma.submissionApproval.update({
        where: { id: approval.id },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });
      throw new BadRequestException('Approval token has expired');
    }

    // ── Update approval status ────────────────────────────
    const newStatus = approved ? 'APPROVED' : 'REJECTED';
    await this.prisma.submissionApproval.update({
      where: { id: approval.id },
      data: {
        status: newStatus as any,
        respondedAt: new Date(),
        responseNote: responseNote ?? null,
      },
    });

    // Fetch consultant for email
    const consultant = await this.prisma.consultant.findUnique({
      where: { id: approval.consultantId },
    });

    // Fetch job data for email
    let jobData: JobData | null = null;
    try {
      if (approval.jobId) {
        jobData = await this.fetchJobData(approval.tenantId, approval.jobId, 'internal');
      } else if (approval.marketJobId) {
        jobData = await this.fetchJobData(approval.tenantId, approval.marketJobId, 'market');
      }
    } catch {
      // If job can't be fetched, continue without it
    }

    if (approved && consultant) {
      // ── Proceed with submission creation ─────────────────
      let internalJobId = approval.jobId;

      if (!internalJobId && approval.marketJobId) {
        const marketJob = await this.prisma.marketJob.findUnique({
          where: { id: approval.marketJobId },
        });
        if (marketJob?.convertedToJobId) {
          internalJobId = marketJob.convertedToJobId;
        } else if (jobData) {
          const placeholder = await this.createPlaceholderJob(approval.tenantId, jobData);
          internalJobId = placeholder.id;

          if (approval.marketJobId) {
            await this.prisma.marketJob.update({
              where: { id: approval.marketJobId },
              data: { convertedToJobId: internalJobId, convertedAt: new Date(), status: 'CONVERTED' },
            });
          }
        }
      }

      if (internalJobId) {
        // Race condition guard
        const existing = await this.prisma.submission.findFirst({
          where: {
            tenantId: approval.tenantId,
            jobId: internalJobId,
            consultantId: approval.consultantId,
            status: { notIn: ['WITHDRAWN', 'REJECTED', 'CLOSED'] },
          },
        });

        if (!existing) {
          const submission = await this.prisma.submission.create({
            data: {
              tenantId: approval.tenantId,
              jobId: internalJobId,
              consultantId: approval.consultantId,
              // submittedById is nullable — approved via email token, original requester unknown
              submitterType: 'USER',
              resumeVersionId: approval.resumeArtifactId ?? null,
              notes: `Approved via duplicate approval (token: ...${token.slice(-8)})${responseNote ? `. Note: ${responseNote}` : ''}`,
              status: 'SUBMITTED',
              duplicateCheckResult: {
                checked: true,
                duplicateFound: true,
                approvedByConsultant: true,
                approvalId: approval.id,
              },
            },
          });

          this.logger.log(`Post-approval submission created: id=${submission.id}`);
        }
      }
    }

    // ── Send confirmation email ───────────────────────────
    if (consultant && jobData) {
      const confirmHtml = this.buildApprovalReceivedEmail(consultant, jobData, approved);

      await this.sendAndAuditEmail(
        approval.tenantId,
        approved ? 'approval_confirmed' : 'approval_rejected',
        consultant.email,
        approved ? `Submission Approved: ${jobData.title}` : `Submission Declined: ${jobData.title}`,
        confirmHtml,
        'approval',
        approval.id,
      );
    }

    return {
      approvalId: approval.id,
      status: newStatus,
      approved,
      responseNote: responseNote ?? null,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  7. GET JOB MATCH DETAILS
   *  Full job details + all matches with consultant info,
   *  score breakdowns, visa status, and best resume artifact.
   * ═══════════════════════════════════════════════════════════════ */

  async getJobMatchDetails(
    tenantId: string,
    jobId: string,
    jobType: 'internal' | 'market',
    limit = 50,
  ) {
    this.logger.log(`getJobMatchDetails: tenantId=${tenantId} jobId=${jobId} type=${jobType}`);

    const matchWhere: any = { tenantId };
    if (jobType === 'internal') {
      matchWhere.jobId = jobId;
    } else {
      matchWhere.marketJobId = jobId;
    }

    const matches = await this.prisma.jobMatch.findMany({
      where: matchWhere,
      orderBy: { overallScore: 'desc' },
      take: limit,
    });

    // Enrich with consultant data
    const consultantIds = matches.map((m) => m.consultantId);
    const consultants = await this.prisma.consultant.findMany({
      where: { id: { in: consultantIds }, tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const consultantMap = new Map(consultants.map((c) => [c.id, c]));

    // Fetch resume artifacts
    const artifactWhere: any = {
      tenantId,
      consultantId: { in: consultantIds },
    };
    if (jobType === 'internal') {
      artifactWhere.jobId = jobId;
    } else {
      artifactWhere.marketJobId = jobId;
    }

    const artifacts = await this.prisma.resumeArtifact.findMany({
      where: artifactWhere,
      orderBy: { generatedAt: 'desc' },
    });
    const artifactMap = new Map<string, any>();
    for (const a of artifacts) {
      if (!artifactMap.has(a.consultantId)) {
        artifactMap.set(a.consultantId, a);
      }
    }

    const enrichedMatches = matches.map((m) => {
      const c = consultantMap.get(m.consultantId);
      const artifact = artifactMap.get(m.consultantId);
      const breakdown = (m.scoreBreakdown ?? {}) as Record<string, number>;

      return {
        matchId: m.id,
        consultantId: m.consultantId,
        firstName: c?.firstName ?? 'Unknown',
        lastName: c?.lastName ?? '',
        email: c?.email ?? null,
        phone: c?.phone ?? null,
        skills: c ? (c.skills as string[]) : [],
        pods: c ? (c.pods as string[]) : [],
        premiumSkillFamilies: c ? (c.premiumSkillFamilies as string[]) : [],
        readiness: c?.readiness ?? null,
        qualityScore: c?.qualityScore ?? null,
        desiredRate: c?.desiredRate ?? null,
        workAuths: (c?.workAuths ?? []).map((wa) => ({
          authType: wa.authType,
          expiryDate: wa.expiryDate?.toISOString() ?? null,
        })),
        overallScore: m.overallScore,
        scoreBreakdown: breakdown,
        matchReasons: m.matchReasons,
        gaps: m.gaps,
        visaEligible: m.visaEligible,
        visaNote: m.visaNote,
        empTypeMatch: m.empTypeMatch,
        submissionReady: m.overallScore >= 90,
        billRateEstimate: m.billRateEstimate,
        hasResume: (c?.resumeVersions?.length ?? 0) > 0,
        bestResumeArtifact: artifact
          ? {
              id: artifact.id,
              matchScore: artifact.matchScore,
              isSubmissionReady: artifact.isSubmissionReady,
              htmlPath: artifact.htmlPath,
              generatedAt: artifact.generatedAt.toISOString(),
            }
          : null,
        matchStatus: m.status,
        matchedAt: m.createdAt.toISOString(),
      };
    });

    // Build enriched job response — for market jobs, fetch the full record
    let jobResponse: any;
    if (jobType === 'market') {
      const mj = await this.prisma.marketJob.findUnique({ where: { id: jobId } });
      if (!mj) throw new NotFoundException(`Market job not found: ${jobId}`);
      jobResponse = {
        id: mj.id,
        type: 'market',
        title: mj.title,
        company: mj.company,
        description: mj.description,
        location: mj.location,
        locationType: mj.locationType,
        employmentType: mj.employmentType,
        rateMin: mj.hourlyRateMin ?? mj.rateMin,
        rateMax: mj.hourlyRateMax ?? mj.rateMax,
        rateText: mj.rateText,
        skills: Array.isArray(mj.skills) ? mj.skills : [],
        mustHaveSkills: [],
        niceToHaveSkills: [],
        applyUrl: mj.applyUrl,
        source: mj.source,
        postedAt: mj.postedAt?.toISOString() ?? null,
        recruiterName: mj.recruiterName,
        recruiterEmail: mj.recruiterEmail,
        recruiterPhone: mj.recruiterPhone,
        realnessScore: mj.realnessScore,
        actionabilityScore: mj.actionabilityScore,
      };
    } else {
      const jobData = await this.fetchJobData(tenantId, jobId, jobType);
      jobResponse = {
        id: jobData.id,
        type: 'internal',
        title: jobData.title,
        company: jobData.vendorOrClient ?? null,
        description: jobData.description.slice(0, 2000),
        location: jobData.location,
        locationType: jobData.locationType,
        employmentType: jobData.employmentType ?? null,
        rateMin: jobData.rateMin,
        rateMax: jobData.rateMax,
        rateText: null,
        skills: jobData.skills,
        mustHaveSkills: [],
        niceToHaveSkills: [],
        applyUrl: null,
        source: 'INTERNAL',
        postedAt: null,
        recruiterName: null,
        recruiterEmail: null,
        recruiterPhone: null,
        realnessScore: null,
        actionabilityScore: null,
      };
    }

    return {
      job: jobResponse,
      totalMatches: matches.length,
      matches: enrichedMatches,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  8. GET CONSULTANT MATCH DETAILS
   *  Consultant details + top 10 job matches + score breakdowns
   *  + resume artifact info.
   * ═══════════════════════════════════════════════════════════════ */

  async getConsultantMatchDetails(tenantId: string, consultantId: string) {
    this.logger.log(`getConsultantMatchDetails: tenantId=${tenantId} consultantId=${consultantId}`);

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { where: { isCurrent: true }, take: 3, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    // Fetch stored JobMatch records
    const matches = await this.prisma.jobMatch.findMany({
      where: { tenantId, consultantId },
      orderBy: { overallScore: 'desc' },
      take: 10,
    });

    // Enrich with job data
    const internalJobIds = matches.filter((m) => m.jobId).map((m) => m.jobId!);
    const marketJobIds = matches.filter((m) => m.marketJobId).map((m) => m.marketJobId!);

    const [internalJobs, marketJobs] = await Promise.all([
      internalJobIds.length > 0
        ? this.prisma.job.findMany({
            where: { id: { in: internalJobIds } },
            include: { vendor: { select: { companyName: true } } },
          })
        : [],
      marketJobIds.length > 0
        ? this.prisma.marketJob.findMany({
            where: { id: { in: marketJobIds } },
          })
        : [],
    ]);

    const internalJobMap = new Map(internalJobs.map((j) => [j.id, j]));
    const marketJobMap = new Map(marketJobs.map((j) => [j.id, j]));

    // Fetch resume artifacts
    const artifacts = await this.prisma.resumeArtifact.findMany({
      where: { tenantId, consultantId },
      orderBy: { generatedAt: 'desc' },
    });
    const artifactByJob = new Map<string, any>();
    for (const a of artifacts) {
      const key = a.jobId ?? a.marketJobId ?? '';
      if (key && !artifactByJob.has(key)) {
        artifactByJob.set(key, a);
      }
    }

    const currentAuth = consultant.workAuths.find((wa) => wa.isCurrent);

    const enrichedMatches = matches.map((m) => {
      const jobKey = m.jobId ?? m.marketJobId ?? '';
      let jobInfo: any = null;
      let jobType: 'internal' | 'market' = 'internal';

      if (m.jobId && internalJobMap.has(m.jobId)) {
        const j = internalJobMap.get(m.jobId)!;
        jobInfo = {
          title: j.title,
          company: j.vendor?.companyName ?? null,
          location: j.location,
          locationType: j.locationType,
          rateMin: j.rateMin,
          rateMax: j.rateMax,
          status: j.status,
        };
        jobType = 'internal';
      } else if (m.marketJobId && marketJobMap.has(m.marketJobId)) {
        const mj = marketJobMap.get(m.marketJobId)!;
        jobInfo = {
          title: mj.title,
          company: mj.company,
          location: mj.location,
          locationType: mj.locationType,
          employmentType: mj.employmentType,
          rateMin: mj.hourlyRateMin ?? mj.rateMin,
          rateMax: mj.hourlyRateMax ?? mj.rateMax,
          status: mj.status,
        };
        jobType = 'market';
      }

      const artifact = artifactByJob.get(jobKey);

      return {
        matchId: m.id,
        jobId: m.jobId ?? m.marketJobId,
        jobType,
        jobInfo,
        overallScore: m.overallScore,
        scoreBreakdown: m.scoreBreakdown,
        matchReasons: m.matchReasons,
        gaps: m.gaps,
        visaEligible: m.visaEligible,
        visaNote: m.visaNote,
        empTypeMatch: m.empTypeMatch,
        billRateEstimate: m.billRateEstimate,
        matchStatus: m.status,
        matchedAt: m.createdAt.toISOString(),
        resumeArtifact: artifact
          ? {
              id: artifact.id,
              matchScore: artifact.matchScore,
              isSubmissionReady: artifact.isSubmissionReady,
              htmlPath: artifact.htmlPath,
            }
          : null,
      };
    });

    return {
      consultant: {
        id: consultant.id,
        name: `${consultant.firstName} ${consultant.lastName}`,
        email: consultant.email,
        phone: consultant.phone,
        skills: consultant.skills as string[],
        readiness: consultant.readiness,
        qualityScore: consultant.qualityScore,
        desiredRate: consultant.desiredRate,
        visaType: currentAuth?.authType ?? null,
        visaExpiry: currentAuth?.expiryDate?.toISOString() ?? null,
        hasResume: consultant.resumeVersions.length > 0,
      },
      totalMatches: matches.length,
      matches: enrichedMatches,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  PRIVATE HELPERS
   * ═══════════════════════════════════════════════════════════════ */

  /** Fetch and normalize job data from either internal Job or MarketJob. */
  private async fetchJobData(
    tenantId: string,
    jobId: string,
    jobType: 'internal' | 'market',
  ): Promise<JobData> {
    if (jobType === 'internal') {
      const job = await this.prisma.job.findFirst({
        where: { id: jobId, tenantId },
        include: { vendor: { select: { companyName: true } } },
      });
      if (!job) throw new NotFoundException(`Internal job not found: ${jobId}`);

      return {
        id: job.id,
        title: job.title,
        description: job.description,
        skills: Array.isArray(job.skills) ? (job.skills as string[]) : [],
        location: job.location,
        locationType: job.locationType,
        rateMin: job.rateMin,
        rateMax: job.rateMax,
        rateType: job.rateType,
        vendorOrClient: job.vendor?.companyName ?? null,
        jobType: 'internal',
      };
    } else {
      const mj = await this.prisma.marketJob.findUnique({ where: { id: jobId } });
      if (!mj) throw new NotFoundException(`Market job not found: ${jobId}`);

      return {
        id: mj.id,
        title: mj.title,
        description: mj.description,
        skills: Array.isArray(mj.skills) ? (mj.skills as string[]) : [],
        location: mj.location,
        locationType: mj.locationType,
        employmentType: mj.employmentType,
        rateMin: mj.hourlyRateMin ?? mj.rateMin,
        rateMax: mj.hourlyRateMax ?? mj.rateMax,
        company: mj.company,
        vendorOrClient: mj.company,
        source: mj.source,
        jobType: 'market',
      };
    }
  }

  /** Fuzzy skill matching — handles common abbreviations and variations. */
  private fuzzySkillMatch(consultantSkill: string, jobSkill: string): boolean {
    for (const [canonical, alts] of Object.entries(SKILL_ALIASES)) {
      const allForms = [canonical, ...alts];
      const cMatch = allForms.some((f) => consultantSkill.includes(f));
      const jMatch = allForms.some((f) => jobSkill.includes(f));
      if (cMatch && jMatch) return true;
    }
    return false;
  }

  /** Word-boundary skill match — prevents "java" matching "javascript". */
  private wordBoundaryMatch(a: string, b: string): boolean {
    if (a === b) return true;
    // Multi-word skills can use substring match safely ("spring boot" in longer strings)
    if (a.length > 4 && b.length > 4) {
      if (a.includes(b) || b.includes(a)) return true;
    }
    // Short skills (<=4 chars like "go", "sql", "java") need word boundaries
    if (a.length <= 4 || b.length <= 4) {
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length > b.length ? a : b;
      const re = new RegExp(
        `(^|[\\s,/\\-])${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s,/\\-])`,
        'i',
      );
      return re.test(longer);
    }
    return false;
  }

  /** Upsert a JobMatch for a market job (no unique constraint on tenantId+marketJobId+consultantId). */
  private async upsertMarketJobMatch(data: any) {
    const existing = await this.prisma.jobMatch.findFirst({
      where: {
        tenantId: data.tenantId,
        marketJobId: data.marketJobId,
        consultantId: data.consultantId,
      },
    });

    if (existing) {
      return this.prisma.jobMatch.update({
        where: { id: existing.id },
        data: {
          overallScore: data.overallScore,
          scoreBreakdown: data.scoreBreakdown,
          matchReasons: data.matchReasons,
          gaps: data.gaps,
          visaEligible: data.visaEligible,
          visaNote: data.visaNote,
          empTypeMatch: data.empTypeMatch,
          billRateEstimate: data.billRateEstimate,
          status: 'computed',
        },
      });
    }

    return this.prisma.jobMatch.create({ data });
  }

  /** Detect duplicate submissions to the same vendor/client within 60 days.
   *  Normalizes vendor names (strips Inc, LLC, Corp, etc.) and matches on both
   *  company name and domain. Also extracts domain from vendorOrClient URL/email. */
  private async findDuplicateSubmission(
    tenantId: string,
    consultantId: string,
    vendorOrClient: string,
    _jobId: string,
    _jobType: 'internal' | 'market',
  ): Promise<any | null> {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000);

    // Normalize: strip common suffixes, extra whitespace
    const normalized = vendorOrClient
      .replace(/,?\s*(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|company|solutions|technologies|consulting|services|group)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract possible domain from vendor name (e.g., "acme.com" or "info@acme.com")
    const domainMatch = vendorOrClient.match(/@?([\w.-]+\.\w{2,})$/);
    const vendorDomain = domainMatch?.[1]?.toLowerCase() ?? null;

    const existing = (await this.prisma.$queryRaw`
      SELECT s.id, s.status, s."createdAt", j.title as "jobTitle",
             v."companyName" as "vendorName"
      FROM "Submission" s
      JOIN "Job" j ON j.id = s."jobId"
      JOIN "Vendor" v ON v.id = j."vendorId"
      WHERE s."tenantId" = ${tenantId}
        AND s."consultantId" = ${consultantId}
        AND (
          LOWER(REGEXP_REPLACE(v."companyName", ',?\s*(Inc\.?|LLC\.?|Corp\.?|Ltd\.?|Co\.?|Company|Solutions|Technologies|Consulting|Services|Group)\s*', '', 'gi'))
            = LOWER(${normalized})
          OR (v.domain IS NOT NULL AND v.domain != '' AND LOWER(v.domain) = LOWER(${vendorDomain ?? ''}))
          OR LOWER(v."companyName") = LOWER(${vendorOrClient})
        )
        AND s.status NOT IN ('WITHDRAWN', 'REJECTED', 'CLOSED')
        AND s."createdAt" >= ${sixtyDaysAgo}
      ORDER BY s."createdAt" DESC
      LIMIT 1
    `) as any[];

    return existing.length > 0 ? existing[0] : null;
  }

  /** Create a placeholder internal Job from market job data so the Submission FK is satisfied. */
  private async createPlaceholderJob(tenantId: string, jobData: JobData) {
    let vendor = await this.prisma.vendor.findFirst({
      where: {
        tenantId,
        companyName: jobData.vendorOrClient ?? jobData.company ?? 'Market Source',
      },
    });

    if (!vendor) {
      vendor = await this.prisma.vendor.create({
        data: {
          tenantId,
          companyName: jobData.vendorOrClient ?? jobData.company ?? 'Market Source',
          domain: jobData.company?.toLowerCase().replace(/\s+/g, '-') ?? null,
        },
      });
    }

    return this.prisma.job.create({
      data: {
        tenantId,
        vendorId: vendor.id,
        title: jobData.title,
        description: jobData.description.slice(0, 4000),
        skills: jobData.skills ?? [],
        location: jobData.location,
        locationType: (jobData.locationType as any) ?? 'REMOTE',
        rateMin: jobData.rateMin,
        rateMax: jobData.rateMax,
        status: 'ACTIVE',
      },
    });
  }

  /** Determine primary tech family from consultant + job skills. */
  private determinePrimaryTech(consultantSkills: string[], jobSkills: string[]): string {
    const allSkills = [...consultantSkills, ...jobSkills].map((s) => s.toLowerCase());

    let bestFamily = 'General';
    let bestCount = 0;

    for (const [family, keywords] of Object.entries(TECH_FAMILIES)) {
      const count = keywords.filter((kw) => allSkills.some((s) => s.includes(kw))).length;
      if (count > bestCount) {
        bestCount = count;
        bestFamily = family;
      }
    }

    return bestFamily;
  }

  /** Build tailored HTML resume with pod-aware template. */
  private buildTailoredHtml(
    resumeJson: any,
    template: { headerColor: string; sections: string[] },
    jobData: JobData,
    scoreResult: ScoreResult,
  ): string {
    const { name, email, phone, skills, matchedSkills, experience } = resumeJson;

    const skillsHtml = skills
      .map((s: string) => {
        const isMatched = matchedSkills.includes(s);
        return `<span class="skill-tag${isMatched ? ' matched' : ''}">${this.escapeHtml(s)}</span>`;
      })
      .join('');

    const experienceHtml = (experience || [])
      .slice(0, 8)
      .map((exp: any) => {
        const title = exp.title || exp.role || 'Role';
        const company = exp.company || exp.client || '';
        const period = exp.period || exp.dates || '';
        const desc = exp.description || exp.summary || 'Details available upon request';
        return `
          <div class="experience-entry">
            <h3>${this.escapeHtml(String(title))}${company ? ` — ${this.escapeHtml(String(company))}` : ''}</h3>
            ${period ? `<div class="period">${this.escapeHtml(String(period))}</div>` : ''}
            <p>${this.escapeHtml(String(desc))}</p>
          </div>`;
      })
      .join('');

    const matchBadge =
      scoreResult.breakdown.total >= 90
        ? '<span class="match-badge excellent">Excellent Match</span>'
        : scoreResult.breakdown.total >= 70
          ? '<span class="match-badge good">Strong Match</span>'
          : '<span class="match-badge fair">Fair Match</span>';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(name)} — Resume for ${this.escapeHtml(jobData.title)}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; line-height: 1.6; font-size: 11pt; }
  .header { background: ${template.headerColor}; color: white; padding: 24px 28px; margin: -20px -20px 20px; }
  .header h1 { margin: 0 0 4px; font-size: 20pt; font-weight: 600; }
  .header .contact { font-size: 10pt; opacity: 0.9; }
  .header .tailored-for { font-size: 9pt; opacity: 0.8; margin-top: 8px; }
  .match-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 9pt; font-weight: 600; margin-left: 8px; }
  .match-badge.excellent { background: #dcfce7; color: #166534; }
  .match-badge.good { background: #fef9c3; color: #854d0e; }
  .match-badge.fair { background: #fee2e2; color: #991b1b; }
  h2 { color: ${template.headerColor}; border-bottom: 2px solid ${template.headerColor}; padding-bottom: 4px; font-size: 13pt; margin-top: 24px; }
  .skills-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .skill-tag { background: ${template.headerColor}15; color: ${template.headerColor}; padding: 3px 12px; border-radius: 12px; font-size: 9pt; }
  .skill-tag.matched { background: ${template.headerColor}; color: white; font-weight: 600; }
  .experience-entry { margin-bottom: 16px; }
  .experience-entry h3 { margin: 0 0 2px; font-size: 11pt; color: #374151; }
  .experience-entry .period { font-size: 9pt; color: #6b7280; margin-bottom: 4px; }
  .experience-entry p { margin: 4px 0 0; font-size: 10pt; }
  .branding { text-align: right; font-size: 8pt; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(name)} ${matchBadge}</h1>
    <div class="contact">${this.escapeHtml(email)}${phone ? ' | ' + this.escapeHtml(phone) : ''}</div>
    <div class="tailored-for">Tailored for: ${this.escapeHtml(jobData.title)}${jobData.vendorOrClient ? ' at ' + this.escapeHtml(jobData.vendorOrClient) : ''} | Score: ${scoreResult.breakdown.total}/100</div>
  </div>

  <h2>${template.sections[1] || 'Technical Skills'}</h2>
  <div class="skills-bar">${skillsHtml}</div>

  <h2>${template.sections[2] || 'Professional Experience'}</h2>
  ${experienceHtml || '<p>Experience details available upon request.</p>'}

  <div class="branding">Presented by Cloud Resources Inc. | Generated ${new Date().toISOString().slice(0, 10)}</div>
</body>
</html>`;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  EMAIL TEMPLATES
   * ═══════════════════════════════════════════════════════════════ */

  private buildSubmissionConfirmationEmail(
    consultant: any,
    job: JobData,
    resumeArtifact: any | null,
  ): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 20px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #1a56db; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">Submission Confirmed</h2>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p>Hi ${this.escapeHtml(consultant.firstName)},</p>
      <p>Your profile has been submitted for the following position:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600; width: 140px;">Position</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Company</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.vendorOrClient ?? job.company ?? 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Location</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.location ?? 'Remote')} (${job.locationType})</td>
        </tr>
        ${job.rateMax ? `
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Rate Range</td>
          <td style="padding: 8px 12px;">$${job.rateMin ?? '—'}–$${job.rateMax}/hr</td>
        </tr>` : ''}
        ${resumeArtifact ? `
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Resume Score</td>
          <td style="padding: 8px 12px;">${resumeArtifact.matchScore}/100</td>
        </tr>` : ''}
      </table>
      <p>We will keep you updated on the progress of this submission. If you have questions, please reply to this email.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">This is an automated notification from Cloud Resources Staffing Operations.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildDuplicateApprovalEmail(
    consultant: any,
    job: JobData,
    previousSubmission: any,
    approvalToken: string,
  ): string {
    const approveUrl = `${this.appBaseUrl}/api/job-match/approval/${approvalToken}?approved=true`;
    const rejectUrl = `${this.appBaseUrl}/api/job-match/approval/${approvalToken}?approved=false`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 20px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: #dc2626; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">Duplicate Submission — Approval Required</h2>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p>Hi ${this.escapeHtml(consultant.firstName)},</p>
      <p>We detected a <strong>duplicate submission</strong> to the same vendor/client. Your approval is required to proceed.</p>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #991b1b;">Previous Submission Detected</p>
        <p style="margin: 0; font-size: 14px;">
          Job: ${this.escapeHtml(previousSubmission.jobTitle ?? 'N/A')}<br>
          Vendor: ${this.escapeHtml(previousSubmission.vendorName ?? 'N/A')}<br>
          Date: ${previousSubmission.createdAt ? new Date(previousSubmission.createdAt).toISOString().slice(0, 10) : 'N/A'}<br>
          Status: ${previousSubmission.status ?? 'N/A'}
        </p>
      </div>

      <p><strong>New submission request:</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin: 12px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600; width: 140px;">Position</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Company</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.vendorOrClient ?? job.company ?? 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Location</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.location ?? 'Remote')}</td>
        </tr>
      </table>

      <p>Please choose an action:</p>
      <div style="margin: 20px 0; text-align: center;">
        <a href="${approveUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-right: 12px;">Approve Submission</a>
        <a href="${rejectUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reject Submission</a>
      </div>

      <p style="color: #6b7280; font-size: 12px;">This approval request expires in 72 hours. If you do not respond, the submission will not be sent.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated notification from Cloud Resources Staffing Operations.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildApprovalReceivedEmail(
    consultant: any,
    job: JobData,
    approved: boolean,
  ): string {
    const statusColor = approved ? '#16a34a' : '#dc2626';
    const statusText = approved ? 'Approved' : 'Declined';
    const statusMessage = approved
      ? 'Your submission has been approved and will be sent to the hiring team.'
      : 'Your submission has been declined and will not be sent.';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 20px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <div style="background: ${statusColor}; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">Submission ${statusText}</h2>
    </div>
    <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
      <p>Hi ${this.escapeHtml(consultant.firstName)},</p>
      <p>${statusMessage}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600; width: 140px;">Position</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Company</td>
          <td style="padding: 8px 12px;">${this.escapeHtml(job.vendorOrClient ?? job.company ?? 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f3f4f6; font-weight: 600;">Status</td>
          <td style="padding: 8px 12px;"><strong style="color: ${statusColor};">${statusText}</strong></td>
        </tr>
      </table>
      ${approved ? '<p>We will keep you updated on next steps.</p>' : '<p>If you have questions about this decision, please reply to this email.</p>'}
      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">This is an automated notification from Cloud Resources Staffing Operations.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  EMAIL SENDING + AUDIT
   * ═══════════════════════════════════════════════════════════════ */

  private async sendAndAuditEmail(
    tenantId: string,
    templateName: string,
    toEmail: string,
    subject: string,
    bodyHtml: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<void> {
    let graphMessageId: string | null = null;
    let status = 'sent';
    let errorMessage: string | null = null;

    try {
      const result = await this.emailSender.sendMail({
        from: this.senderEmail,
        to: [toEmail],
        subject,
        bodyHtml,
        bodyText: subject,
        saveToSentItems: true,
      });
      graphMessageId = result.messageId;
      this.logger.log(`Email sent: template=${templateName} to=${toEmail} msgId=${graphMessageId}`);
    } catch (err: any) {
      status = 'failed';
      errorMessage = err.message;
      this.logger.warn(`Email send failed: template=${templateName} to=${toEmail}: ${err.message}`);
    }

    // Always log to EmailAudit regardless of send outcome
    try {
      await this.prisma.emailAudit.create({
        data: {
          tenantId,
          templateName,
          toEmail,
          fromEmail: this.senderEmail,
          subject,
          bodyPreview: bodyHtml.slice(0, 500),
          graphMessageId,
          relatedEntityType,
          relatedEntityId,
          status,
          errorMessage,
        },
      });
    } catch (auditErr: any) {
      this.logger.error(`Failed to create EmailAudit record: ${auditErr.message}`);
    }
  }

  /** Extract likely skill keywords from free text (title + description fallback). */
  private extractSkillsFromText(text: string): string[] {
    const COMMON_SKILLS = [
      'java', 'python', 'javascript', 'typescript', 'react', 'angular', 'vue',
      'node', 'nodejs', 'express', 'spring', 'spring boot', 'django', 'flask',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'kafka', 'rabbitmq',
      'graphql', 'rest', 'microservices', 'ci/cd', 'git', 'linux',
      'machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch',
      'spark', 'hadoop', 'airflow', 'snowflake', 'databricks', 'etl',
      '.net', 'c#', 'c++', 'go', 'golang', 'rust', 'ruby', 'rails',
      'swift', 'kotlin', 'flutter', 'react native', 'ios', 'android',
      'html', 'css', 'sass', 'tailwind', 'next.js', 'nextjs', 'nuxt',
      'tableau', 'power bi', 'looker', 'excel', 'sap', 'salesforce',
      'jira', 'confluence', 'agile', 'scrum', 'devops', 'sre',
      'elasticsearch', 'solr', 'nginx', 'apache', 'tomcat',
      'selenium', 'cypress', 'jest', 'junit', 'pytest',
      'figma', 'sketch', 'adobe xd', 'ux', 'ui',
    ];
    const found: string[] = [];
    for (const skill of COMMON_SKILLS) {
      if (text.includes(skill)) found.push(skill);
    }
    return found.slice(0, 15);
  }

  /** Escape HTML special characters for safe rendering. */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SERVE RESUME HTML FROM DB
   * ═══════════════════════════════════════════════════════════════ */

  async getResumeHtml(tenantId: string, artifactId: string): Promise<string> {
    const artifact = await this.prisma.resumeArtifact.findFirst({
      where: { id: artifactId, tenantId },
      select: { htmlContent: true, htmlPath: true },
    });
    if (!artifact) throw new NotFoundException('Resume artifact not found');

    if (artifact.htmlContent) return artifact.htmlContent;

    // Fallback: try reading from filesystem
    if (artifact.htmlPath) {
      try {
        return fs.readFileSync(artifact.htmlPath, 'utf-8');
      } catch {
        throw new NotFoundException('Resume HTML not available');
      }
    }

    throw new NotFoundException('Resume HTML not available');
  }

  /* ═══════════════════════════════════════════════════════════════
   *  UPLOAD RESUME (real file → stored in ResumeVersion)
   * ═══════════════════════════════════════════════════════════════ */

  async uploadResume(
    tenantId: string,
    consultantId: string,
    file: Express.Multer.File,
    version?: string,
  ) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex').slice(0, 32);

    // Mark existing versions as not current
    await this.prisma.resumeVersion.updateMany({
      where: { tenantId, consultantId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Store file as base64-encoded data URI so it's fully self-contained in DB
    const base64 = file.buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    const rv = await this.prisma.resumeVersion.create({
      data: {
        tenantId,
        consultantId,
        version: version || new Date().toISOString().slice(0, 10),
        fileUrl: dataUri,
        fileHash,
        source: 'upload',
        isCurrent: true,
      },
    });

    // Update consultant's resume freshness
    await this.prisma.consultant.update({
      where: { id: consultantId },
      data: { resumeFreshnessAt: new Date() },
    });

    this.logger.log(`Resume uploaded for consultant=${consultantId}, version=${rv.id}`);

    return {
      id: rv.id,
      version: rv.version,
      fileHash,
      isCurrent: true,
      consultantId,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   *  SERVE RESUME VERSION CONTENT
   *  Handles: data: URIs (uploaded), local file paths, s3:// (seed)
   * ═══════════════════════════════════════════════════════════════ */

  async getResumeVersionContent(tenantId: string, versionId: string) {
    const rv = await this.prisma.resumeVersion.findFirst({
      where: { id: versionId, tenantId },
    });
    if (!rv) throw new NotFoundException('Resume version not found');

    const fileUrl = rv.fileUrl;

    // data: URI (uploaded resume)
    if (fileUrl.startsWith('data:')) {
      const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match || !match[1] || !match[2]) throw new NotFoundException('Invalid data URI');
      const mimeType = match[1]!;
      const buffer = Buffer.from(match[2]!, 'base64');
      const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('html') ? 'html' : 'bin';
      return {
        buffer,
        mimeType,
        disposition: `inline; filename="resume.${ext}"`,
      };
    }

    // Local file path (generated resume)
    if (fileUrl.startsWith('/') || fileUrl.startsWith('resume://')) {
      // resume:// protocol — resolve to actual path
      let filePath = fileUrl;
      if (fileUrl.startsWith('resume://')) {
        const parts = fileUrl.replace('resume://', '').split('/');
        filePath = path.join(this.resumeBaseDir, ...parts) + '.html';
      }

      try {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.html' ? 'text/html' : 'application/octet-stream';
        return {
          buffer,
          mimeType,
          disposition: `inline; filename="${path.basename(filePath)}"`,
        };
      } catch {
        throw new NotFoundException(`Resume file not found on disk: ${path.basename(filePath)}`);
      }
    }

    // s3:// URLs (fake seed data)
    if (fileUrl.startsWith('s3://')) {
      throw new NotFoundException('This is placeholder seed data — no actual file exists. Upload a real resume.');
    }

    throw new NotFoundException('Unknown resume file format');
  }

  /* ═══════════════════════════════════════════════════════════════
   *  GENERATE BASELINE RESUMES FOR ALL CONSULTANTS
   *  Handles: (1) replacing fake s3:// seed URLs, (2) updating
   *  existing baseline-generated resumes, (3) creating new
   *  ResumeVersion for consultants with no resume at all.
   * ═══════════════════════════════════════════════════════════════ */

  async generateBaselineResumes(tenantId: string) {
    this.logger.log(`generateBaselineResumes: tenantId=${tenantId}`);

    // Find ALL consultants in this tenant
    const consultants = await this.prisma.consultant.findMany({
      where: { tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { orderBy: { createdAt: 'desc' } },
      },
    });

    this.logger.log(`Found ${consultants.length} total consultants`);

    const results: { consultantId: string; name: string; status: string }[] = [];

    for (const c of consultants) {
      try {
        // Skip consultants that already have a real uploaded resume (not s3:// or baseline-generated)
        const hasRealResume = c.resumeVersions.some(
          (rv) =>
            rv.fileUrl.startsWith('data:') &&
            rv.source !== 'baseline-generated',
        );
        if (hasRealResume) {
          results.push({
            consultantId: c.id,
            name: `${c.firstName} ${c.lastName}`,
            status: 'skipped-has-real-resume',
          });
          continue;
        }

        const skills = Array.isArray(c.skills) ? (c.skills as string[]) : [];
        const performanceHistory = Array.isArray(c.performanceHistory)
          ? (c.performanceHistory as any[])
          : [];
        const currentAuth = c.workAuths.find((wa) => wa.isCurrent) ?? null;
        const podKey = (c.pods as string[])?.[0] ?? 'DEFAULT';
        const template = POD_TEMPLATES[podKey] ?? POD_TEMPLATES.DEFAULT!;

        const html = this.buildBaselineHtml(
          {
            name: `${c.firstName} ${c.lastName}`,
            email: c.email,
            phone: c.phone,
            skills,
            experience: performanceHistory,
            workAuth: currentAuth
              ? { type: currentAuth.authType, expiry: currentAuth.expiryDate }
              : null,
            desiredRate: c.desiredRate,
            availableFrom: c.availableFrom,
            pods: (c.pods as string[]) ?? [],
          },
          template,
        );

        const base64 = Buffer.from(html, 'utf-8').toString('base64');
        const dataUri = `data:text/html;base64,${base64}`;
        const fileHash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 16);

        // Find existing seed or baseline-generated resume versions
        const seedOrBaseline = c.resumeVersions.filter(
          (rv) => rv.fileUrl.startsWith('s3://') || rv.source === 'baseline-generated',
        );

        if (seedOrBaseline.length > 0) {
          // Update existing seed/baseline resumes
          for (const rv of seedOrBaseline) {
            await this.prisma.resumeVersion.update({
              where: { id: rv.id },
              data: {
                fileUrl: dataUri,
                fileHash: `sha256:${fileHash}`,
                source: 'baseline-generated',
              },
            });
          }
        } else {
          // No resume at all — create a new ResumeVersion
          await this.prisma.resumeVersion.create({
            data: {
              tenantId,
              consultantId: c.id,
              version: 'v1.0',
              fileUrl: dataUri,
              fileHash: `sha256:${fileHash}`,
              source: 'baseline-generated',
              isCurrent: true,
            },
          });
        }

        await this.prisma.consultant.update({
          where: { id: c.id },
          data: { resumeFreshnessAt: new Date() },
        });

        results.push({
          consultantId: c.id,
          name: `${c.firstName} ${c.lastName}`,
          status: seedOrBaseline.length > 0 ? 'updated' : 'created',
        });
        this.logger.log(`Baseline resume ${seedOrBaseline.length > 0 ? 'updated' : 'created'} for ${c.firstName} ${c.lastName}`);
      } catch (err: any) {
        results.push({
          consultantId: c.id,
          name: `${c.firstName} ${c.lastName}`,
          status: `error: ${err.message}`,
        });
        this.logger.error(`Failed baseline resume for ${c.firstName} ${c.lastName}: ${err.message}`);
      }
    }

    return {
      total: consultants.length,
      updated: results.filter((r) => r.status === 'updated').length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status.startsWith('skipped')).length,
      errors: results.filter((r) => r.status.startsWith('error')).length,
      details: results,
    };
  }

  /** Build a baseline HTML resume from consultant profile data (no job context). */
  private buildBaselineHtml(
    data: {
      name: string;
      email: string;
      phone: string | null;
      skills: string[];
      experience: any[];
      workAuth: { type: string; expiry: Date | null } | null;
      desiredRate: number | null;
      availableFrom: Date | null;
      pods: string[];
    },
    template: { headerColor: string; sections: string[] },
  ): string {
    // ── Professional Summary ─────────────────────────────────
    const podLabels: Record<string, string> = {
      SWE: 'Software Engineering',
      CLOUD_DEVOPS: 'Cloud & DevOps',
      DATA: 'Data Engineering & Analytics',
      CYBER: 'Cybersecurity',
    };
    const primaryPod = data.pods[0] ?? '';
    const podLabel = podLabels[primaryPod] ?? 'Technology';
    const topSkills = data.skills.slice(0, 3).join(', ');
    const authLabel = data.workAuth?.type
      ? ` Authorized to work in the United States (${data.workAuth.type}).`
      : '';

    const summary = data.skills.length > 0
      ? `${podLabel} professional with hands-on expertise in ${topSkills}${data.skills.length > 3 ? ` and ${data.skills.length - 3} additional technologies` : ''}. Proven track record in delivering enterprise-grade solutions.${authLabel}`
      : `Technology professional available for new opportunities.${authLabel}`;

    // ── Categorize skills into groups ────────────────────────
    const skillCategories: { label: string; skills: string[] }[] = [];
    const categorized = new Set<string>();

    const categoryDefs: [string, string[]][] = [
      ['Programming Languages', ['java', 'python', 'go', 'c#', 'c++', 'ruby', 'rust', 'scala', 'kotlin', 'swift', 'typescript', 'javascript', 'php']],
      ['Frameworks & Libraries', ['spring boot', 'spring', 'react', 'angular', 'vue', 'next.js', 'django', 'flask', 'fastapi', 'express', 'node.js', 'nestjs', '.net', 'asp.net', 'rxjs', 'tailwindcss', 'graphql']],
      ['Cloud & Infrastructure', ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'ansible', 'linux', 'helm', 'eks', 'aws eks', 'fargate', 'lambda', 'serverless']],
      ['Data & Databases', ['postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'snowflake', 'spark', 'kafka', 'airflow', 'dbt', 'redshift', 'dynamodb', 'elasticsearch', 'sql', 'tableau', 'looker', 'power bi', 'excel', 'aws glue', 'databricks']],
      ['DevOps & CI/CD', ['ci/cd', 'jenkins', 'gitlab', 'github actions', 'circleci', 'aws codepipeline', 'bash', 'prometheus', 'grafana', 'datadog', 'splunk', 'new relic']],
      ['AI & Machine Learning', ['machine learning', 'tensorflow', 'pytorch', 'aws sagemaker', 'sagemaker', 'nlp', 'deep learning', 'computer vision', 'llm', 'langchain', 'openai']],
      ['Security', ['penetration testing', 'soc', 'siem', 'incident response', 'comptia', 'iam', 'cloud security', 'aws security hub', 'okta', 'cyberark']],
    ];

    for (const [label, keywords] of categoryDefs) {
      const matched = data.skills.filter((s) => {
        if (categorized.has(s)) return false; // already placed in a category
        const sl = s.toLowerCase();
        return keywords.some((kw) => sl === kw || (kw.length > 2 && sl.includes(kw)));
      });
      if (matched.length > 0) {
        skillCategories.push({ label, skills: matched });
        matched.forEach((sk) => categorized.add(sk));
      }
    }
    const uncategorized = data.skills.filter((s) => !categorized.has(s));
    if (uncategorized.length > 0) {
      skillCategories.push({ label: 'Other Technologies', skills: uncategorized });
    }

    // ── Build skill table HTML ───────────────────────────────
    const skillTableHtml = skillCategories.length > 0
      ? skillCategories
          .map(
            (cat) => `
        <tr>
          <td class="skill-cat">${this.escapeHtml(cat.label)}</td>
          <td class="skill-list">${cat.skills.map((s) => this.escapeHtml(s)).join(', ')}</td>
        </tr>`,
          )
          .join('')
      : '';

    // ── Experience section ───────────────────────────────────
    const experienceHtml = (data.experience || [])
      .slice(0, 8)
      .map((exp: any) => {
        const title = exp.title || exp.role || 'Role';
        const company = exp.company || exp.client || '';
        const period = exp.period || exp.dates || '';
        const desc = exp.description || exp.summary || '';
        return `
          <div class="experience-entry">
            <h3>${this.escapeHtml(String(title))}${company ? ` &mdash; ${this.escapeHtml(String(company))}` : ''}</h3>
            ${period ? `<div class="period">${this.escapeHtml(String(period))}</div>` : ''}
            ${desc ? `<p>${this.escapeHtml(String(desc))}</p>` : ''}
          </div>`;
      })
      .join('');

    // ── Work authorization line ──────────────────────────────
    const authLine = data.workAuth
      ? `${data.workAuth.type}${data.workAuth.expiry ? ` — Valid through ${new Date(data.workAuth.expiry).toISOString().slice(0, 10)}` : ' — No expiry'}`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${this.escapeHtml(data.name)} — Professional Resume</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1f2937; line-height: 1.6; font-size: 10.5pt; }
  .header { background: ${template.headerColor}; color: white; padding: 28px 32px 20px; }
  .header h1 { margin: 0 0 4px; font-size: 22pt; font-weight: 600; letter-spacing: -0.5px; }
  .header .contact { font-size: 10pt; opacity: 0.92; }
  .header .tagline { font-size: 10pt; opacity: 0.82; margin-top: 6px; font-style: italic; }
  .content { padding: 20px 32px 24px; }
  h2 { color: ${template.headerColor}; border-bottom: 2px solid ${template.headerColor}; padding-bottom: 4px; font-size: 12pt; margin: 22px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary { font-size: 10.5pt; color: #374151; margin-bottom: 6px; }
  table.skills { width: 100%; border-collapse: collapse; margin: 6px 0 4px; }
  table.skills td { padding: 5px 10px; font-size: 10pt; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .skill-cat { font-weight: 600; color: ${template.headerColor}; width: 180px; white-space: nowrap; }
  .skill-list { color: #374151; }
  .experience-entry { margin-bottom: 14px; }
  .experience-entry h3 { margin: 0 0 2px; font-size: 10.5pt; color: #374151; font-weight: 600; }
  .experience-entry .period { font-size: 9pt; color: #6b7280; margin-bottom: 3px; }
  .experience-entry p { margin: 3px 0 0; font-size: 10pt; color: #4b5563; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 8px 0; font-size: 10pt; }
  .info-grid .label { font-weight: 600; color: #6b7280; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; }
  .info-grid .value { color: #1f2937; }
  .footer { text-align: right; font-size: 8pt; color: #9ca3af; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(data.name)}</h1>
    <div class="contact">${this.escapeHtml(data.email)}${data.phone ? ' &nbsp;|&nbsp; ' + this.escapeHtml(data.phone) : ''}</div>
    <div class="tagline">${this.escapeHtml(podLabel)} Professional</div>
  </div>

  <div class="content">
    <h2>Professional Summary</h2>
    <p class="summary">${this.escapeHtml(summary)}</p>

    <h2>${template.sections[1] || 'Technical Skills'}</h2>
    ${skillTableHtml ? `<table class="skills">${skillTableHtml}</table>` : '<p class="summary">Skills to be updated.</p>'}

    ${data.experience.length > 0 ? `
    <h2>${template.sections[2] || 'Professional Experience'}</h2>
    ${experienceHtml}` : ''}

    <h2>Additional Information</h2>
    <div class="info-grid">
      ${authLine ? `<div><div class="label">Work Authorization</div><div class="value">${this.escapeHtml(authLine)}</div></div>` : ''}
      ${data.desiredRate ? `<div><div class="label">Desired Rate</div><div class="value">$${data.desiredRate}/hr</div></div>` : ''}
      ${data.availableFrom ? `<div><div class="label">Available From</div><div class="value">${new Date(data.availableFrom).toISOString().slice(0, 10)}</div></div>` : ''}
      ${data.pods.length > 0 ? `<div><div class="label">Practice Areas</div><div class="value">${data.pods.map((p) => this.escapeHtml(p)).join(', ')}</div></div>` : ''}
    </div>

    <div class="footer">Presented by Cloud Resources Inc. | Generated ${new Date().toISOString().slice(0, 10)}</div>
  </div>
</body>
</html>`;
  }

  /* ═══════════════════════════════════════════════════════════════
   *  CLEAN FAKE SEED DATA (s3://resumes/... URLs)
   * ═══════════════════════════════════════════════════════════════ */

  async cleanFakeSeedData(tenantId?: string) {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "ResumeVersion"
      WHERE "fileUrl" LIKE 's3://%'
        OR "fileUrl" LIKE 'https://fake-%'
    `;
    this.logger.log(`Cleaned ${result} fake seed ResumeVersion rows`);
    return { cleaned: result };
  }
}
