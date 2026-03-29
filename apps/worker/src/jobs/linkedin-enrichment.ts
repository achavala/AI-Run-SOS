import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  buildComplianceMetadata,
  type SourceComplianceClass,
  PROHIBITED_METHODS,
} from './market-sync/providers/linkedin-safe';

/**
 * LinkedIn Enrichment Pipeline — Daily worker job.
 *
 * This job identifies LinkedIn-eligible jobs already in the MarketJob table
 * and enriches them with:
 * 1. Compliance metadata (source class, legal basis, lineage)
 * 2. Vendor intelligence (tier prediction, confidence)
 * 3. LinkedIn opportunity scoring
 * 4. Eligibility tagging for the LinkedIn tab
 *
 * It does NOT fetch from LinkedIn. It processes jobs from approved sources
 * (JSearch, Greenhouse, Lever, CorpToCorp, email intel) that have LinkedIn
 * associations (sourceUrl/applyUrl containing linkedin.com, or source=LINKEDIN).
 *
 * Schedule: Daily at 6:30 AM UTC (after market-sync has run overnight)
 * Idempotent: Safe to run multiple times — updates existing metadata.
 */
export async function handleLinkedInEnrichment(
  prisma: PrismaClient,
  _data: Record<string, unknown>,
): Promise<void> {
  const runId = randomUUID();
  const startTime = Date.now();
  console.log(`[LinkedInEnrich] Starting enrichment run ${runId}`);

  // Compliance guard: verify no prohibited methods are active
  for (const method of PROHIBITED_METHODS) {
    if (process.env[`ENABLE_${method.toUpperCase()}`] === 'true') {
      console.error(`[LinkedInEnrich] BLOCKED: Prohibited method ${method} is enabled. Aborting.`);
      return;
    }
  }

  // Kill switch
  if (process.env.LINKEDIN_ENRICHMENT_DISABLED === 'true') {
    console.log('[LinkedInEnrich] Disabled via LINKEDIN_ENRICHMENT_DISABLED. Skipping.');
    return;
  }

  const stats = {
    scanned: 0,
    linkedinTagged: 0,
    alreadyTagged: 0,
    vendorMatched: 0,
    errors: 0,
  };

  try {
    // Phase 1: Find LinkedIn-eligible jobs that haven't been enriched yet
    // These are ACTIVE jobs where:
    // - source is LINKEDIN (from JSearch aggregation tagging), OR
    // - sourceUrl or applyUrl contains linkedin.com, OR
    // - they come from a first-party career crawl (GREENHOUSE/LEVER source in rawPayload)
    //
    // We process in batches to avoid memory issues.
    const BATCH_SIZE = 200;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const jobs = await prisma.$queryRaw`
        SELECT
          id::text as id,
          source::text as source,
          title,
          company,
          "companyDomain",
          "applyUrl",
          "sourceUrl",
          "recruiterEmail",
          "recruiterName",
          "recruiterPhone",
          "recruiterLinkedIn",
          "realnessScore",
          "actionabilityScore",
          "matchedVendorId",
          "rawPayload",
          "discoveredAt",
          "sourcePostedAt",
          description
        FROM "MarketJob"
        WHERE status = 'ACTIVE'
          AND (
            source::text = 'LINKEDIN'
            OR "sourceUrl" ILIKE '%linkedin.com%'
            OR "applyUrl" ILIKE '%linkedin.com%'
          )
        ORDER BY "discoveredAt" DESC
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      ` as any[];

      if (jobs.length === 0) {
        hasMore = false;
        break;
      }

      stats.scanned += jobs.length;

      // Load vendor intelligence for matching
      const vendors = await prisma.$queryRaw`
        SELECT id, "companyName", domain, "trustScore", tier::text as tier,
               "responseRate", "interviewGrantRate", "placementCount"
        FROM "Vendor"
        WHERE "trustScore" IS NOT NULL AND "trustScore" > 0
      ` as any[];

      const vendorByDomain = new Map<string, any>();
      const vendorByName = new Map<string, any>();
      for (const v of vendors) {
        if (v.domain) vendorByDomain.set(v.domain.toLowerCase(), v);
        if (v.companyName) vendorByName.set(v.companyName.toLowerCase(), v);
      }

      for (const job of jobs) {
        try {
          const existingPayload = typeof job.rawPayload === 'string'
            ? JSON.parse(job.rawPayload)
            : (job.rawPayload || {});

          // Skip if already enriched in this run or recently
          if (existingPayload?.linkedInCompliance?.lineageRunId === runId) {
            stats.alreadyTagged++;
            continue;
          }

          // Determine compliance class based on how this job arrived
          const compliance = determineComplianceClass(job);

          // Build vendor intelligence
          const vendorIntel = computeVendorIntelligence(
            job, vendorByDomain, vendorByName,
          );

          if (vendorIntel.matchedVendorId) {
            stats.vendorMatched++;
          }

          // Build compliance metadata
          const complianceMeta = buildComplianceMetadata(compliance.class, {
            sourcePlatform: compliance.platform,
            sourceIngestionMethod: compliance.method,
            sourceDomain: extractDomainFromUrl(job.sourceUrl || job.applyUrl),
            sourceLicenseBasis: compliance.licenseBasis,
            sourceConfidence: compliance.confidence,
            complianceNotes: compliance.notes,
            eligibilityReason: compliance.eligibilityReason,
            runId,
          });

          // Merge into rawPayload — preserving existing data
          const updatedPayload = {
            ...existingPayload,
            linkedInCompliance: complianceMeta,
            vendorIntelligence: {
              vendorQualityTier: vendorIntel.vendorQualityTier,
              vendorConfidenceScore: vendorIntel.vendorConfidenceScore,
              primeVendorLikelihood: vendorIntel.primeVendorLikelihood,
              directVendorLikelihood: vendorIntel.directVendorLikelihood,
              staffingVendorLikelihood: vendorIntel.staffingVendorLikelihood,
              historicalSignalCount: vendorIntel.historicalSignalCount,
              recruiterContactStrength: vendorIntel.recruiterContactStrength,
              vendorReasonCodes: vendorIntel.vendorReasonCodes,
              enrichedAt: new Date().toISOString(),
            },
          };

          // Update the job record
          await prisma.marketJob.update({
            where: { id: job.id },
            data: {
              rawPayload: updatedPayload,
              // Update matchedVendorId if we found a vendor match
              ...(vendorIntel.matchedVendorId && !job.matchedVendorId
                ? { matchedVendorId: vendorIntel.matchedVendorId }
                : {}),
            },
          });

          stats.linkedinTagged++;
        } catch (err) {
          stats.errors++;
          console.error(`[LinkedInEnrich] Error processing job ${job.id}:`, err);
        }
      }

      offset += BATCH_SIZE;
      if (jobs.length < BATCH_SIZE) hasMore = false;
    }

    // Phase 2: Also tag email-intel-derived jobs that mention LinkedIn
    const emailDerivedCount = await tagEmailIntelLinkedInJobs(prisma, runId);
    stats.linkedinTagged += emailDerivedCount;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[LinkedInEnrich] Completed run ${runId} in ${elapsed}s — ` +
      `scanned=${stats.scanned}, tagged=${stats.linkedinTagged}, ` +
      `vendorMatched=${stats.vendorMatched}, errors=${stats.errors}`,
    );

    // Phase 3: Log audit record
    await logIngestionAudit(prisma, {
      runId,
      source: 'LINKEDIN_ENRICHMENT',
      recordsImported: stats.linkedinTagged,
      recordsRejected: stats.errors,
      rejectionReasons: stats.errors > 0 ? ['Processing errors — see logs'] : [],
      complianceClass: 'LICENSED_PROVIDER',
      operatorIdentity: 'linkedin-enrichment-worker',
      durationMs: Date.now() - startTime,
    });

  } catch (err) {
    console.error(`[LinkedInEnrich] Fatal error in run ${runId}:`, err);
  }
}

/**
 * Determine the compliance class for a job based on its source and metadata.
 */
function determineComplianceClass(job: any): {
  class: SourceComplianceClass;
  platform: string;
  method: string;
  licenseBasis: string;
  confidence: number;
  notes: string;
  eligibilityReason: string;
} {
  const source = (job.source || '').toUpperCase();
  const payload = typeof job.rawPayload === 'string'
    ? JSON.parse(job.rawPayload)
    : (job.rawPayload || {});

  // Jobs from FAANG/career page crawls (Greenhouse/Lever)
  if (payload?.faangSource === 'GREENHOUSE' || payload?.faangSource === 'LEVER') {
    return {
      class: 'FIRST_PARTY_CAREER_SITE',
      platform: (payload.faangSource || 'career_page').toLowerCase(),
      method: 'career_page_crawl',
      licenseBasis: 'Public career page API — company opted into public listings',
      confidence: 85,
      notes: `Crawled from ${payload.company || job.company} career page via ${payload.faangSource}. These are public first-party postings that companies also distribute to LinkedIn.`,
      eligibilityReason: 'First-party career page posting, likely cross-posted to LinkedIn',
    };
  }

  // Jobs with explicit LinkedIn source (from JSearch aggregation)
  if (source === 'LINKEDIN') {
    return {
      class: 'LICENSED_PROVIDER',
      platform: 'linkedin_via_jsearch',
      method: 'api_aggregator',
      licenseBasis: 'RapidAPI/JSearch commercial license — indexes Google Jobs which includes LinkedIn listings',
      confidence: 75,
      notes: 'Job tagged as LinkedIn source by JSearch aggregator. JSearch indexes Google Jobs, which in turn indexes public LinkedIn job postings. No direct LinkedIn API access used.',
      eligibilityReason: 'Tagged as LinkedIn source by licensed aggregator (JSearch)',
    };
  }

  // Jobs from JSearch that have LinkedIn URLs
  if (source === 'JSEARCH') {
    const hasLinkedInUrl = (job.sourceUrl || '').includes('linkedin.com') ||
                           (job.applyUrl || '').includes('linkedin.com');
    if (hasLinkedInUrl) {
      return {
        class: 'LICENSED_PROVIDER',
        platform: 'linkedin_via_jsearch',
        method: 'api_aggregator',
        licenseBasis: 'RapidAPI/JSearch commercial license — aggregates from multiple boards including LinkedIn',
        confidence: 80,
        notes: 'Job sourced via JSearch with LinkedIn URL. JSearch is a licensed aggregator.',
        eligibilityReason: 'LinkedIn URL detected in JSearch-aggregated listing',
      };
    }
  }

  // Jobs from other board sources with LinkedIn URLs
  const hasLinkedInUrl = (job.sourceUrl || '').includes('linkedin.com') ||
                         (job.applyUrl || '').includes('linkedin.com');
  if (hasLinkedInUrl) {
    return {
      class: 'LICENSED_PROVIDER',
      platform: `linkedin_via_${source.toLowerCase()}`,
      method: 'api_aggregator',
      licenseBasis: `${source} provider — LinkedIn URL present in listing`,
      confidence: 65,
      notes: `Job sourced via ${source} with LinkedIn URL. Cross-posted listing.`,
      eligibilityReason: 'LinkedIn URL detected in cross-posted listing',
    };
  }

  // Default: generic LinkedIn association
  return {
    class: 'LICENSED_PROVIDER',
    platform: source.toLowerCase(),
    method: 'api_aggregator',
    licenseBasis: `${source} aggregator`,
    confidence: 50,
    notes: `Job from ${source} with potential LinkedIn relevance. Low confidence association.`,
    eligibilityReason: 'Source aggregator may index LinkedIn listings',
  };
}

/**
 * Compute vendor intelligence for a job.
 * Uses the existing vendor database for real signals — no hardcoded claims.
 */
function computeVendorIntelligence(
  job: any,
  vendorByDomain: Map<string, any>,
  vendorByName: Map<string, any>,
): {
  vendorQualityTier: string;
  vendorConfidenceScore: number;
  primeVendorLikelihood: number;
  directVendorLikelihood: number;
  staffingVendorLikelihood: number;
  historicalSignalCount: number;
  recruiterContactStrength: number;
  vendorReasonCodes: string[];
  matchedVendorId: string | null;
} {
  const reasons: string[] = [];
  let matchedVendor: any = null;
  let matchedVendorId: string | null = job.matchedVendorId || null;

  // Try to match vendor by domain, then by company name
  if (job.companyDomain) {
    matchedVendor = vendorByDomain.get(job.companyDomain.toLowerCase());
  }
  if (!matchedVendor && job.company) {
    matchedVendor = vendorByName.get(job.company.toLowerCase());
  }

  if (matchedVendor) {
    matchedVendorId = matchedVendor.id;
    const tier = matchedVendor.tier || 'UNCLASSIFIED';
    const trust = matchedVendor.trustScore || 0;
    const placements = matchedVendor.placementCount || 0;
    const responseRate = matchedVendor.responseRate || 0;
    const interviewRate = matchedVendor.interviewGrantRate || 0;

    reasons.push(`VENDOR_MATCH_${tier}`);
    if (placements > 0) reasons.push('HAS_PLACEMENTS');
    if (responseRate > 0.3) reasons.push('HIGH_RESPONSE_RATE');
    if (interviewRate > 0.2) reasons.push('GRANTS_INTERVIEWS');

    const primeL = tier === 'PRIME' ? 90 : tier === 'DIRECT' ? 30 : 10;
    const directL = tier === 'DIRECT' ? 85 : tier === 'PRIME' ? 40 : tier === 'SUB' ? 25 : 10;
    const staffingL = tier === 'SUB' ? 80 : tier === 'BROKER' ? 70 : 30;

    return {
      vendorQualityTier: tier === 'PRIME' ? 'prime_like' :
                         tier === 'DIRECT' ? 'direct_like' :
                         tier === 'SUB' ? 'reputable_staffing' :
                         tier === 'BROKER' ? 'generic' : 'low_confidence',
      vendorConfidenceScore: Math.min(100, trust + 10),
      primeVendorLikelihood: primeL,
      directVendorLikelihood: directL,
      staffingVendorLikelihood: staffingL,
      historicalSignalCount: placements + Math.round(responseRate * 100),
      recruiterContactStrength: computeContactStrength(job),
      vendorReasonCodes: reasons,
      matchedVendorId,
    };
  }

  // No vendor match — use conservative heuristics
  const companyLower = (job.company || '').toLowerCase();
  const isStaffingLike = /staffing|consulting|solutions|technologies|infotech|tek|systems|talent|workforce/i.test(companyLower);
  const isPrimeLike = /accenture|deloitte|cognizant|infosys|wipro|tcs |capgemini|hcl|tech mahindra|ibm |kpmg|ey |pwc/i.test(companyLower);

  if (isPrimeLike) reasons.push('NAME_HEURISTIC_PRIME');
  else if (isStaffingLike) reasons.push('NAME_HEURISTIC_STAFFING');
  else reasons.push('NO_VENDOR_MATCH');

  return {
    vendorQualityTier: isPrimeLike ? 'prime_like' : isStaffingLike ? 'reputable_staffing' : 'low_confidence',
    vendorConfidenceScore: isPrimeLike ? 40 : isStaffingLike ? 30 : 10,
    primeVendorLikelihood: isPrimeLike ? 55 : 5,
    directVendorLikelihood: isPrimeLike ? 20 : isStaffingLike ? 15 : 5,
    staffingVendorLikelihood: isStaffingLike ? 60 : isPrimeLike ? 30 : 10,
    historicalSignalCount: 0,
    recruiterContactStrength: computeContactStrength(job),
    vendorReasonCodes: reasons,
    matchedVendorId,
  };
}

function computeContactStrength(job: any): number {
  let score = 0;
  if (job.recruiterEmail) score += 40;
  if (job.recruiterName) score += 25;
  if (job.recruiterPhone) score += 20;
  if (job.recruiterLinkedIn) score += 15;
  return Math.min(100, score);
}

/**
 * Tag email-intel jobs that reference LinkedIn.
 * These are vendor requirement emails where the job posting URL
 * or vendor contact includes LinkedIn references.
 */
async function tagEmailIntelLinkedInJobs(
  prisma: PrismaClient,
  runId: string,
): Promise<number> {
  // Find VendorReqSignals that mention LinkedIn
  const emailJobs = await prisma.$queryRaw`
    SELECT mj.id::text as id, mj."rawPayload"
    FROM "MarketJob" mj
    WHERE mj.status = 'ACTIVE'
      AND mj.source::text != 'LINKEDIN'
      AND mj."sourceUrl" NOT ILIKE '%linkedin.com%'
      AND mj."applyUrl" NOT ILIKE '%linkedin.com%'
      AND (
        mj."recruiterLinkedIn" IS NOT NULL
        OR mj.description ILIKE '%linkedin.com/jobs%'
      )
    LIMIT 100
  ` as any[];

  let tagged = 0;
  for (const job of emailJobs) {
    try {
      const existingPayload = typeof job.rawPayload === 'string'
        ? JSON.parse(job.rawPayload)
        : (job.rawPayload || {});

      if (existingPayload?.linkedInCompliance) continue; // already tagged

      const compliance = buildComplianceMetadata('EMAIL_INTEL_DERIVED', {
        sourcePlatform: 'email_intel',
        sourceIngestionMethod: 'email_extraction',
        sourceDomain: null,
        sourceLicenseBasis: 'Vendor requirement email processed by system — LinkedIn reference detected',
        sourceConfidence: 45,
        complianceNotes: 'Job derived from vendor email that references LinkedIn. Low-confidence LinkedIn association.',
        eligibilityReason: 'LinkedIn reference in recruiter contact or job description',
        runId,
      });

      await prisma.marketJob.update({
        where: { id: job.id },
        data: {
          rawPayload: { ...existingPayload, linkedInCompliance: compliance },
        },
      });
      tagged++;
    } catch {
      // Skip individual errors
    }
  }

  return tagged;
}

/**
 * Log an audit record for each enrichment run.
 * Uses rawPayload on a system MarketJob record for now.
 * In production, this should be a dedicated IngestionAudit table.
 */
async function logIngestionAudit(
  prisma: PrismaClient,
  audit: {
    runId: string;
    source: string;
    recordsImported: number;
    recordsRejected: number;
    rejectionReasons: string[];
    complianceClass: string;
    operatorIdentity: string;
    durationMs: number;
  },
): Promise<void> {
  // Log to console (structured) for operational visibility
  console.log('[LinkedInEnrich] Audit:', JSON.stringify(audit));

  // Persist audit to database — store as a system record in rawPayload
  // A dedicated IngestionAuditLog table would be cleaner, but this avoids
  // a schema migration and keeps the system operational immediately.
  try {
    await prisma.$executeRaw`
      INSERT INTO "MarketJob" (
        id, "externalId", source, title, company, description,
        status, "rawPayload", "discoveredAt", "lastSeenAt"
      ) VALUES (
        ${`audit-${audit.runId}`},
        ${`audit-${audit.runId}`},
        'OTHER',
        ${`[AUDIT] LinkedIn Enrichment Run`},
        '[SYSTEM]',
        ${`Enrichment run: ${audit.recordsImported} tagged, ${audit.recordsRejected} errors, ${audit.durationMs}ms`},
        'EXPIRED',
        ${JSON.stringify(audit)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (source, "externalId") DO UPDATE SET
        "rawPayload" = ${JSON.stringify(audit)}::jsonb,
        "lastSeenAt" = NOW()
    `;
  } catch (err) {
    console.error('[LinkedInEnrich] Failed to write audit record:', err);
  }
}

function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
