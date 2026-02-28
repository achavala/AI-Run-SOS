import type { PrismaClient } from '@prisma/client';
import type { JobProvider, RawMarketJob } from './types';
import {
  classifyEmploymentType,
  extractRate,
  extractSkills,
  computeFingerprint,
} from './classifier';
import { computeRealnessScore } from './realness';
import { computeActionabilityScore } from './actionability';
import { matchToVendor } from './vendor-match';
import { checkSpendBudget, recordSpend, checkWeeklyBudget } from './spend-guard';
import { JSearchProvider } from './providers/jsearch';
import { JoobleProvider } from './providers/jooble';
import { AdzunaProvider } from './providers/adzuna';
import { ArbeitnowProvider } from './providers/arbeitnow';
import { CareerjetProvider } from './providers/careerjet';
import { CorpToCorpProvider } from './providers/corptocorp';
import { FaangTechProvider } from './providers/faang-tech';

/** Default queries when no QueryPlan rows exist for a provider */
const DEFAULT_QUERIES = [
  'C2C software engineer',
  'W2 contract developer',
  'Corp to Corp IT',
  'contract Java developer',
  'contract Python developer',
  'contract DevOps engineer',
  'contract cloud architect AWS',
  'contract data engineer',
  'contract cybersecurity analyst',
  'C2C React developer',
  'W2 .NET developer',
  '1099 IT consultant',
];

const STALE_DAYS = 14;

export async function handleMarketJobSync(
  prisma: PrismaClient,
  _data: Record<string, unknown>,
): Promise<void> {
  const startTime = Date.now();
  console.log('[MarketSync] Starting job sync...');

  const providers: JobProvider[] = [
    new FaangTechProvider(),
    new CorpToCorpProvider(),
    new JSearchProvider(),
    new JoobleProvider(),
    new AdzunaProvider(),
    new ArbeitnowProvider(),
    new CareerjetProvider(),
  ];

  const activeProviders = providers.filter((p) => {
    const configured = p.isConfigured();
    if (!configured) console.log(`[MarketSync] Skipping ${p.name} (not configured)`);
    return configured;
  });

  if (activeProviders.length === 0) {
    console.warn('[MarketSync] No providers configured. Set at least one API key.');
    return;
  }

  console.log(`[MarketSync] Active providers: ${activeProviders.map((p) => p.name).join(', ')}`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalDeduped = 0;

  for (const provider of activeProviders) {
    try {
      // Spend guard: check daily + weekly budgets
      const spendCheck = await checkSpendBudget(prisma, provider.source);
      if (!spendCheck.allowed) {
        console.log(`[MarketSync] ${provider.name} spend guard blocked: ${spendCheck.reason}`);
        continue;
      }
      const weeklyCheck = await checkWeeklyBudget(prisma, provider.source);
      if (!weeklyCheck.allowed) {
        console.log(`[MarketSync] ${provider.name} weekly budget exhausted (${weeklyCheck.weeklyRequests}/${weeklyCheck.weeklyMax})`);
        continue;
      }

      // Get queries from QueryPlan (or fall back to defaults)
      const { queries, budget } = await getQueryPlan(prisma, provider);

      if (budget.remaining <= 0) {
        console.log(`[MarketSync] ${provider.name} budget exhausted (${budget.usedToday}/${budget.maxPerDay} today)`);
        continue;
      }

      console.log(`[MarketSync] ${provider.name}: ${queries.length} queries, budget ${budget.remaining} remaining`);

      const rawJobs = await provider.fetchJobs(queries);
      totalFetched += rawJobs.length;
      console.log(`[MarketSync] ${provider.name} returned ${rawJobs.length} jobs`);

      // Track budget usage (both query plan + spend guard)
      await trackBudgetUsage(prisma, provider.source, queries.length);

      const result = await upsertJobs(prisma, rawJobs);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      totalDeduped += result.deduped;

      // Record spend for the guard
      await recordSpend(prisma, provider.source, queries.length, result.inserted);
    } catch (err) {
      console.error(`[MarketSync] Provider ${provider.name} failed:`, err);
    }
  }

  // Mark jobs not seen in STALE_DAYS as STALE (not hard delete)
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_DAYS);

  const { count: staleCount } = await prisma.marketJob.updateMany({
    where: {
      status: 'ACTIVE',
      lastSeenAt: { lt: staleThreshold },
      expiresAt: null, // Don't stale jobs with explicit expiry
    },
    data: { status: 'STALE' },
  });

  // Mark jobs past their explicit expiry as EXPIRED
  const { count: expiredCount } = await prisma.marketJob.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[MarketSync] Complete in ${elapsed}s`);
  console.log(`  Fetched: ${totalFetched}`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Cross-provider deduped: ${totalDeduped}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log(`  Marked stale: ${staleCount}`);
  console.log(`  Marked expired: ${expiredCount}`);
}

// ── QueryPlan integration ──────────────────────────────────────────

interface QueryBudget {
  usedToday: number;
  maxPerDay: number;
  remaining: number;
}

async function getQueryPlan(
  prisma: PrismaClient,
  provider: JobProvider,
): Promise<{ queries: string[]; budget: QueryBudget }> {
  const source = provider.source as any;
  const plans = await prisma.marketQueryPlan.findMany({
    where: { provider: source, isEnabled: true },
    orderBy: { priority: 'desc' },
  });

  if (plans.length === 0) {
    return {
      queries: DEFAULT_QUERIES,
      budget: { usedToday: 0, maxPerDay: 100, remaining: 100 },
    };
  }

  // Reset daily counters if needed
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const plan of plans) {
    if (!plan.lastResetDate || plan.lastResetDate < today) {
      await prisma.marketQueryPlan.update({
        where: { id: plan.id },
        data: { callsToday: 0, lastResetDate: today },
      });
      plan.callsToday = 0;
    }
  }

  // Reset monthly counters on the 1st
  if (today.getDate() === 1) {
    for (const plan of plans) {
      await prisma.marketQueryPlan.update({
        where: { id: plan.id },
        data: { callsThisMonth: 0 },
      });
    }
  }

  const totalUsedToday = plans.reduce((s, p) => s + p.callsToday, 0);
  const totalMaxPerDay = plans.reduce((s, p) => s + p.maxCallsPerDay, 0);
  const remaining = Math.max(0, totalMaxPerDay - totalUsedToday);

  const currentHour = new Date().getUTCHours();

  const eligibleQueries = plans
    .filter((p) => {
      if (p.callsToday >= p.maxCallsPerDay) return false;
      if (p.callsThisMonth >= p.maxCallsPerMonth) return false;
      // If hourSlots defined, only run in matching hours
      if (p.hourSlots.length > 0 && !p.hourSlots.includes(currentHour)) return false;
      return true;
    })
    .map((p) => p.query);

  return {
    queries: eligibleQueries.length > 0 ? eligibleQueries : DEFAULT_QUERIES.slice(0, 3),
    budget: { usedToday: totalUsedToday, maxPerDay: totalMaxPerDay, remaining },
  };
}

async function trackBudgetUsage(
  prisma: PrismaClient,
  source: string,
  callCount: number,
): Promise<void> {
  try {
    await prisma.marketQueryPlan.updateMany({
      where: { provider: source as any, isEnabled: true },
      data: {
        callsToday: { increment: callCount },
        callsThisMonth: { increment: callCount },
        lastRunAt: new Date(),
      },
    });
  } catch {
    // No plans exist for this provider — that's fine
  }
}

// ── Upsert with cross-provider dedupe ──────────────────────────────

async function upsertJobs(
  prisma: PrismaClient,
  rawJobs: RawMarketJob[],
): Promise<{ inserted: number; updated: number; skipped: number; deduped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let deduped = 0;

  for (const raw of rawJobs) {
    try {
      if (!raw.title || !raw.company) {
        skipped++;
        continue;
      }

      const classification = classifyEmploymentType(raw.title + ' ' + raw.description);
      const rateInfo = extractRate(raw.description);
      const skills = extractSkills(raw.title, raw.description);
      const fingerprint = computeFingerprint(
        raw.title,
        raw.company,
        raw.location,
        raw.applyUrl,
        raw.description,
      );

      const source = raw.source as 'JSEARCH' | 'JOOBLE' | 'ADZUNA' | 'ARBEITNOW' | 'DICE' | 'LINKEDIN' | 'INDEED' | 'ZIPRECRUITER' | 'OTHER';
      const locationType = raw.locationType ?? 'ONSITE';

      // Check same-provider duplicate
      const existing = await prisma.marketJob.findUnique({
        where: { source_externalId: { source, externalId: raw.externalId } },
        select: { id: true },
      });

      // Resolve canonical (cross-provider dedupe)
      let canonicalId: string | undefined;
      const existingCanonical = await prisma.marketJobCanonical.findUnique({
        where: { fingerprint },
      });

      if (existingCanonical) {
        canonicalId = existingCanonical.id;
        // Update canonical's lastSeenAt and count
        await prisma.marketJobCanonical.update({
          where: { id: existingCanonical.id },
          data: {
            lastSeenAt: new Date(),
            jobCount: { increment: existing ? 0 : 1 },
          },
        });
        if (!existing) deduped++;
      } else {
        const newCanonical = await prisma.marketJobCanonical.create({
          data: {
            fingerprint,
            bestTitle: raw.title,
            bestCompany: raw.company,
            bestLocation: raw.location,
          },
        });
        canonicalId = newCanonical.id;
      }

      const hourlyRateMin = rateInfo.hourlyMin ?? (raw.salaryMin && raw.rateType === 'HOURLY' ? raw.salaryMin : undefined);
      const hourlyRateMax = rateInfo.hourlyMax ?? (raw.salaryMax && raw.rateType === 'HOURLY' ? raw.salaryMax : undefined);

      // Vendor/company domain matching
      const vendorMatch = await matchToVendor(prisma, raw.company, raw.applyUrl, raw.recruiterEmail);

      const realness = computeRealnessScore({
        title: raw.title,
        company: raw.company,
        description: raw.description,
        location: raw.location,
        employmentType: classification.type,
        negativeSignals: classification.negativeSignals,
        recruiterEmail: raw.recruiterEmail,
        recruiterName: raw.recruiterName,
        recruiterPhone: raw.recruiterPhone,
        hourlyRateMin,
        hourlyRateMax,
        rateText: rateInfo.rateText,
        sourcePostedAt: raw.sourcePostedAt,
        postedAt: raw.postedAt,
        applyUrl: raw.applyUrl,
        urlStatus: null,
        classificationConfidence: classification.confidence,
      });

      const actionability = computeActionabilityScore({
        title: raw.title,
        company: raw.company,
        description: raw.description,
        location: raw.location,
        employmentType: classification.type,
        negativeSignals: classification.negativeSignals,
        recruiterEmail: raw.recruiterEmail,
        recruiterName: raw.recruiterName,
        hourlyRateMin,
        hourlyRateMax,
        rateText: rateInfo.rateText,
        applyUrl: raw.applyUrl,
        urlStatus: null,
        matchedVendorId: vendorMatch.matchedVendorId,
        classificationConfidence: classification.confidence,
        companyDomain: vendorMatch.companyDomain,
        realnessScore: realness.score,
      });

      const jobData = {
        title: raw.title,
        company: raw.company,
        description: raw.description,
        location: raw.location,
        locationType,
        employmentType: classification.type,
        classificationConfidence: classification.confidence,
        negativeSignals: classification.negativeSignals,
        rateText: rateInfo.rateText,
        rateMin: raw.salaryMin ?? rateInfo.min,
        rateMax: raw.salaryMax ?? rateInfo.max,
        compPeriod: rateInfo.compPeriod as any,
        hourlyRateMin,
        hourlyRateMax,
        skills,
        applyUrl: raw.applyUrl,
        sourceUrl: raw.sourceUrl,
        recruiterName: raw.recruiterName,
        recruiterEmail: raw.recruiterEmail,
        recruiterPhone: raw.recruiterPhone,
        fingerprint,
        canonicalId,
        postedAt: raw.postedAt,
        sourcePostedAt: raw.sourcePostedAt,
        expiresAt: raw.expiresAt,
        lastSeenAt: new Date(),
        status: 'ACTIVE' as const,
        realnessScore: realness.score,
        realnessReasons: realness.reasons,
        actionabilityScore: actionability.score,
        actionabilityReasons: actionability.reasons,
        matchedVendorId: vendorMatch.matchedVendorId,
        companyDomain: vendorMatch.companyDomain,
      };

      if (existing) {
        await prisma.marketJob.update({
          where: { id: existing.id },
          data: jobData,
        });
        updated++;
      } else {
        await prisma.marketJob.create({
          data: {
            externalId: raw.externalId,
            source,
            rawPayload: raw.rawPayload ? JSON.parse(JSON.stringify(raw.rawPayload)) : undefined,
            ...jobData,
          },
        });
        inserted++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Unique constraint')) {
        skipped++;
      } else {
        console.error(`[MarketSync] Failed to upsert job "${raw.title}":`, message);
        skipped++;
      }
    }
  }

  return { inserted, updated, skipped, deduped };
}
