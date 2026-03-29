import type { JobProvider, RawMarketJob } from '../types';

/**
 * LinkedInSafeJobsProvider — Policy-compliant LinkedIn jobs ingestion.
 *
 * COMPLIANCE ARCHITECTURE:
 * This provider does NOT scrape LinkedIn directly. LinkedIn does not offer
 * a public job search API for third-party ingestion. Direct HTML scraping,
 * browser automation, proxy rotation, fake sessions, and CAPTCHA bypass
 * are explicitly prohibited in this codebase.
 *
 * Instead, this provider supports these APPROVED ingestion modes:
 *
 * A. LICENSED_PROVIDER — Jobs from licensed aggregators that index LinkedIn
 *    postings legally (e.g., JSearch/RapidAPI indexes Google Jobs which
 *    includes LinkedIn listings). This is the primary active source today.
 *
 * B. FIRST_PARTY_CAREER_SITE — Jobs crawled from company career pages
 *    (Greenhouse, Lever, etc.) that are also posted on LinkedIn.
 *    These are matched to LinkedIn via URL/company correlation.
 *
 * C. EMAIL_INTEL_DERIVED — Jobs extracted from vendor requirement emails
 *    where the vendor or posting is associated with a LinkedIn presence.
 *
 * D. MANUAL_IMPORT — Recruiter-uploaded CSV/JSON files of LinkedIn job data
 *    exported from their own LinkedIn Recruiter accounts (authorized use).
 *
 * E. ATS_OR_DISTRIBUTOR_SYNC — Future: Jobs from ATS integrations or
 *    XML distributor feeds where LinkedIn is a distribution channel.
 *
 * F. OFFICIAL_LINKEDIN_PARTNER — Future: Requires LinkedIn Talent Solutions
 *    partnership approval. Not currently active.
 *
 * Every job record stores its compliance class and lineage in rawPayload.
 */

// Compliance classification for each ingested job
export type SourceComplianceClass =
  | 'LICENSED_PROVIDER'
  | 'FIRST_PARTY_CAREER_SITE'
  | 'EMAIL_INTEL_DERIVED'
  | 'MANUAL_IMPORT'
  | 'ATS_OR_DISTRIBUTOR_SYNC'
  | 'OFFICIAL_LINKEDIN_PARTNER';

export interface LinkedInComplianceMetadata {
  sourceComplianceClass: SourceComplianceClass;
  sourcePlatform: string;          // e.g., 'linkedin', 'jsearch', 'greenhouse'
  sourceIngestionMethod: string;   // e.g., 'api_aggregator', 'career_page_crawl', 'csv_import'
  sourceDomain: string | null;     // e.g., 'linkedin.com', 'boards.greenhouse.io'
  sourceLicenseBasis: string;      // e.g., 'RapidAPI commercial license', 'public career page'
  sourceConfidence: number;        // 0-100: how confident this is a real LinkedIn job
  complianceNotes: string;         // human-readable compliance note
  linkedInEligible: boolean;       // whether this job should appear in the LinkedIn tab
  linkedInEligibilityReason: string;
  importedAt: string;              // ISO timestamp
  lastVerifiedAt: string | null;
  lineageRunId: string;            // unique run ID for audit trail
}

// Registry of prohibited methods — any provider attempting these should be flagged
export const PROHIBITED_METHODS = [
  'linkedin_html_scraping',
  'browser_automation_linkedin',
  'proxy_rotation_linkedin',
  'fake_session_cookies',
  'credential_sharing',
  'captcha_solving',
  'unauthorized_api_access',
  'session_hijacking',
  'stealth_browser',
] as const;

/**
 * The LinkedIn Safe Jobs Provider.
 *
 * In its current form, this provider does NOT fetch jobs itself.
 * Instead, it acts as a post-processing enrichment layer that:
 * 1. Identifies LinkedIn-eligible jobs already in the MarketJob table
 *    (sourced by other providers like JSearch, FaangTech, etc.)
 * 2. Tags them with compliance metadata
 * 3. Makes them available to the LinkedIn tab
 *
 * This is the honest architecture: LinkedIn jobs arrive through licensed
 * aggregators and career page crawls, not through direct LinkedIn access.
 */
export class LinkedInSafeJobsProvider implements JobProvider {
  name = 'LinkedIn Safe Gateway';
  source = 'LINKEDIN';

  /**
   * This provider is always "configured" because it processes
   * existing data rather than calling an external API.
   * Set LINKEDIN_PROVIDER_ENABLED=false to disable.
   */
  isConfigured(): boolean {
    const disabled = process.env.LINKEDIN_PROVIDER_ENABLED === 'false';
    if (disabled) {
      console.log('[LinkedInSafe] Provider disabled via LINKEDIN_PROVIDER_ENABLED=false');
    }
    return !disabled;
  }

  /**
   * This provider returns an empty array from fetchJobs().
   * LinkedIn-eligible jobs are identified through the enrichment pipeline
   * (handleLinkedInEnrichment) rather than direct API fetching.
   *
   * The provider is registered in the market-sync pipeline to maintain
   * architectural consistency, but actual LinkedIn tab population happens
   * in the daily enrichment worker job.
   */
  async fetchJobs(_queries: string[]): Promise<RawMarketJob[]> {
    // No direct fetching — LinkedIn jobs are identified via enrichment
    // of jobs already ingested by other providers (JSearch, FaangTech, etc.)
    console.log('[LinkedInSafe] No direct fetch — LinkedIn jobs are populated via enrichment pipeline');
    return [];
  }
}

/**
 * Build compliance metadata for a job being tagged as LinkedIn-eligible.
 */
export function buildComplianceMetadata(
  complianceClass: SourceComplianceClass,
  opts: {
    sourcePlatform: string;
    sourceIngestionMethod: string;
    sourceDomain: string | null;
    sourceLicenseBasis: string;
    sourceConfidence: number;
    complianceNotes: string;
    eligibilityReason: string;
    runId: string;
  },
): LinkedInComplianceMetadata {
  return {
    sourceComplianceClass: complianceClass,
    sourcePlatform: opts.sourcePlatform,
    sourceIngestionMethod: opts.sourceIngestionMethod,
    sourceDomain: opts.sourceDomain,
    sourceLicenseBasis: opts.sourceLicenseBasis,
    sourceConfidence: opts.sourceConfidence,
    complianceNotes: opts.complianceNotes,
    linkedInEligible: true,
    linkedInEligibilityReason: opts.eligibilityReason,
    importedAt: new Date().toISOString(),
    lastVerifiedAt: null,
    lineageRunId: opts.runId,
  };
}

/**
 * Source allowlist — each source must declare its legal basis.
 * This is checked before any ingestion run.
 */
export const SOURCE_ALLOWLIST: Record<string, {
  legalBasis: string;
  authMethod: string;
  owner: string;
  rateLimit: string;
  retryPolicy: string;
  retentionPolicy: string;
}> = {
  JSEARCH: {
    legalBasis: 'RapidAPI commercial license — indexes Google Jobs (which indexes LinkedIn)',
    authMethod: 'API key (RAPIDAPI_KEY)',
    owner: 'JSearch/RapidAPI',
    rateLimit: 'Per API plan (checked via spend-guard)',
    retryPolicy: '3 retries with exponential backoff',
    retentionPolicy: 'Active jobs retained; stale after 14 days',
  },
  GREENHOUSE: {
    legalBasis: 'Public career page API — companies opt-in to public listings',
    authMethod: 'None (public API)',
    owner: 'Greenhouse Software',
    rateLimit: '10 req/s per board',
    retryPolicy: '2 retries',
    retentionPolicy: 'Active while listed on career page',
  },
  LEVER: {
    legalBasis: 'Public career page API — companies opt-in to public listings',
    authMethod: 'None (public API)',
    owner: 'Lever',
    rateLimit: '10 req/s per board',
    retryPolicy: '2 retries',
    retentionPolicy: 'Active while listed on career page',
  },
  CORPTOCORP: {
    legalBasis: 'Public WordPress REST API — community job board',
    authMethod: 'None (public API)',
    owner: 'CorpToCorp.org',
    rateLimit: '1 req/s',
    retryPolicy: '2 retries',
    retentionPolicy: 'Active while on board',
  },
  MANUAL_IMPORT: {
    legalBasis: 'User-authorized export from their own LinkedIn Recruiter account',
    authMethod: 'File upload by authorized recruiter',
    owner: 'Customer/Recruiter',
    rateLimit: 'N/A (batch import)',
    retryPolicy: 'N/A',
    retentionPolicy: '90 days unless refreshed',
  },
};
