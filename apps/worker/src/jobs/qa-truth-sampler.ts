import type { PrismaClient } from '@prisma/client';

const SAMPLE_SIZE = 20;

const SPAM_PATTERNS = [
  /URGENT\s+HIRING/i,
  /IMMEDIATE\s+HIRE/i,
  /HIRING\s+NOW/i,
  /WORK\s+FROM\s+HOME\s+EARN/i,
  /EASY\s+MONEY/i,
  /QUICK\s+CASH/i,
];

const BOGUS_COMPANY_PATTERNS = [/^unknown$/i, /^confidential$/i];

const HARVEST_APPLY_PATTERNS = [
  /^mailto:/i,
  /apply\.generic/i,
  /redirect\.to/i,
];

async function quickUrlCheck(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

type Verdict =
  | 'PASS'
  | 'FAIL'
  | 'STALE'
  | 'DUPLICATE'
  | 'BOGUS'
  | 'HARVEST';

export async function handleQaTruthSampler(
  prisma: PrismaClient,
  _data: Record<string, unknown>,
): Promise<void> {
  const total = await prisma.marketJob.count({
    where: { status: 'ACTIVE' },
  });

  if (total === 0) {
    console.log('QA Sampler: No ACTIVE market jobs to sample.');
    return;
  }

  const ids = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "MarketJob"
    WHERE status = 'ACTIVE'
    ORDER BY RANDOM()
    LIMIT ${SAMPLE_SIZE}
  `;

  const jobs = await prisma.marketJob.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    include: { canonical: true },
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const verdictCounts: Record<Verdict, number> = {
    PASS: 0,
    FAIL: 0,
    STALE: 0,
    DUPLICATE: 0,
    BOGUS: 0,
    HARVEST: 0,
  };

  for (const job of jobs) {
    const urlAlive =
      job.applyUrl != null
        ? await quickUrlCheck(job.applyUrl)
        : null;

    const typeCorrect = (() => {
      if (job.employmentType === 'UNKNOWN' || (job.classificationConfidence ?? 0) <= 0.5) {
        return false;
      }
      const signals = job.negativeSignals as string[] | undefined;
      if (Array.isArray(signals) && signals.length > 0) {
        const contradict = signals.some(
          (s) =>
            typeof s === 'string' &&
            /employment|type|contradict|mismatch/i.test(s),
        );
        if (contradict) return false;
      }
      return true;
    })();

    const isDuplicate =
      job.canonical != null && job.canonical.jobCount > 1;

    const isBogus = (() => {
      const companyLower = (job.company ?? '').trim().toLowerCase();
      if (BOGUS_COMPANY_PATTERNS.some((p) => p.test(companyLower))) {
        return true;
      }
      if ((job.description ?? '').length < 50) {
        return true;
      }
      if (SPAM_PATTERNS.some((p) => p.test(job.title ?? ''))) {
        return true;
      }
      return false;
    })();

    const hasContact =
      (job.recruiterEmail != null && job.recruiterEmail.length > 0) ||
      (job.recruiterPhone != null && job.recruiterPhone.length > 0);

    const posted =
      job.sourcePostedAt ?? job.postedAt ?? job.discoveredAt;
    const freshnessOk =
      posted >= sevenDaysAgo || job.lastSeenAt >= threeDaysAgo;

    const isHarvest = (() => {
      const noLocation =
        job.location == null || String(job.location).trim().length === 0;
      const genericCompany = BOGUS_COMPANY_PATTERNS.some((p) =>
        p.test((job.company ?? '').trim()),
      );
      const weirdApplyUrl =
        job.applyUrl != null &&
        HARVEST_APPLY_PATTERNS.some((p) => p.test(job.applyUrl!));
      const tooGeneric =
        (job.title ?? '').length < 10 ||
        (job.description ?? '').length < 100;
      return noLocation && (genericCompany || weirdApplyUrl) && tooGeneric;
    })();

    let verdict: Verdict = 'PASS';
    if (isBogus) verdict = 'BOGUS';
    else if (urlAlive === false) verdict = 'FAIL';
    else if (isHarvest) verdict = 'HARVEST';
    else if (!freshnessOk) verdict = 'STALE';
    else if (isDuplicate) verdict = 'DUPLICATE';
    else if (
      urlAlive &&
      typeCorrect &&
      !isDuplicate &&
      !isBogus &&
      freshnessOk
    ) {
      verdict = 'PASS';
    }

    verdictCounts[verdict]++;

    await prisma.qaSample.create({
      data: {
        marketJobId: job.id,
        urlAlive,
        typeCorrect,
        isDuplicate,
        isBogus,
        hasContact,
        freshnessOk,
        verdict,
        realnessScore: job.realnessScore ?? undefined,
        actionabilityScore: job.actionabilityScore ?? undefined,
      },
    });
  }

  const parts = [
    verdictCounts.PASS && `${verdictCounts.PASS} PASS`,
    verdictCounts.STALE && `${verdictCounts.STALE} STALE`,
    verdictCounts.FAIL && `${verdictCounts.FAIL} FAIL`,
    verdictCounts.BOGUS && `${verdictCounts.BOGUS} BOGUS`,
    verdictCounts.DUPLICATE && `${verdictCounts.DUPLICATE} DUPLICATE`,
    verdictCounts.HARVEST && `${verdictCounts.HARVEST} HARVEST`,
  ]
    .filter(Boolean)
    .join(', ');

  console.log(
    `QA Sampler: ${jobs.length} sampled — ${parts}`,
  );
}
