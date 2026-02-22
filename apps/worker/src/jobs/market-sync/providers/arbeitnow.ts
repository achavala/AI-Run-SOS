import type { JobProvider, RawMarketJob } from '../types';

/**
 * Arbeitnow — fully free, no auth required.
 * Pulls from Greenhouse, SmartRecruiters, Lever, etc.
 * Good for supplemental coverage, especially remote tech roles.
 *
 * Pricing: 100% free, no API key needed
 */
export class ArbeitnowProvider implements JobProvider {
  name = 'Arbeitnow';
  source = 'ARBEITNOW';

  private baseUrl = 'https://www.arbeitnow.com/api/job-board-api';

  isConfigured(): boolean {
    return true; // No API key required
  }

  async fetchJobs(_queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    try {
      for (let page = 1; page <= 3; page++) {
        const response = await fetch(`${this.baseUrl}?page=${page}`);

        if (!response.ok) {
          console.error(`[Arbeitnow] HTTP ${response.status} page ${page}`);
          break;
        }

        const data = await response.json() as {
          data?: Array<{
            slug: string;
            title: string;
            company_name: string;
            description: string;
            location: string;
            remote: boolean;
            url: string;
            created_at: number;
            tags: string[];
          }>;
          meta?: { current_page: number; last_page: number };
        };

        for (const job of data.data ?? []) {
          // Filter for IT/tech roles only
          const isIT = isITRole(job.title, job.tags);
          if (!isIT) continue;

          const sourceDate = job.created_at ? new Date(job.created_at * 1000) : undefined;
          results.push({
            externalId: job.slug,
            source: this.source,
            title: job.title,
            company: job.company_name ?? 'Unknown',
            description: job.description ?? '',
            location: job.location || undefined,
            locationType: job.remote ? 'REMOTE' : 'ONSITE',
            applyUrl: job.url,
            sourceUrl: job.url,
            postedAt: sourceDate,
            sourcePostedAt: sourceDate,
            rawPayload: job as unknown as Record<string, unknown>,
          });
        }

        if (data.meta && page >= data.meta.last_page) break;
        await sleep(1000);
      }
    } catch (err) {
      console.error('[Arbeitnow] Error:', err);
    }

    return results;
  }
}

const IT_KEYWORDS = /\b(?:engineer|developer|devops|sre|architect|analyst|data|cloud|security|cyber|software|fullstack|full[\s-]?stack|backend|frontend|platform|infrastructure|QA|SDET|ML|AI|machine\s*learning)\b/i;

function isITRole(title: string, tags: string[]): boolean {
  if (IT_KEYWORDS.test(title)) return true;
  return tags.some((t) => IT_KEYWORDS.test(t));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
