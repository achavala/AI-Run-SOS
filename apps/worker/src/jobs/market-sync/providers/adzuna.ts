import type { JobProvider, RawMarketJob } from '../types';

/**
 * Adzuna — job search API with free tier (2,500 calls/month).
 * Good for US/UK IT roles.
 *
 * Pricing: Free 2,500/mo (250/day, 25/min), paid plans available
 * Env: ADZUNA_APP_ID, ADZUNA_APP_KEY
 */
export class AdzunaProvider implements JobProvider {
  name = 'Adzuna';
  source = 'ADZUNA';

  private appId: string;
  private appKey: string;
  private baseUrl = 'https://api.adzuna.com/v1/api/jobs/us/search';

  constructor() {
    this.appId = process.env.ADZUNA_APP_ID ?? '';
    this.appKey = process.env.ADZUNA_APP_KEY ?? '';
  }

  isConfigured(): boolean {
    return this.appId.length > 0 && this.appKey.length > 0;
  }

  async fetchJobs(queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    for (const query of queries) {
      for (let page = 1; page <= 2; page++) {
        try {
          const params = new URLSearchParams({
            app_id: this.appId,
            app_key: this.appKey,
            results_per_page: '50',
            what: query,
            content_type: 'application/json',
            max_days_old: '3',
            sort_by: 'date',
            category: 'it-jobs',
          });

          const response = await fetch(`${this.baseUrl}/${page}?${params.toString()}`);

          if (!response.ok) {
            console.error(`[Adzuna] HTTP ${response.status} for query "${query}" page ${page}`);
            break;
          }

          const data = await response.json() as {
            results?: Array<{
              id: string;
              title: string;
              company?: { display_name?: string };
              description: string;
              location?: { display_name?: string; area?: string[] };
              redirect_url: string;
              created: string;
              salary_min?: number;
              salary_max?: number;
              salary_is_predicted?: string;
              contract_type?: string;
              contract_time?: string;
              category?: { label?: string; tag?: string };
            }>;
          };

          for (const job of data.results ?? []) {
            const sourceDate = job.created ? new Date(job.created) : undefined;
            results.push({
              externalId: String(job.id),
              source: this.source,
              title: job.title,
              company: job.company?.display_name ?? 'Unknown',
              description: job.description ?? '',
              location: job.location?.display_name ?? job.location?.area?.join(', ') ?? undefined,
              locationType: detectLocationType(job.title + ' ' + job.description),
              applyUrl: job.redirect_url,
              sourceUrl: job.redirect_url,
              postedAt: sourceDate,
              sourcePostedAt: sourceDate,
              salaryMin: job.salary_min ?? undefined,
              salaryMax: job.salary_max ?? undefined,
              rateType: (job.salary_min ?? 0) > 500 ? 'ANNUAL' : 'HOURLY',
              rawPayload: job as unknown as Record<string, unknown>,
            });
          }

          await sleep(2500); // Adzuna free tier: max 25 requests/min
        } catch (err) {
          console.error(`[Adzuna] Error for query "${query}" page ${page}:`, err);
          break;
        }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
