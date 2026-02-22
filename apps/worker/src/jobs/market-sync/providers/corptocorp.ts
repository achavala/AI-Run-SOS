import type { JobProvider, RawMarketJob } from '../types';

/**
 * Corp-to-Corp (corptocorp.org) — FREE, no API key needed.
 * Dedicated C2C/W2 staffing job board with 5000+ daily posts.
 * Uses the WordPress REST API for structured JSON access.
 *
 * This is one of the highest-signal sources for C2C contract roles.
 *
 * Pricing: 100% free
 * Rate limit: Be respectful — 1 req/sec, max 100 posts per fetch
 */
export class CorpToCorpProvider implements JobProvider {
  name = 'CorpToCorp';
  source = 'CORPTOCORP';

  private baseUrl = 'https://corptocorp.org/wp-json/wp/v2/posts';

  // WordPress category IDs for job posts (not blog/hotlist)
  // We filter by category slug in the request
  private jobCategories = ['c2c-job', 'c2c-jobs', 'jobs', 'w2-jobs'];

  isConfigured(): boolean {
    return true;
  }

  async fetchJobs(_queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];
    const seen = new Set<number>();

    try {
      // Fetch category IDs first
      const catIds = await this.getCategoryIds();
      if (catIds.length === 0) {
        // Fallback: fetch all posts and filter by content
        return this.fetchAllPosts();
      }

      for (const catId of catIds) {
        const posts = await this.fetchPostsByCategory(catId);
        for (const post of posts) {
          if (seen.has(post.id)) continue;
          seen.add(post.id);
          const job = this.parsePost(post);
          if (job) results.push(job);
        }
        await sleep(500);
      }
    } catch (err) {
      console.error('[CorpToCorp] Error:', err);
    }

    console.log(`[CorpToCorp] Fetched ${results.length} C2C/W2 jobs`);
    return results;
  }

  private async getCategoryIds(): Promise<number[]> {
    const ids: number[] = [];

    try {
      const resp = await fetch(
        'https://corptocorp.org/wp-json/wp/v2/categories?per_page=100&_fields=id,slug,count',
      );
      if (!resp.ok) return ids;

      const cats = (await resp.json()) as Array<{
        id: number;
        slug: string;
        count: number;
      }>;

      for (const cat of cats) {
        if (
          this.jobCategories.includes(cat.slug) ||
          cat.slug.includes('c2c') ||
          cat.slug.includes('w2')
        ) {
          ids.push(cat.id);
        }
      }
    } catch (err) {
      console.error('[CorpToCorp] Category fetch error:', err);
    }

    return ids;
  }

  private async fetchPostsByCategory(categoryId: number): Promise<WPPost[]> {
    const posts: WPPost[] = [];

    try {
      for (let page = 1; page <= 3; page++) {
        const url = `${this.baseUrl}?categories=${categoryId}&per_page=50&page=${page}&orderby=date&order=desc&_fields=id,date,link,title,excerpt,content,categories`;
        const resp = await fetch(url);

        if (!resp.ok) break;
        const data = (await resp.json()) as WPPost[];
        if (data.length === 0) break;

        posts.push(...data);

        const totalPages = parseInt(resp.headers.get('X-WP-TotalPages') ?? '1', 10);
        if (page >= totalPages) break;

        await sleep(800);
      }
    } catch (err) {
      console.error(`[CorpToCorp] Page fetch error for cat ${categoryId}:`, err);
    }

    return posts;
  }

  private async fetchAllPosts(): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    try {
      for (let page = 1; page <= 3; page++) {
        const url = `${this.baseUrl}?per_page=50&page=${page}&orderby=date&order=desc&_fields=id,date,link,title,excerpt,content,categories`;
        const resp = await fetch(url);
        if (!resp.ok) break;

        const data = (await resp.json()) as WPPost[];
        if (data.length === 0) break;

        for (const post of data) {
          const job = this.parsePost(post);
          if (job) results.push(job);
        }

        await sleep(800);
      }
    } catch (err) {
      console.error('[CorpToCorp] Fallback fetch error:', err);
    }

    return results;
  }

  private parsePost(post: WPPost): RawMarketJob | null {
    const title = decodeEntities(post.title?.rendered ?? '');
    if (!title || title.length < 5) return null;

    // Skip blog/SEO posts (not real job listings)
    if (/^top \d+/i.test(title)) return null;
    if (/visa sponsorship|green card|overseas/i.test(title)) return null;
    if (/hotlist|bench|available.*consultant/i.test(title.toLowerCase())) return null;

    const content = stripHtml(post.content?.rendered ?? post.excerpt?.rendered ?? '');
    const excerpt = stripHtml(post.excerpt?.rendered ?? '');
    const description = content || excerpt;

    if (description.length < 20) return null;

    const location = extractLocation(title, description);
    const locationType = extractLocationType(title, description);
    const rate = extractRate(description);
    const recruiter = extractRecruiterInfo(description);

    return {
      externalId: `corptocorp-${post.id}`,
      source: this.source,
      title,
      company: extractCompany(description) || 'Corp-to-Corp Listing',
      description: description.slice(0, 5000),
      location,
      locationType,
      applyUrl: post.link,
      sourceUrl: post.link,
      postedAt: post.date ? new Date(post.date) : undefined,
      sourcePostedAt: post.date ? new Date(post.date) : undefined,
      salaryMin: rate?.min,
      salaryMax: rate?.max,
      rateType: rate?.type,
      recruiterName: recruiter?.name,
      recruiterEmail: recruiter?.email,
      recruiterPhone: recruiter?.phone,
      rawPayload: {
        wpPostId: post.id,
        categories: post.categories,
        excerpt: excerpt.slice(0, 500),
      },
    };
  }
}

interface WPPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
}

function decodeEntities(html: string): string {
  return html
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&#038;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LOCATION_PATTERN =
  /\b(?:location|loc)\s*[:\-–]\s*([A-Z][a-zA-Z\s]+,?\s*(?:[A-Z]{2})?)/i;
const STATE_PATTERN =
  /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),?\s+([A-Z]{2})\b/;
const REMOTE_PATTERN = /\b(?:remote|work from home|wfh|100% remote)\b/i;

function extractLocation(title: string, body: string): string | undefined {
  const text = `${title} ${body}`;
  const locMatch = text.match(LOCATION_PATTERN);
  if (locMatch) return locMatch[1]!.trim();

  const stateMatch = text.match(STATE_PATTERN);
  if (stateMatch) return `${stateMatch[1]}, ${stateMatch[2]}`;

  if (REMOTE_PATTERN.test(text)) return 'Remote';
  return undefined;
}

function extractLocationType(
  title: string,
  body: string,
): 'REMOTE' | 'HYBRID' | 'ONSITE' | undefined {
  const text = `${title} ${body}`;
  if (/\bhybrid\b/i.test(text)) return 'HYBRID';
  if (REMOTE_PATTERN.test(text)) return 'REMOTE';
  if (/\b(?:onsite|on-site|on site|day 1 onsite)\b/i.test(text)) return 'ONSITE';
  return undefined;
}

const RATE_PATTERN =
  /\$\s*([\d,.]+)\s*(?:[-–\/to]+\s*\$?\s*([\d,.]+))?\s*\/?\s*(?:hr|hour|per\s*hour)/i;
const ANNUAL_PATTERN =
  /\$\s*([\d,.]+)\s*[kK]?\s*(?:[-–\/to]+\s*\$?\s*([\d,.]+)\s*[kK]?)?\s*(?:\/?\s*(?:yr|year|annual|per\s*annum))/i;

function extractRate(
  body: string,
): { min: number; max: number; type: 'HOURLY' | 'ANNUAL' } | null {
  const hourly = body.match(RATE_PATTERN);
  if (hourly) {
    const min = parseFloat(hourly[1]!.replace(/,/g, ''));
    const max = hourly[2] ? parseFloat(hourly[2].replace(/,/g, '')) : min;
    if (min > 0 && min < 500) return { min, max, type: 'HOURLY' };
  }

  const annual = body.match(ANNUAL_PATTERN);
  if (annual) {
    let min = parseFloat(annual[1]!.replace(/,/g, ''));
    let max = annual[2] ? parseFloat(annual[2].replace(/,/g, '')) : min;
    if (min < 1000) { min *= 1000; max *= 1000; }
    return { min, max, type: 'ANNUAL' };
  }

  // Simple rate pattern: "$55/hr" embedded in text
  const simpleRate = body.match(/\$(\d+)\s*\/?\s*hr/i);
  if (simpleRate) {
    const val = parseInt(simpleRate[1]!, 10);
    if (val > 15 && val < 500) return { min: val, max: val, type: 'HOURLY' };
  }

  return null;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_PATTERN = /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const NAME_BEFORE_EMAIL =
  /(?:contact|reach|email|send|recruiter)\s*[:\-]?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s/i;

function extractRecruiterInfo(
  body: string,
): { name?: string; email?: string; phone?: string } | null {
  const email = body.match(EMAIL_PATTERN)?.[0];
  const phone = body.match(PHONE_PATTERN)?.[0];
  const name = body.match(NAME_BEFORE_EMAIL)?.[1];

  if (!email && !phone) return null;
  return { name, email, phone };
}

const COMPANY_PATTERN =
  /(?:company|client|employer|vendor|posted by)\s*[:\-–]\s*([A-Z][\w\s&,.']+)/i;

function extractCompany(body: string): string | undefined {
  const match = body.match(COMPANY_PATTERN);
  return match?.[1]?.trim().slice(0, 100);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
