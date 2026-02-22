import type { JobProvider, RawMarketJob } from '../types';

/**
 * JSearch (RapidAPI) — aggregates Google Jobs which includes
 * LinkedIn, Indeed, Dice, ZipRecruiter, Glassdoor, and more.
 *
 * Pricing: Free 200 req/mo, $25/mo = 10K, $75/mo = 50K
 * Env: RAPIDAPI_KEY
 */
export class JSearchProvider implements JobProvider {
  name = 'JSearch';
  source = 'JSEARCH';

  private apiKey: string;
  private baseUrl = 'https://jsearch.p.rapidapi.com/search';

  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY ?? '';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async fetchJobs(queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          query,
          page: '1',
          num_pages: '3',
          date_posted: 'today',
          remote_jobs_only: 'false',
          employment_types: 'CONTRACTOR',
        });

        const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
          headers: {
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          console.error(`[JSearch] HTTP ${response.status} for query "${query}"`);
          continue;
        }

        const data = await response.json() as {
          data?: Array<{
            job_id: string;
            job_title: string;
            employer_name: string;
            job_description: string;
            job_city?: string;
            job_state?: string;
            job_country?: string;
            job_is_remote?: boolean;
            job_apply_link?: string;
            job_google_link?: string;
            job_posted_at_datetime_utc?: string;
            job_offer_expiration_datetime_utc?: string;
            job_min_salary?: number;
            job_max_salary?: number;
            job_salary_period?: string;
            employer_website?: string;
            job_publisher?: string;
          }>;
        };

        for (const job of data.data ?? []) {
          const locationParts = [job.job_city, job.job_state, job.job_country].filter(Boolean);
          const sourceDate = job.job_posted_at_datetime_utc
            ? new Date(job.job_posted_at_datetime_utc)
            : undefined;
          const expiry = job.job_offer_expiration_datetime_utc
            ? new Date(job.job_offer_expiration_datetime_utc)
            : undefined;

          results.push({
            externalId: job.job_id,
            source: this.source,
            title: job.job_title,
            company: job.employer_name ?? 'Unknown',
            description: job.job_description ?? '',
            location: locationParts.join(', ') || undefined,
            locationType: job.job_is_remote ? 'REMOTE' : 'ONSITE',
            applyUrl: job.job_apply_link ?? undefined,
            sourceUrl: job.job_google_link ?? undefined,
            postedAt: sourceDate,
            sourcePostedAt: sourceDate,
            expiresAt: expiry,
            salaryMin: job.job_min_salary ?? undefined,
            salaryMax: job.job_max_salary ?? undefined,
            rateType: job.job_salary_period === 'HOUR' ? 'HOURLY' : 'ANNUAL',
            rawPayload: job as unknown as Record<string, unknown>,
          });
        }

        // Rate limit: small delay between requests
        await sleep(500);
      } catch (err) {
        console.error(`[JSearch] Error for query "${query}":`, err);
      }
    }

    return results;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
