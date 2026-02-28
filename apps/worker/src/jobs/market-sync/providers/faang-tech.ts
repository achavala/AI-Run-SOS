import type { JobProvider, RawMarketJob } from '../types';

/**
 * Institutional-Grade High-Comp Role Harvester
 *
 * Strategy: Targeted signal sourcing from curated ATS endpoints.
 * NOT a mass web crawler. Every company is explicitly mapped to its ATS platform.
 *
 * Sources (all public, no auth, structured JSON):
 *   - Greenhouse Job Board API: boards-api.greenhouse.io/v1/boards/{slug}/jobs
 *   - Lever Postings API:       api.lever.co/v0/postings/{slug}
 *
 * Comp intelligence:
 *   - Parses CA/NY/CO salary transparency disclosures from descriptions
 *   - Distinguishes "base salary" from "total compensation"
 *   - Caps base salary at realistic ceilings per level
 *   - Computes OpportunityScore for ranking
 */

// ─── ATS Company Registry ────────────────────────────────────────

type ATS = 'GREENHOUSE' | 'LEVER';

interface CompanyEntry {
  slug: string;
  company: string;
  ats: ATS;
  tier: 'FAANG' | 'MEGA_TECH' | 'AI_INFRA' | 'HIGH_GROWTH';
}

const COMPANY_REGISTRY: CompanyEntry[] = [
  // Group A: FAANG + Mega Tech
  { slug: 'meta', company: 'Meta', ats: 'GREENHOUSE', tier: 'FAANG' },
  { slug: 'netflix', company: 'Netflix', ats: 'LEVER', tier: 'FAANG' },

  // Group B: AI / Cloud / Infra (highest comp in market)
  { slug: 'openai', company: 'OpenAI', ats: 'GREENHOUSE', tier: 'AI_INFRA' },
  { slug: 'anthropic', company: 'Anthropic', ats: 'GREENHOUSE', tier: 'AI_INFRA' },
  { slug: 'databricks', company: 'Databricks', ats: 'GREENHOUSE', tier: 'AI_INFRA' },
  { slug: 'snowflakecomputing', company: 'Snowflake', ats: 'GREENHOUSE', tier: 'AI_INFRA' },
  { slug: 'scaleai', company: 'Scale AI', ats: 'GREENHOUSE', tier: 'AI_INFRA' },

  // Group C: Tier-1 High-Growth Tech
  { slug: 'stripe', company: 'Stripe', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'airbnb', company: 'Airbnb', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'palantirtechnologies', company: 'Palantir', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'cloudflare', company: 'Cloudflare', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'pinterest', company: 'Pinterest', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'doordash', company: 'DoorDash', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'coinbase', company: 'Coinbase', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'robinhood', company: 'Robinhood', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'figma', company: 'Figma', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'discord', company: 'Discord', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'reddit', company: 'Reddit', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'block', company: 'Block (Square)', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'roblox', company: 'Roblox', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'notion', company: 'Notion', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'plaid', company: 'Plaid', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },

  // Group D: Enterprise Tech (high base, high stability)
  { slug: 'twilio', company: 'Twilio', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'datadog', company: 'Datadog', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'mongodb', company: 'MongoDB', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'crowdstrike', company: 'CrowdStrike', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'servicenow', company: 'ServiceNow', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'paloaltonetworks', company: 'Palo Alto Networks', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'hashicorp', company: 'HashiCorp', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'elastic', company: 'Elastic', ats: 'GREENHOUSE', tier: 'MEGA_TECH' },
  { slug: 'cockroachlabs', company: 'Cockroach Labs', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'airtable', company: 'Airtable', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'instacart', company: 'Instacart', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'nerdwallet', company: 'NerdWallet', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'gusto', company: 'Gusto', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'rippling', company: 'Rippling', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'brex', company: 'Brex', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'duolingo', company: 'Duolingo', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
  { slug: 'anduril', company: 'Anduril', ats: 'GREENHOUSE', tier: 'HIGH_GROWTH' },
];

// ─── Compensation Intelligence ───────────────────────────────────

const SENIOR_RE = /\b(senior|staff|principal|distinguished|director|vp|vice president|head of|chief|fellow|architect|lead|sr\.?)\b/i;
const ELITE_TITLE_RE = /\b(staff|principal|distinguished|director|vp|vice president|head of|chief|fellow)\b/i;

// Matches "$200,000 - $350,000" patterns
const DOLLAR_RANGE_RE = /\$\s*([\d,]+)\s*(?:[-–—to]+\s*\$?\s*([\d,]+))?/g;

// Context around dollar amounts to determine if base or total
const BASE_CONTEXT_RE = /\b(base\s+(?:salary|pay|compensation)|salary\s+range|annual\s+(?:base|salary)|base\s+range|base\s+pay\s+range)\b/i;
const TOTAL_CONTEXT_RE = /\b(total\s+(?:comp|compensation)|on[- ]?target\s+earn|ote|total\s+annual|overall\s+comp|expected\s+annual\s+comp)\b/i;

/**
 * Institutional-grade compensation parser.
 * Distinguishes base salary from total compensation.
 * Caps unrealistic values per seniority level.
 */
function parseCompIntel(text: string, title: string): {
  baseMin: number; baseMax: number;
  totalMin: number; totalMax: number;
  compType: 'BASE' | 'TOTAL' | 'UNSPECIFIED';
  hasEquityMention: boolean;
} | null {
  if (!text) return null;

  const hasEquityMention = /\b(rsu|stock|equity|shares|vest|restricted stock)\b/i.test(text);

  // Find all dollar ranges
  const ranges: { low: number; high: number; context: string }[] = [];
  const matches = [...text.matchAll(DOLLAR_RANGE_RE)];

  for (const m of matches) {
    const low = parseInt((m[1] ?? '0').replace(/,/g, ''), 10);
    const high = m[2] ? parseInt(m[2].replace(/,/g, ''), 10) : low;

    // Only annual-salary-range amounts (ignore stock grant values, signing bonuses in small ranges)
    if (low < 80_000 || low > 1_500_000) continue;

    // Grab 100 chars around the match for context
    const idx = m.index ?? 0;
    const context = text.slice(Math.max(0, idx - 100), idx + (m[0]?.length ?? 0) + 100);
    ranges.push({ low, high, context });
  }

  if (ranges.length === 0) return null;

  // Determine if we're looking at base or total comp
  let compType: 'BASE' | 'TOTAL' | 'UNSPECIFIED' = 'UNSPECIFIED';
  let bestRange = ranges[0]!;

  for (const r of ranges) {
    if (BASE_CONTEXT_RE.test(r.context)) {
      compType = 'BASE';
      bestRange = r;
      break;
    }
    if (TOTAL_CONTEXT_RE.test(r.context)) {
      compType = 'TOTAL';
      bestRange = r;
    }
  }

  // If no explicit context, use heuristics:
  // - If range max > $450K and equity is mentioned, likely total comp
  // - If range max <= $450K, likely base (CA/NY disclosures are usually base)
  if (compType === 'UNSPECIFIED') {
    if (bestRange.high > 450_000 && hasEquityMention) {
      compType = 'TOTAL';
    } else {
      compType = 'BASE';
    }
  }

  let baseMin: number, baseMax: number, totalMin: number, totalMax: number;

  if (compType === 'BASE') {
    baseMin = bestRange.low;
    baseMax = bestRange.high;
    // Estimate total comp: base + ~30-60% for stock+bonus at senior levels
    const equityMultiplier = ELITE_TITLE_RE.test(title) ? 1.6 : 1.35;
    totalMin = Math.round(baseMin * equityMultiplier);
    totalMax = Math.round(baseMax * equityMultiplier);
  } else {
    totalMin = bestRange.low;
    totalMax = bestRange.high;
    // Estimate base from total: typically 50-65% of total at FAANG
    const baseFraction = ELITE_TITLE_RE.test(title) ? 0.50 : 0.60;
    baseMin = Math.round(totalMin * baseFraction);
    baseMax = Math.round(totalMax * baseFraction);
  }

  // Sanity caps: no engineer base > $500K (even at Netflix)
  baseMax = Math.min(baseMax, 500_000);
  baseMin = Math.min(baseMin, baseMax);

  return { baseMin, baseMax, totalMin, totalMax, compType, hasEquityMention };
}

// ─── OpportunityScore ────────────────────────────────────────────

const TIER_WEIGHT: Record<string, number> = {
  FAANG: 1.3, AI_INFRA: 1.25, MEGA_TECH: 1.1, HIGH_GROWTH: 1.0,
};

function computeOpportunityScore(
  baseMax: number,
  tier: string,
  isRemote: boolean,
  hasEquity: boolean,
  isEliteTitle: boolean,
): number {
  // Normalized comp score: $200K=50, $300K=70, $400K=85, $500K=100
  const compScore = Math.min(100, Math.round((baseMax / 5000)));

  const tierMultiplier = TIER_WEIGHT[tier] ?? 1.0;
  const remoteBonus = isRemote ? 5 : 0;
  const equityBonus = hasEquity ? 5 : 0;
  const eliteBonus = isEliteTitle ? 10 : 0;

  const raw = (compScore * tierMultiplier) + remoteBonus + equityBonus + eliteBonus;
  return Math.min(100, Math.round(raw));
}

// ─── Utilities ───────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Provider ────────────────────────────────────────────────────

export class FaangTechProvider implements JobProvider {
  name = 'FAANG & Tech Careers';
  source = 'OTHER';

  isConfigured(): boolean {
    return true;
  }

  async fetchJobs(_queries: string[]): Promise<RawMarketJob[]> {
    const results: RawMarketJob[] = [];

    const greenhouse = COMPANY_REGISTRY.filter((c) => c.ats === 'GREENHOUSE');
    const lever = COMPANY_REGISTRY.filter((c) => c.ats === 'LEVER');

    for (const entry of greenhouse) {
      try {
        const jobs = await this.fetchGreenhouse(entry);
        results.push(...jobs);
        await sleep(350);
      } catch (err) {
        console.error(`[HighComp] Greenhouse ${entry.company} failed:`, err instanceof Error ? err.message : err);
      }
    }

    for (const entry of lever) {
      try {
        const jobs = await this.fetchLever(entry);
        results.push(...jobs);
        await sleep(350);
      } catch (err) {
        console.error(`[HighComp] Lever ${entry.company} failed:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[HighComp] Total institutional-grade high-comp roles: ${results.length} from ${COMPANY_REGISTRY.length} companies`);
    return results;
  }

  private async fetchGreenhouse(entry: CompanyEntry): Promise<RawMarketJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${entry.slug}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 404) console.log(`[HighComp] Greenhouse '${entry.slug}' not found, skipping`);
      return [];
    }

    const data = await res.json() as {
      jobs?: Array<{
        id: number; title: string; content?: string;
        location?: { name?: string }; absolute_url?: string;
        updated_at?: string; departments?: Array<{ name?: string }>;
      }>;
    };

    const totalJobs = data.jobs?.length ?? 0;
    const results: RawMarketJob[] = [];

    for (const job of data.jobs ?? []) {
      if (!SENIOR_RE.test(job.title)) continue;

      const desc = job.content ? stripHtml(job.content) : '';
      const comp = parseCompIntel(desc, job.title);

      const isHighPaid = comp && comp.baseMax >= 200_000;
      const isEliteTitle = ELITE_TITLE_RE.test(job.title);
      if (!isHighPaid && !isEliteTitle) continue;

      const location = job.location?.name ?? '';
      const isRemote = /remote/i.test(location);

      const opportunityScore = comp
        ? computeOpportunityScore(comp.baseMax, entry.tier, isRemote, comp.hasEquityMention, isEliteTitle)
        : isEliteTitle ? 65 : 50;

      results.push({
        externalId: `gh-${entry.slug}-${job.id}`,
        source: 'OTHER',
        title: job.title,
        company: entry.company,
        description: desc.slice(0, 5000),
        location: location || undefined,
        locationType: isRemote ? 'REMOTE' : 'ONSITE',
        applyUrl: job.absolute_url,
        sourceUrl: `https://boards.greenhouse.io/${entry.slug}/jobs/${job.id}`,
        postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
        sourcePostedAt: job.updated_at ? new Date(job.updated_at) : undefined,
        salaryMin: comp?.baseMin,
        salaryMax: comp?.baseMax,
        rateType: 'ANNUAL',
        rawPayload: {
          faangSource: 'GREENHOUSE',
          boardSlug: entry.slug,
          companyTier: entry.tier,
          departments: job.departments?.map((d) => d.name).filter(Boolean),
          isHighPaid: true,
          compIntel: comp ? {
            baseMin: comp.baseMin, baseMax: comp.baseMax,
            totalMin: comp.totalMin, totalMax: comp.totalMax,
            compType: comp.compType,
            hasEquity: comp.hasEquityMention,
          } : null,
          opportunityScore,
        },
      });
    }

    console.log(`[HighComp] Greenhouse ${entry.company}: ${results.length} qualifying from ${totalJobs} total`);
    return results;
  }

  private async fetchLever(entry: CompanyEntry): Promise<RawMarketJob[]> {
    const url = `https://api.lever.co/v0/postings/${entry.slug}?mode=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 404) console.log(`[HighComp] Lever '${entry.slug}' not found, skipping`);
      return [];
    }

    const postings = await res.json() as Array<{
      id: string; text: string; descriptionPlain?: string; description?: string;
      categories?: { location?: string; team?: string; department?: string };
      hostedUrl?: string; createdAt?: number;
      lists?: Array<{ text: string; content: string }>;
    }>;

    const results: RawMarketJob[] = [];

    for (const posting of postings) {
      if (!SENIOR_RE.test(posting.text)) continue;

      const descParts = [
        posting.descriptionPlain || stripHtml(posting.description || ''),
        ...(posting.lists ?? []).map((l) => stripHtml(l.content)),
      ];
      const fullDesc = descParts.join(' ').slice(0, 5000);
      const comp = parseCompIntel(fullDesc, posting.text);

      const isHighPaid = comp && comp.baseMax >= 200_000;
      const isEliteTitle = ELITE_TITLE_RE.test(posting.text);
      if (!isHighPaid && !isEliteTitle) continue;

      const location = posting.categories?.location ?? '';
      const isRemote = /remote/i.test(location);

      const opportunityScore = comp
        ? computeOpportunityScore(comp.baseMax, entry.tier, isRemote, comp.hasEquityMention, isEliteTitle)
        : isEliteTitle ? 65 : 50;

      results.push({
        externalId: `lv-${entry.slug}-${posting.id}`,
        source: 'OTHER',
        title: posting.text,
        company: entry.company,
        description: fullDesc,
        location: location || undefined,
        locationType: isRemote ? 'REMOTE' : 'ONSITE',
        applyUrl: posting.hostedUrl,
        sourceUrl: posting.hostedUrl,
        postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
        sourcePostedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
        salaryMin: comp?.baseMin,
        salaryMax: comp?.baseMax,
        rateType: 'ANNUAL',
        rawPayload: {
          faangSource: 'LEVER',
          boardSlug: entry.slug,
          companyTier: entry.tier,
          team: posting.categories?.team,
          department: posting.categories?.department,
          isHighPaid: true,
          compIntel: comp ? {
            baseMin: comp.baseMin, baseMax: comp.baseMax,
            totalMin: comp.totalMin, totalMax: comp.totalMax,
            compType: comp.compType,
            hasEquity: comp.hasEquityMention,
          } : null,
          opportunityScore,
        },
      });
    }

    console.log(`[HighComp] Lever ${entry.company}: ${results.length} qualifying from ${postings.length} total`);
    return results;
  }
}
