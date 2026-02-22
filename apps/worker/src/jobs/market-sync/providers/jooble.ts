import type { JobProvider, RawMarketJob } from '../types';

/**
 * Jooble — free multi-board job aggregator API.
 * Good coverage of US IT contract roles.
 *
 * Pricing: Free (requires API key from jooble.org/api)
 * Env: JOOBLE_API_KEY
 */
export class JoobleProvider implements JobProvider {
  name = 'Jooble';
  source = 'JOOBLE';

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.JOOBLE_API_KEY ?? '';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async fetchJobs(queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    for (const query of queries) {
      try {
        const response = await fetch(
          `https://jooble.org/api/${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keywords: query,
              location: 'United States',
              page: 1,
            }),
          },
        );

        if (!response.ok) {
          console.error(`[Jooble] HTTP ${response.status} for query "${query}"`);
          continue;
        }

        const data = await response.json() as {
          jobs?: Array<{
            id: string;
            title: string;
            company: string;
            snippet: string;
            location: string;
            link: string;
            updated: string;
            salary?: string;
            source?: string;
            type?: string;
          }>;
        };

        for (const job of data.jobs ?? []) {
          const sourceDate = job.updated ? new Date(job.updated) : undefined;
          results.push({
            externalId: job.id || `jooble-${hashString(job.link)}`,
            source: this.source,
            title: job.title,
            company: job.company || 'Unknown',
            description: job.snippet || '',
            location: job.location || undefined,
            locationType: detectLocationType(job.title + ' ' + job.snippet + ' ' + (job.location ?? '')),
            applyUrl: job.link,
            sourceUrl: job.link,
            postedAt: sourceDate,
            sourcePostedAt: sourceDate,
            rawPayload: job as unknown as Record<string, unknown>,
          });
        }

        await sleep(300);
      } catch (err) {
        console.error(`[Jooble] Error for query "${query}":`, err);
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
