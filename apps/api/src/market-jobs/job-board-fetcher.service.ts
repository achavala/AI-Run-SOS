import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface FetchedJob {
  externalId: string;
  source: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  employmentType?: string;
  rateText?: string;
  skills?: string[];
  applyUrl?: string;
  sourceUrl?: string;
  postedAt?: Date;
}

@Injectable()
export class JobBoardFetcherService {
  private readonly logger = new Logger(JobBoardFetcherService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async fetchAll(): Promise<{ source: string; fetched: number; stored: number }[]> {
    const results: { source: string; fetched: number; stored: number }[] = [];

    const queries = [
      'Java Developer C2C', 'Salesforce Developer Contract',
      '.NET Developer C2C', 'DevOps Engineer Contract',
      'SAP Consultant C2C', 'Data Engineer Contract',
      'Cloud Architect W2', 'QA Automation C2C',
      'Python Developer Contract', 'Angular Developer C2C',
    ];

    for (const fetchFn of [
      () => this.fetchJSearch(queries),
      () => this.fetchJooble(queries),
      () => this.fetchAdzuna(queries),
      () => this.fetchArbeitnow(),
      () => this.fetchRemoteOK(),
      () => this.fetchDiceRSS(queries),
    ]) {
      try {
        const r = await fetchFn();
        results.push(r);
      } catch (err: any) {
        this.logger.error(`Fetch failed: ${err.message}`);
      }
    }

    return results;
  }

  private async fetchJSearch(queries: string[]): Promise<{ source: string; fetched: number; stored: number }> {
    const apiKey = this.config.get<string>('JSEARCH_API_KEY');
    if (!apiKey) {
      this.logger.warn('JSEARCH_API_KEY not set, skipping JSearch');
      return { source: 'JSEARCH', fetched: 0, stored: 0 };
    }

    let allJobs: FetchedJob[] = [];
    for (const query of queries.slice(0, 8)) {
      try {
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=2&country=us&date_posted=today`;
        const res = await fetch(url, {
          headers: {
            'x-rapidapi-host': 'jsearch.p.rapidapi.com',
            'x-rapidapi-key': apiKey,
          },
        });
        const data: any = await res.json();
        const jobs = (data.data || []).map((j: any) => ({
          externalId: `jsearch-${j.job_id}`,
          source: 'JSEARCH',
          title: j.job_title || '',
          company: j.employer_name || 'Unknown',
          description: (j.job_description || '').slice(0, 5000),
          location: j.job_city ? `${j.job_city}, ${j.job_state}` : j.job_state || null,
          employmentType: this.detectEmploymentType(
            (j.job_title || '') + ' ' + (j.job_description || '') + ' ' + (j.job_employment_type || ''),
          ),
          rateText: j.job_min_salary && j.job_max_salary
            ? `$${j.job_min_salary}–$${j.job_max_salary}/${j.job_salary_period || 'yr'}`
            : null,
          skills: this.extractSkills((j.job_title || '') + ' ' + (j.job_description || '')),
          applyUrl: j.job_apply_link,
          sourceUrl: j.job_google_link || j.job_apply_link,
          postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : new Date(),
        }));
        allJobs.push(...jobs);
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        this.logger.warn(`JSearch query failed "${query}": ${err.message}`);
      }
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'JSEARCH', fetched: allJobs.length, stored };
  }

  private async fetchJooble(queries: string[]): Promise<{ source: string; fetched: number; stored: number }> {
    const apiKey = this.config.get<string>('JOOBLE_API_KEY');
    if (!apiKey) {
      this.logger.warn('JOOBLE_API_KEY not set, skipping Jooble');
      return { source: 'JOOBLE', fetched: 0, stored: 0 };
    }

    let allJobs: FetchedJob[] = [];
    for (const query of queries.slice(0, 5)) {
      try {
        const res = await fetch(`https://jooble.org/api/${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: query, location: 'United States', page: 1 }),
        });
        const data: any = await res.json();
        const jobs = (data.jobs || []).map((j: any) => ({
          externalId: `jooble-${j.id || j.link}`,
          source: 'JOOBLE',
          title: j.title || '',
          company: j.company || 'Unknown',
          description: j.snippet || '',
          location: j.location || null,
          employmentType: this.detectEmploymentType(j.title + ' ' + j.snippet),
          applyUrl: j.link,
          sourceUrl: j.link,
          postedAt: j.updated ? new Date(j.updated) : new Date(),
        }));
        allJobs.push(...jobs);
      } catch { /* skip query */ }
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'JOOBLE', fetched: allJobs.length, stored };
  }

  private async fetchAdzuna(queries: string[]): Promise<{ source: string; fetched: number; stored: number }> {
    const appId = this.config.get<string>('ADZUNA_APP_ID');
    const appKey = this.config.get<string>('ADZUNA_APP_KEY');
    if (!appId || !appKey) {
      this.logger.warn('ADZUNA_APP_ID/KEY not set, skipping Adzuna');
      return { source: 'ADZUNA', fetched: 0, stored: 0 };
    }

    let allJobs: FetchedJob[] = [];
    for (const query of queries.slice(0, 5)) {
      try {
        const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(query)}&results_per_page=20&content-type=application/json`;
        const res = await fetch(url);
        const data: any = await res.json();
        const jobs = (data.results || []).map((j: any) => ({
          externalId: `adzuna-${j.id}`,
          source: 'ADZUNA',
          title: j.title || '',
          company: j.company?.display_name || 'Unknown',
          description: j.description || '',
          location: j.location?.display_name || null,
          employmentType: this.detectEmploymentType(j.title + ' ' + (j.description || '')),
          rateText: j.salary_min ? `$${j.salary_min}–$${j.salary_max}` : null,
          applyUrl: j.redirect_url,
          sourceUrl: j.redirect_url,
          postedAt: j.created ? new Date(j.created) : new Date(),
        }));
        allJobs.push(...jobs);
      } catch { /* skip query */ }
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'ADZUNA', fetched: allJobs.length, stored };
  }

  private async fetchArbeitnow(): Promise<{ source: string; fetched: number; stored: number }> {
    let allJobs: FetchedJob[] = [];
    try {
      const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
      const data: any = await res.json();
      const jobs = (data.data || [])
        .filter((j: any) => j.remote || (j.location || '').toLowerCase().includes('us'))
        .slice(0, 100)
        .map((j: any) => ({
          externalId: `arbeitnow-${j.slug}`,
          source: 'ARBEITNOW',
          title: j.title || '',
          company: j.company_name || 'Unknown',
          description: j.description || '',
          location: j.location || (j.remote ? 'Remote' : null),
          employmentType: this.detectEmploymentType(j.title + ' ' + (j.description || '')),
          applyUrl: j.url,
          sourceUrl: j.url,
          postedAt: j.created_at ? new Date(j.created_at * 1000) : new Date(),
        }));
      allJobs = jobs;
    } catch (err: any) {
      this.logger.error(`Arbeitnow failed: ${err.message}`);
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'ARBEITNOW', fetched: allJobs.length, stored };
  }

  private async fetchRemoteOK(): Promise<{ source: string; fetched: number; stored: number }> {
    let allJobs: FetchedJob[] = [];
    try {
      const res = await fetch('https://remoteok.com/api', {
        headers: { 'User-Agent': 'AI-RUN-SOS Staffing Bot/1.0' },
      });
      const data: any = await res.json();
      const jobs = (Array.isArray(data) ? data.slice(1) : [])
        .filter((j: any) => j.position && j.company)
        .slice(0, 100)
        .map((j: any) => ({
          externalId: `remoteok-${j.id}`,
          source: 'REMOTEOK',
          title: j.position || '',
          company: j.company || 'Unknown',
          description: (j.description || '').slice(0, 5000),
          location: 'Remote',
          employmentType: this.detectEmploymentType(
            (j.position || '') + ' ' + (j.description || '') + ' ' + (j.tags || []).join(' '),
          ),
          rateText: j.salary_min && j.salary_max
            ? `$${j.salary_min}–$${j.salary_max}/yr`
            : undefined,
          skills: this.extractSkills((j.tags || []).join(' ') + ' ' + (j.position || '')),
          applyUrl: j.apply_url || j.url,
          sourceUrl: j.url,
          postedAt: j.date ? new Date(j.date) : new Date(),
        }));
      allJobs = jobs;
    } catch (err: any) {
      this.logger.error(`RemoteOK failed: ${err.message}`);
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'REMOTEOK', fetched: allJobs.length, stored };
  }

  private async fetchDiceRSS(queries: string[]): Promise<{ source: string; fetched: number; stored: number }> {
    let allJobs: FetchedJob[] = [];
    const diceQueries = [
      'C2C developer', 'contract developer', 'W2 consultant',
      'corp to corp', 'staffing developer', 'contract engineer',
    ];

    for (const query of diceQueries.slice(0, 6)) {
      try {
        const url = `https://www.dice.com/jobs?q=${encodeURIComponent(query)}&countryCode=US&radius=30&radiusUnit=mi&page=1&pageSize=20&filters.postedDate=ONE&language=en`;
        const res = await fetch(`https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?q=${encodeURIComponent(query)}&countryCode2=US&page=1&pageSize=20&postedDate=ONE`, {
          headers: {
            'x-api-key': '1YAt0R9wBg4WfsF9VB2778F5CHLAPMVW3WAZcKd8',
            'User-Agent': 'AI-RUN-SOS/1.0',
          },
        });
        if (!res.ok) continue;
        const data: any = await res.json();
        const jobs = (data.data || []).map((j: any) => ({
          externalId: `dice-${j.id}`,
          source: 'DICE',
          title: j.title || '',
          company: j.companyName || 'Unknown',
          description: (j.description || j.summary || '').slice(0, 5000),
          location: j.formattedLocation || j.jobLocation?.displayName || null,
          employmentType: this.detectEmploymentType(
            (j.title || '') + ' ' + (j.employmentType || '') + ' ' + (j.summary || ''),
          ),
          rateText: j.compensationSummary || null,
          skills: this.extractSkills((j.title || '') + ' ' + (j.skills?.map((s: any) => s.name).join(' ') || '')),
          applyUrl: `https://www.dice.com/job-detail/${j.id}`,
          sourceUrl: `https://www.dice.com/job-detail/${j.id}`,
          postedAt: j.postedDate ? new Date(j.postedDate) : new Date(),
        }));
        allJobs.push(...jobs);
        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        this.logger.warn(`Dice query failed "${query}": ${err.message}`);
      }
    }

    const stored = await this.storeJobs(allJobs);
    return { source: 'DICE', fetched: allJobs.length, stored };
  }

  private detectEmploymentType(text: string): string {
    const t = text.toLowerCase();
    if (/\bc2c\b/.test(t) || /\bcorp.to.corp\b/.test(t)) return 'C2C';
    if (/\bw2\b/.test(t)) return 'W2';
    if (/\bcontract\b/.test(t) && !/\bcontract.to.hire\b/.test(t)) return 'CONTRACT';
    if (/\bc2h\b/.test(t) || /\bcontract.to.hire\b/.test(t)) return 'C2H';
    if (/\bfull.time\b/.test(t) || /\bfte\b/.test(t)) return 'FTE';
    return 'UNKNOWN';
  }

  private extractSkills(text: string): string[] {
    const skillKeywords = [
      'java', 'python', 'javascript', 'typescript', 'react', 'angular', 'vue',
      'node', '.net', 'c#', 'c++', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins',
      'sql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'spring', 'django', 'flask', 'express', 'next.js',
      'salesforce', 'sap', 'servicenow', 'devops', 'ci/cd',
      'machine learning', 'ai', 'data science', 'tableau', 'power bi',
      'agile', 'scrum', 'jira', 'rest api', 'graphql', 'microservices',
    ];
    const t = text.toLowerCase();
    return skillKeywords.filter(s => t.includes(s));
  }

  private async storeJobs(jobs: FetchedJob[]): Promise<number> {
    let stored = 0;
    for (const job of jobs) {
      try {
        await this.prisma.marketJob.upsert({
          where: { source_externalId: { source: job.source as any, externalId: job.externalId } },
          create: {
            externalId: job.externalId,
            source: job.source as any,
            title: job.title,
            company: job.company,
            description: job.description,
            location: job.location,
            employmentType: (job.employmentType || 'UNKNOWN') as any,
            rateText: job.rateText,
            skills: job.skills || this.extractSkills(job.title + ' ' + job.description),
            applyUrl: job.applyUrl,
            sourceUrl: job.sourceUrl,
            postedAt: job.postedAt,
            discoveredAt: new Date(),
            status: 'ACTIVE',
            realnessScore: 50,
            actionabilityScore: 50,
          },
          update: {
            title: job.title,
            description: job.description,
            lastSeenAt: new Date(),
          },
        });
        stored++;
      } catch {
        // skip duplicates or validation errors
      }
    }
    return stored;
  }
}
