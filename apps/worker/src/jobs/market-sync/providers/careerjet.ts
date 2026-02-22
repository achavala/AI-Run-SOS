import type { JobProvider, RawMarketJob } from '../types';

/**
 * Careerjet — job search API with date-sorted results.
 * Supports salary structure and date filtering.
 *
 * Pricing: Free (requires affid from careerjet.com/partners)
 * Env: CAREERJET_AFFID
 */
export class CareerjetProvider implements JobProvider {
  name = 'Careerjet';
  source = 'CAREERJET';

  private affid: string;
  private baseUrl = 'http://public.api.careerjet.net/search';

  constructor() {
    this.affid = process.env.CAREERJET_AFFID ?? '';
  }

  isConfigured(): boolean {
    return this.affid.length > 0;
  }

  async fetchJobs(queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          keywords: query,
          location: 'United States',
          affid: this.affid,
          user_ip: '1.2.3.4',
          user_agent: 'Mozilla/5.0',
          url: 'https://staffingos.com',
          locale_code: 'en_US',
          sort: 'date',
          pagesize: '50',
          page: '1',
        });

        const response = await fetch(`${this.baseUrl}?${params.toString()}`);

        if (!response.ok) {
          console.error(`[Careerjet] HTTP ${response.status} for query "${query}"`);
          continue;
        }

        const data = await response.json() as {
          jobs?: Array<{
            url: string;
            title: string;
            company: string;
            description: string;
            locations: string;
            date: string;
            salary: string;
            salary_min?: number;
            salary_max?: number;
            salary_type?: string;
            site: string;
          }>;
          type?: string;
          hits?: number;
          pages?: number;
        };

        for (const job of data.jobs ?? []) {
          const sourceDate = job.date ? new Date(job.date) : undefined;
          const isSalaryHourly = (job.salary_type ?? '').toLowerCase().includes('hour');

          results.push({
            externalId: `cj-${hashString(job.url)}`,
            source: this.source,
            title: job.title,
            company: job.company || 'Unknown',
            description: job.description || '',
            location: job.locations || undefined,
            locationType: detectLocationType(job.title + ' ' + job.description + ' ' + (job.locations ?? '')),
            applyUrl: job.url,
            sourceUrl: job.url,
            postedAt: sourceDate,
            sourcePostedAt: sourceDate,
            salaryMin: job.salary_min ?? undefined,
            salaryMax: job.salary_max ?? undefined,
            rateType: isSalaryHourly ? 'HOURLY' : (job.salary_min ?? 0) > 500 ? 'ANNUAL' : 'HOURLY',
            rawPayload: job as unknown as Record<string, unknown>,
          });
        }

        await sleep(500);
      } catch (err) {
        console.error(`[Careerjet] Error for query "${query}":`, err);
      }
    }

    return results;
  }
}

function detectLocationType(text: string): 'REMOTE' | 'HYBRID' | 'ONSITE' {
  const lower = text.toLowerCase();
  if (/\bremote\b/.test(lower)) return 'REMOTE';
  if (/\bhybrid\b/.test(lower)) return 'HYBRID';
  return 'ONSITE';
}

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
