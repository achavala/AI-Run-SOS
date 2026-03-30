import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com',
  'live.com', 'msn.com', 'ymail.com', 'gmx.com', 'inbox.com',
  'rediffmail.com', 'me.com', 'att.net', 'comcast.net', 'verizon.net',
]);

/* ------------------------------------------------------------------ */
/*  Tech-category taxonomy — drives filtering, detection & UI labels  */
/* ------------------------------------------------------------------ */

const TECH_CATEGORIES: Record<string, { label: string; keywords: string[]; premiumFamilies: string[] }> = {
  'ai-ml': {
    label: 'AI/ML Engineer',
    keywords: ['machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'ai', 'ml', 'llm', 'genai', 'generative ai', 'neural network', 'hugging face', 'langchain', 'openai'],
    premiumFamilies: ['AI_ML'],
  },
  'mlops-genai': {
    label: 'MLOps / GenAI Infrastructure',
    keywords: ['mlops', 'mlflow', 'kubeflow', 'sagemaker', 'vertex ai', 'model deployment', 'feature store', 'genai', 'rag', 'vector database', 'pinecone', 'weaviate'],
    premiumFamilies: ['MLOPS_GENAI'],
  },
  'data-engineering': {
    label: 'Data Engineering',
    keywords: ['spark', 'airflow', 'kafka', 'databricks', 'snowflake', 'redshift', 'bigquery', 'etl', 'data pipeline', 'dbt', 'data lake', 'data warehouse', 'hadoop'],
    premiumFamilies: ['DATA_ENGINEERING'],
  },
  'python': {
    label: 'Python Development',
    keywords: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'celery'],
    premiumFamilies: ['SWE_CORE'],
  },
  'sre': {
    label: 'SRE Engineer',
    keywords: ['sre', 'site reliability', 'observability', 'prometheus', 'grafana', 'datadog', 'pagerduty', 'incident response', 'chaos engineering', 'reliability'],
    premiumFamilies: ['CLOUD_DEVOPS'],
  },
  'cloud-devops': {
    label: 'Cloud / DevOps Engineer',
    keywords: ['aws', 'azure', 'gcp', 'terraform', 'ansible', 'jenkins', 'github actions', 'ci/cd', 'docker', 'kubernetes', 'k8s', 'helm', 'argo', 'devops', 'cloud'],
    premiumFamilies: ['CLOUD_DEVOPS'],
  },
  'cybersecurity': {
    label: 'Cybersecurity Engineer',
    keywords: ['security', 'soc', 'siem', 'penetration testing', 'vulnerability', 'compliance', 'cissp', 'ceh', 'firewall', 'ids', 'ips', 'zero trust', 'cybersecurity'],
    premiumFamilies: ['CYBERSECURITY'],
  },
  'data-analysis': {
    label: 'Data Analysis / BI',
    keywords: ['tableau', 'power bi', 'looker', 'sql', 'analytics', 'business intelligence', 'data analysis', 'reporting', 'dashboard', 'excel', 'statistical'],
    premiumFamilies: ['DATA_ENGINEERING'],
  },
  'java-fullstack': {
    label: 'Java Full Stack Developer',
    keywords: ['java', 'spring', 'spring boot', 'hibernate', 'microservices', 'rest api', 'angular', 'react', 'maven', 'gradle'],
    premiumFamilies: ['SWE_CORE'],
  },
  'dotnet-fullstack': {
    label: '.NET Full Stack Developer',
    keywords: ['.net', 'c#', 'asp.net', 'blazor', 'entity framework', 'azure devops', 'sql server', 'wpf', 'maui'],
    premiumFamilies: ['SWE_CORE'],
  },
};

/* ------------------------------------------------------------------ */
/*  Filter / sort type definitions                                     */
/* ------------------------------------------------------------------ */

export interface BenchSalesFilters {
  techCategory?: string;
  search?: string;
  visa?: string;
  location?: string;
  availability?: string;
  minRate?: number;
  maxRate?: number;
  sort?: 'placeable' | 'rate-desc' | 'newest' | 'score';
  page?: number;
  pageSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Normalise a skill string for keyword comparison. */
export function normalise(s: string): string {
  return s.toLowerCase().trim();
}

/** Detect all matching tech categories for a set of skills. */
function detectTechCategories(skills: string[]): { key: string; label: string; matchCount: number }[] {
  if (!skills || skills.length === 0) return [];
  const lower = skills.map(normalise);
  const hits: { key: string; label: string; matchCount: number }[] = [];

  for (const [key, cat] of Object.entries(TECH_CATEGORIES)) {
    let matchCount = 0;
    for (const kw of cat.keywords) {
      if (lower.some((s) => s.includes(kw))) matchCount++;
    }
    if (matchCount > 0) {
      hits.push({ key, label: cat.label, matchCount });
    }
  }

  hits.sort((a, b) => b.matchCount - a.matchCount);
  return hits;
}

/** Check whether a skill set matches a specific tech category. */
function matchesTechCategory(skills: string[], categoryKey: string): boolean {
  const cat = TECH_CATEGORIES[categoryKey];
  if (!cat) return false;
  const lower = skills.map(normalise);
  return cat.keywords.some((kw) => lower.some((s) => s.includes(kw)));
}

/** Derive a concise visa badge from the current work authorisation. */
function visaBadge(authType: string | null | undefined): string {
  if (!authType) return 'Unknown';
  const map: Record<string, string> = {
    USC: 'US Citizen',
    GC: 'Green Card',
    H1B: 'H-1B',
    L1: 'L-1',
    OPT: 'OPT',
    CPT: 'CPT',
    EAD: 'EAD',
    TN: 'TN',
    OTHER: 'Other',
  };
  return map[authType] ?? authType;
}

/** Days between two dates. */
function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/* ------------------------------------------------------------------ */
/*  Score helpers                                                      */
/* ------------------------------------------------------------------ */

/** Score keyword overlap between two string arrays (0-1).
 *  Uses word-boundary matching to avoid false positives like "java" matching "javascript". */
export function skillOverlapScore(consultantSkills: string[], jobSkills: string[]): number {
  if (!jobSkills || jobSkills.length === 0 || !consultantSkills || consultantSkills.length === 0) return 0;
  const cLower = consultantSkills.map(normalise);
  let matched = 0;
  for (const jSkill of jobSkills) {
    const jLow = normalise(jSkill);
    if (cLower.some((c) => skillMatch(c, jLow))) matched++;
  }
  return matched / jobSkills.length;
}

/** Word-boundary–aware skill comparison. Prevents "java" matching "javascript". */
export function skillMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  // For short skills (≤5 chars), use word-boundary matching to prevent
  // "go" matching "mongo" or "java" matching "javascript"
  if (shorter.length <= 5) {
    const re = new RegExp(`(^|[\\s,/\\-])${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s,/\\-])`, 'i');
    return re.test(longer);
  }
  // Exact containment for multi-word skills ("spring boot" in "spring boot microservices")
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class BenchSalesService {
  private readonly logger = new Logger(BenchSalesService.name);

  constructor(private prisma: PrismaService) {}

  /* ================================================================ */
  /*  1. getConsultants — paginated, filtered, scored                  */
  /* ================================================================ */

  async getConsultants(tenantId: string, filters: BenchSalesFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    this.logger.log(
      `getConsultants tenant=${tenantId} page=${page} pageSize=${pageSize} ` +
      `tech=${filters.techCategory ?? 'all'} visa=${filters.visa ?? 'all'} sort=${filters.sort ?? 'placeable'}`,
    );

    /* ---------- load vendor domains to exclude vendor contacts ---------- */
    const vendorDomains = await this.loadVendorDomains(tenantId);

    /* ---------- base Prisma where clause ---------- */
    const where: any = {
      tenantId,
      readiness: { in: ['SUBMISSION_READY', 'VERIFIED', 'NEW', 'DOCS_PENDING'] },
    };

    /* text search across name, email, skills */
    const andConditions: any[] = [];

    if (filters.search) {
      const term = filters.search.trim();
      andConditions.push({
        OR: [
          { firstName: { contains: term } },
          { lastName: { contains: term } },
          { email: { contains: term } },
        ],
      });
    }

    /* visa filter — join through workAuths */
    if (filters.visa && filters.visa !== 'ALL') {
      where.workAuths = {
        some: {
          isCurrent: true,
          authType: filters.visa,
        },
      };
    }

    /* location filter */
    if (filters.location) {
      const loc = filters.location.trim();
      andConditions.push({
        OR: [
          { assignments: { some: { job: { location: { contains: loc } } } } },
          { placements: { some: { job: { location: { contains: loc } } } } },
          { email: { contains: loc } },
        ],
      });
    }

    /* availability filter */
    if (filters.availability) {
      const now = new Date();
      switch (filters.availability) {
        case 'immediate':
          where.OR = [
            { availableFrom: null },
            { availableFrom: { lte: now } },
          ];
          break;
        case '2weeks': {
          const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
          where.OR = [
            { availableFrom: null },
            { availableFrom: { lte: twoWeeks } },
          ];
          break;
        }
        case '30days': {
          const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          where.OR = [
            { availableFrom: null },
            { availableFrom: { lte: thirtyDays } },
          ];
          break;
        }
      }
    }

    /* rate range */
    if (filters.minRate != null) {
      where.desiredRate = { ...where.desiredRate, gte: filters.minRate };
    }
    if (filters.maxRate != null) {
      where.desiredRate = { ...where.desiredRate, lte: filters.maxRate };
    }

    /* ---------- exclude vendor email domains at DB level ---------- */
    const vendorDomainList = Array.from(vendorDomains).slice(0, 50);
    for (const d of vendorDomainList) {
      andConditions.push({ NOT: { email: { endsWith: `@${d}` } } });
    }

    /* exclude recruiter patterns in names */
    andConditions.push(
      { NOT: { firstName: { contains: 'recruiter' } } },
      { NOT: { firstName: { contains: 'recruiting' } } },
      { NOT: { lastName: { contains: 'staffing' } } },
    );

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    /* ---------- fetch all matching candidates ---------- */
    const [rawConsultants, dbTotal] = await Promise.all([
      this.prisma.consultant.findMany({
        where,
        include: {
          workAuths: { where: { isCurrent: true }, take: 1 },
          resumeVersions: { where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' } },
          _count: { select: { submissions: true, placements: true } },
        },
      }),
      this.prisma.consultant.count({ where }),
    ]);

    /* ---------- tech category post-filter ---------- */
    let consultants = rawConsultants;
    if (filters.techCategory && filters.techCategory !== 'all') {
      consultants = consultants.filter((c) => {
        const skills = (c.skills as string[]) ?? [];
        return matchesTechCategory(skills, filters.techCategory!);
      });
    }

    const filteredTotal = consultants.length;

    /* ---------- compute placeability + enrich ---------- */
    const now = new Date();

    const enriched = consultants.map((c) => {
      const skills = (c.skills as string[]) ?? [];
      const currentAuth = c.workAuths[0] ?? null;
      const currentResume = c.resumeVersions[0] ?? null;
      const detectedCategories = detectTechCategories(skills);

      /* --- placeability score (0-100) --- */
      const qualityComponent = ((c.qualityScore ?? 0) / 100) * 40;

      let resumeFreshnessComponent = 0;
      if (c.resumeFreshnessAt) {
        const daysOld = daysBetween(now, c.resumeFreshnessAt);
        resumeFreshnessComponent = Math.max(0, 20 - (daysOld / 180) * 20);
      } else if (currentResume) {
        const daysOld = daysBetween(now, currentResume.createdAt);
        resumeFreshnessComponent = Math.max(0, 20 - (daysOld / 180) * 20);
      }

      const skillsDepthComponent = Math.min(skills.length / 8, 1) * 20;

      let availabilityComponent = 10;
      if (c.availableFrom) {
        const daysUntil = daysBetween(now, c.availableFrom);
        if (c.availableFrom <= now) {
          availabilityComponent = 20;
        } else {
          availabilityComponent = Math.max(0, 20 - (daysUntil / 60) * 20);
        }
      } else {
        availabilityComponent = 15;
      }

      const placeabilityScore = Math.round(
        qualityComponent + resumeFreshnessComponent + skillsDepthComponent + availabilityComponent,
      );

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        skills,
        readiness: c.readiness,
        desiredRate: c.desiredRate,
        currentRate: c.currentRate,
        qualityScore: c.qualityScore,
        availableFrom: c.availableFrom?.toISOString() ?? null,
        availabilityConfidence: c.availabilityConfidence,
        verificationStatus: c.verificationStatus,
        premiumSkillFamilies: c.premiumSkillFamilies,
        sourcingLane: c.sourcingLane,
        placeabilityScore,
        visaBadge: visaBadge(currentAuth?.authType ?? null),
        visaType: currentAuth?.authType ?? null,
        visaExpiry: currentAuth?.expiryDate?.toISOString() ?? null,
        currentResume: currentResume
          ? {
              id: currentResume.id,
              version: currentResume.version,
              fileUrl: currentResume.fileUrl,
              createdAt: currentResume.createdAt.toISOString(),
            }
          : null,
        techCategories: detectedCategories.slice(0, 3),
        totalSubmissions: c._count.submissions,
        totalPlacements: c._count.placements,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    /* ---------- sort ---------- */
    const sortKey = filters.sort ?? 'placeable';
    switch (sortKey) {
      case 'placeable':
        enriched.sort((a, b) => b.placeabilityScore - a.placeabilityScore);
        break;
      case 'rate-desc':
        enriched.sort((a, b) => (b.desiredRate ?? 0) - (a.desiredRate ?? 0));
        break;
      case 'newest':
        enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'score':
        enriched.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
        break;
    }

    /* ---------- paginate in-memory ---------- */
    const skip = (page - 1) * pageSize;
    const paged = enriched.slice(skip, skip + pageSize);

    this.logger.log(
      `getConsultants returning ${paged.length}/${filteredTotal} consultants (page ${page})`,
    );

    return {
      data: paged,
      total: filteredTotal,
      page,
      pageSize,
      totalPages: Math.ceil(filteredTotal / pageSize),
    };
  }

  /* ================================================================ */
  /*  2. getConsultantDetail — full profile with stats                 */
  /* ================================================================ */

  async getConsultantDetail(tenantId: string, consultantId: string) {
    this.logger.log(`getConsultantDetail tenant=${tenantId} consultant=${consultantId}`);

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { orderBy: { createdAt: 'desc' } },
        resumeVersions: { orderBy: { createdAt: 'desc' } },
        submissions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            job: {
              select: {
                id: true,
                title: true,
                status: true,
                location: true,
                rateMin: true,
                rateMax: true,
                vendor: { select: { id: true, companyName: true } },
              },
            },
          },
        },
        placements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            job: { select: { id: true, title: true } },
            vendor: { select: { id: true, companyName: true } },
          },
        },
        _count: {
          select: {
            submissions: true,
            placements: true,
            offers: true,
          },
        },
      },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found in tenant ${tenantId}`);
    }

    const skills = (consultant.skills as string[]) ?? [];
    const detectedCategories = detectTechCategories(skills);
    const currentAuth = consultant.workAuths.find((w) => w.isCurrent) ?? null;
    const currentResume = consultant.resumeVersions.find((r) => r.isCurrent) ?? null;

    /* --- submission stats --- */
    const activeStatuses = ['SUBMITTED', 'INTERVIEWING', 'OFFERED', 'CONSENT_PENDING'];
    const activeSubmissions = consultant.submissions.filter((s) => activeStatuses.includes(s.status));
    const interviewingCount = consultant.submissions.filter((s) => s.status === 'INTERVIEWING').length;

    const interviewSubmissionIds = consultant.submissions
      .filter((s) => s.status === 'INTERVIEWING' || s.status === 'OFFERED' || s.status === 'ACCEPTED')
      .map((s) => s.id);

    let totalInterviews = 0;
    if (interviewSubmissionIds.length > 0) {
      totalInterviews = await this.prisma.interview.count({
        where: {
          tenantId,
          submissionId: { in: interviewSubmissionIds },
        },
      });
    }

    this.logger.log(
      `getConsultantDetail ${consultant.firstName} ${consultant.lastName}: ` +
      `${consultant._count.submissions} submissions, ${activeSubmissions.length} active, ` +
      `${consultant._count.placements} placements, ${totalInterviews} interviews`,
    );

    return {
      id: consultant.id,
      firstName: consultant.firstName,
      lastName: consultant.lastName,
      email: consultant.email,
      phone: consultant.phone,
      skills,
      pods: consultant.pods,
      readiness: consultant.readiness,
      verificationStatus: consultant.verificationStatus,
      desiredRate: consultant.desiredRate,
      currentRate: consultant.currentRate,
      qualityScore: consultant.qualityScore,
      rateRealism: consultant.rateRealism,
      availableFrom: consultant.availableFrom?.toISOString() ?? null,
      availabilityConfidence: consultant.availabilityConfidence,
      premiumSkillFamilies: consultant.premiumSkillFamilies,
      sourcingLane: consultant.sourcingLane,
      trustScore: consultant.trustScore,
      interviewCount: consultant.interviewCount,
      offerCount: consultant.offerCount,
      placementCount: consultant.placementCount,
      createdAt: consultant.createdAt.toISOString(),
      updatedAt: consultant.updatedAt.toISOString(),

      /* work authorisations */
      visaBadge: visaBadge(currentAuth?.authType ?? null),
      currentWorkAuth: currentAuth
        ? {
            id: currentAuth.id,
            authType: currentAuth.authType,
            expiryDate: currentAuth.expiryDate?.toISOString() ?? null,
            employer: currentAuth.employer,
            notes: currentAuth.notes,
          }
        : null,
      workAuthHistory: consultant.workAuths.map((w) => ({
        id: w.id,
        authType: w.authType,
        expiryDate: w.expiryDate?.toISOString() ?? null,
        employer: w.employer,
        isCurrent: w.isCurrent,
        createdAt: w.createdAt.toISOString(),
      })),

      /* resumes */
      currentResume: currentResume
        ? {
            id: currentResume.id,
            version: currentResume.version,
            fileUrl: currentResume.fileUrl,
            source: currentResume.source,
            createdAt: currentResume.createdAt.toISOString(),
          }
        : null,
      resumeHistory: consultant.resumeVersions.map((r) => ({
        id: r.id,
        version: r.version,
        fileUrl: r.fileUrl,
        source: r.source,
        isCurrent: r.isCurrent,
        createdAt: r.createdAt.toISOString(),
      })),

      /* detected tech categories */
      techCategories: detectedCategories,

      /* submissions */
      submissions: consultant.submissions.map((s) => ({
        id: s.id,
        jobId: s.jobId,
        jobTitle: s.job?.title ?? null,
        jobLocation: (s.job as any)?.location ?? null,
        vendorName: (s.job as any)?.vendor?.companyName ?? null,
        status: s.status,
        submitterType: s.submitterType,
        notes: s.notes,
        vendorFeedback: s.vendorFeedback,
        feedbackReceivedAt: s.feedbackReceivedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),

      /* placements */
      placements: consultant.placements.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        jobTitle: (p.job as any)?.title ?? null,
        vendorName: (p.vendor as any)?.companyName ?? null,
        billRate: p.billRate,
        payRate: p.payRate,
        margin: p.margin,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate?.toISOString() ?? null,
        status: p.status,
      })),

      /* summary stats */
      stats: {
        totalSubmissions: consultant._count.submissions,
        activeSubmissions: activeSubmissions.length,
        totalInterviews,
        interviewingNow: interviewingCount,
        totalOffers: consultant._count.offers,
        totalPlacements: consultant._count.placements,
      },
    };
  }

  /* ================================================================ */
  /*  3. getTopJobsForConsultant — scored, ranked job matches          */
  /* ================================================================ */

  async getTopJobsForConsultant(tenantId: string, consultantId: string, limit = 10) {
    this.logger.log(`getTopJobsForConsultant tenant=${tenantId} consultant=${consultantId} limit=${limit}`);

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      include: {
        workAuths: { where: { isCurrent: true }, take: 1 },
      },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found in tenant ${tenantId}`);
    }

    const skills = (consultant.skills as string[]) ?? [];
    const currentAuth = consultant.workAuths[0] ?? null;
    const visaType = currentAuth?.authType ?? null;
    const h1bRestricted = visaType === 'H1B' || visaType === 'L1';

    /* --- Fetch active market jobs --- */
    const marketJobWhere: any = { status: 'ACTIVE' };
    if (h1bRestricted) {
      marketJobWhere.employmentType = 'C2C';
    }

    const marketJobs = await this.prisma.marketJob.findMany({
      where: marketJobWhere,
      orderBy: { postedAt: 'desc' },
      take: 500,
      select: {
        id: true, title: true, company: true, description: true,
        location: true, locationType: true, employmentType: true,
        skills: true, hourlyRateMin: true, hourlyRateMax: true,
        rateText: true, applyUrl: true, sourceUrl: true, source: true,
        postedAt: true, sourcePostedAt: true, realnessScore: true,
        actionabilityScore: true, recruiterName: true, recruiterEmail: true,
        status: true,
      },
    });

    /* --- Fetch active internal jobs --- */
    const internalJobs = await this.prisma.job.findMany({
      where: { tenantId, status: { in: ['NEW', 'QUALIFYING', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, title: true, description: true, location: true,
        locationType: true, skills: true, rateMin: true, rateMax: true,
        rateType: true, status: true,
        vendor: { select: { id: true, companyName: true } },
        closureLikelihood: true, createdAt: true,
      },
    });

    const now = new Date();

    /* --- Score market jobs --- */
    const scoredMarket = marketJobs.map((job) => {
      const jobSkills = (job.skills as string[]) ?? [];
      const overlap = skillOverlapScore(skills, jobSkills);
      const skillScore = overlap * 50;

      let rateScore = 10;
      if (consultant.desiredRate && job.hourlyRateMax) {
        if (job.hourlyRateMax >= consultant.desiredRate) rateScore = 20;
        else if (job.hourlyRateMin && job.hourlyRateMin >= consultant.desiredRate * 0.85) rateScore = 14;
        else rateScore = Math.max(0, ((job.hourlyRateMax ?? 0) / consultant.desiredRate) * 15);
      }

      let freshnessScore = 5;
      const postedDate = job.sourcePostedAt ?? job.postedAt;
      if (postedDate) {
        const daysOld = daysBetween(now, postedDate);
        freshnessScore = Math.max(0, 15 - (daysOld / 14) * 15);
      }

      const realnessComponent = ((job.realnessScore ?? 50) / 100) * 8;
      const actionabilityComponent = ((job.actionabilityScore ?? 50) / 100) * 7;
      const qualityScore = realnessComponent + actionabilityComponent;
      const totalScore = Math.round(skillScore + rateScore + freshnessScore + qualityScore);

      return {
        id: job.id, source: 'MARKET' as const, title: job.title,
        company: job.company, location: job.location, locationType: job.locationType,
        employmentType: job.employmentType,
        employmentTypeBadge: formatEmploymentType(job.employmentType),
        skills: jobSkills, rateMin: job.hourlyRateMin, rateMax: job.hourlyRateMax,
        rateText: job.rateText, applyUrl: job.applyUrl, sourceUrl: job.sourceUrl,
        jobSource: job.source,
        postedAt: (job.sourcePostedAt ?? job.postedAt)?.toISOString() ?? null,
        recruiterName: job.recruiterName, recruiterEmail: job.recruiterEmail,
        realnessScore: job.realnessScore, matchScore: totalScore,
        scoreBreakdown: {
          skillOverlap: Math.round(skillScore), rateFit: Math.round(rateScore),
          freshness: Math.round(freshnessScore), quality: Math.round(qualityScore),
        },
      };
    });

    /* --- Score internal jobs --- */
    const scoredInternal = internalJobs.map((job) => {
      const jobSkills = (job.skills as string[]) ?? [];
      const overlap = skillOverlapScore(skills, jobSkills);
      const skillScore = overlap * 50;

      let rateScore = 10;
      const jobRate = job.rateType === 'ANNUAL' && job.rateMax ? job.rateMax / 2080 : job.rateMax;
      if (consultant.desiredRate && jobRate) {
        if (jobRate >= consultant.desiredRate) rateScore = 20;
        else if (jobRate >= consultant.desiredRate * 0.85) rateScore = 14;
        else rateScore = Math.max(0, (jobRate / consultant.desiredRate) * 15);
      }

      const daysOld = daysBetween(now, job.createdAt);
      const freshnessScore = Math.max(0, 15 - (daysOld / 14) * 15);
      const closureComponent = ((job.closureLikelihood ?? 0.5) * 10);
      const internalBonus = 5;
      const qualityScore = Math.min(15, closureComponent + internalBonus);
      const totalScore = Math.round(skillScore + rateScore + freshnessScore + qualityScore);

      const rateMin = job.rateType === 'ANNUAL' && job.rateMin ? job.rateMin / 2080 : job.rateMin;
      const rateMaxHourly = job.rateType === 'ANNUAL' && job.rateMax ? job.rateMax / 2080 : job.rateMax;

      return {
        id: job.id, source: 'INTERNAL' as const, title: job.title,
        company: (job.vendor as any)?.companyName ?? null,
        location: job.location, locationType: job.locationType,
        employmentType: null, employmentTypeBadge: 'Internal Req',
        skills: jobSkills,
        rateMin: rateMin ? Math.round(rateMin * 100) / 100 : null,
        rateMax: rateMaxHourly ? Math.round(rateMaxHourly * 100) / 100 : null,
        rateText: job.rateMin && job.rateMax
          ? `$${job.rateMin}–$${job.rateMax} ${job.rateType === 'ANNUAL' ? '/yr' : '/hr'}`
          : null,
        applyUrl: null, sourceUrl: null, jobSource: 'INTERNAL',
        postedAt: job.createdAt.toISOString(),
        recruiterName: null, recruiterEmail: null, realnessScore: null,
        matchScore: totalScore,
        scoreBreakdown: {
          skillOverlap: Math.round(skillScore), rateFit: Math.round(rateScore),
          freshness: Math.round(freshnessScore), quality: Math.round(qualityScore),
        },
      };
    });

    /* --- Merge + rank --- */
    const allScored = [...scoredMarket, ...scoredInternal];
    allScored.sort((a, b) => b.matchScore - a.matchScore);
    const topJobs = allScored.slice(0, Math.min(limit, 50));

    this.logger.log(
      `getTopJobsForConsultant ${consultant.firstName} ${consultant.lastName}: ` +
      `scored ${scoredMarket.length} market + ${scoredInternal.length} internal, ` +
      `returning top ${topJobs.length}`,
    );

    return {
      consultantId: consultant.id,
      consultantName: `${consultant.firstName} ${consultant.lastName}`,
      visaType,
      visaBadge: visaBadge(visaType),
      h1bRestricted,
      desiredRate: consultant.desiredRate,
      skillCount: skills.length,
      totalJobsScored: allScored.length,
      jobs: topJobs,
    };
  }

  /* ================================================================ */
  /*  4. getTechCategories — static list for filter UI                 */
  /* ================================================================ */

  getTechCategories() {
    return Object.entries(TECH_CATEGORIES).map(([key, cat]) => ({
      key,
      label: cat.label,
      keywordCount: cat.keywords.length,
      premiumFamilies: cat.premiumFamilies,
    }));
  }

  /* ================================================================ */
  /*  Private: load vendor domains for filtering (tenant-scoped)       */
  /* ================================================================ */

  private vendorDomainsCacheMap = new Map<string, { domains: Set<string>; at: number }>();

  private async loadVendorDomains(tenantId: string): Promise<Set<string>> {
    const cached = this.vendorDomainsCacheMap.get(tenantId);
    if (cached && Date.now() - cached.at < 300_000) {
      return cached.domains;
    }

    const domains = new Set<string>();

    // 1. ExtractedVendorCompany — no tenantId on this model, load all
    try {
      const extractedVendors = await this.prisma.extractedVendorCompany.findMany({
        select: { domain: true },
      });
      for (const v of extractedVendors) {
        if (v.domain) {
          const d = v.domain.toLowerCase();
          if (!FREE_EMAIL_DOMAINS.has(d)) domains.add(d);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load ExtractedVendorCompany domains: ${err.message}`);
    }

    // 2. Vendor table domains (tenant-scoped)
    try {
      const vendors = await this.prisma.vendor.findMany({
        select: { domain: true },
        where: { tenantId, domain: { not: null } },
      });
      for (const v of vendors) {
        if (v.domain) {
          const d = v.domain.toLowerCase();
          if (!FREE_EMAIL_DOMAINS.has(d)) domains.add(d);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load Vendor domains: ${err.message}`);
    }

    // 3. VendorContact emails → extract domains (tenant-scoped via vendor)
    try {
      const vendorContacts = await this.prisma.vendorContact.findMany({
        select: { email: true },
        where: { email: { not: null }, vendor: { tenantId } },
      });
      for (const vc of vendorContacts) {
        const d = vc.email?.split('@')[1]?.toLowerCase();
        if (d && !FREE_EMAIL_DOMAINS.has(d)) domains.add(d);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load VendorContact domains: ${err.message}`);
    }

    this.logger.log(`Loaded ${domains.size} vendor domains for tenant=${tenantId}`);
    this.vendorDomainsCacheMap.set(tenantId, { domains, at: Date.now() });
    return domains;
  }
}

/* ------------------------------------------------------------------ */
/*  Private module-level helpers                                       */
/* ------------------------------------------------------------------ */

function formatEmploymentType(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  const map: Record<string, string> = {
    C2C: 'Corp-to-Corp',
    W2: 'W-2',
    W2_1099: 'W-2 / 1099',
    FULLTIME: 'Full-Time',
    PARTTIME: 'Part-Time',
    CONTRACT: 'Contract',
    UNKNOWN: 'Unknown',
  };
  return map[type] ?? type;
}
