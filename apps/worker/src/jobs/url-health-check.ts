import type { PrismaClient } from '@prisma/client';

const BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

const CLOSED_PAGE_PATTERNS = [
  /job.*(?:no longer|has been|is no longer)\s+available/i,
  /this.*(?:position|job|listing).*(?:has been|is)\s+(?:closed|filled|removed)/i,
  /page\s+not\s+found/i,
  /404/,
  /expired/i,
  /we.*couldn't\s+find/i,
];

/**
 * Checks apply URLs for active market jobs.
 * HEAD request first (fast), falls back to GET if needed.
 * Marks jobs as DEAD if 404, REDIRECT if suspicious redirect, ALIVE if OK.
 */
export async function handleUrlHealthCheck(
  prisma: PrismaClient,
  _data: Record<string, unknown>,
): Promise<void> {
  const startTime = Date.now();
  console.log('[UrlHealthCheck] Starting URL verification...');

  const jobs = await prisma.marketJob.findMany({
    where: {
      status: 'ACTIVE',
      applyUrl: { not: null },
      OR: [
        { urlVerifiedAt: null },
        {
          urlVerifiedAt: {
            lt: new Date(Date.now() - 12 * 60 * 60 * 1000), // Re-check every 12h
          },
        },
      ],
    },
    select: { id: true, applyUrl: true },
    take: BATCH_SIZE,
    orderBy: { urlVerifiedAt: { sort: 'asc', nulls: 'first' } },
  });

  if (jobs.length === 0) {
    console.log('[UrlHealthCheck] No URLs to check.');
    return;
  }

  console.log(`[UrlHealthCheck] Checking ${jobs.length} URLs...`);

  let alive = 0;
  let dead = 0;
  let redirect = 0;
  let errors = 0;

  for (const job of jobs) {
    if (!job.applyUrl) continue;

    try {
      const result = await checkUrl(job.applyUrl);

      await prisma.marketJob.update({
        where: { id: job.id },
        data: {
          urlStatus: result.status,
          urlVerifiedAt: new Date(),
          ...(result.status === 'DEAD' ? { status: 'EXPIRED' } : {}),
        },
      });

      if (result.status === 'ALIVE') alive++;
      else if (result.status === 'DEAD') dead++;
      else if (result.status === 'REDIRECT') redirect++;

      // Small delay between requests to be respectful
      await sleep(200);
    } catch {
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[UrlHealthCheck] Complete in ${elapsed}s — alive: ${alive}, dead: ${dead}, redirect: ${redirect}, errors: ${errors}`);
}

async function checkUrl(url: string): Promise<{ status: 'ALIVE' | 'DEAD' | 'REDIRECT' }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Try HEAD first
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'manual',
    });

    clearTimeout(timeout);

    if (headRes.status >= 200 && headRes.status < 300) {
      return { status: 'ALIVE' };
    }

    if (headRes.status >= 300 && headRes.status < 400) {
      const location = headRes.headers.get('location') ?? '';
      // Check if redirect goes to a "job closed" type page
      if (isClosedRedirect(location)) {
        return { status: 'DEAD' };
      }
      return { status: 'REDIRECT' };
    }

    if (headRes.status === 404 || headRes.status === 410) {
      return { status: 'DEAD' };
    }

    // For other status codes (403, 405, etc), try GET
    return await checkWithGet(url);
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'DEAD' };
    }
    // Network error — try GET as fallback
    return await checkWithGet(url);
  }
}

async function checkWithGet(url: string): Promise<{ status: 'ALIVE' | 'DEAD' | 'REDIRECT' }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let redirectCount = 0;
    let currentUrl = url;

    const response = await fetch(currentUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StaffingOS/1.0; +https://staffingos.com)',
      },
    });

    clearTimeout(timeout);

    if (response.status === 404 || response.status === 410) {
      return { status: 'DEAD' };
    }

    if (response.ok) {
      // Check body for "job closed" patterns
      const text = await response.text().then((t) => t.slice(0, 5000));
      if (CLOSED_PAGE_PATTERNS.some((p) => p.test(text))) {
        return { status: 'DEAD' };
      }
      return { status: 'ALIVE' };
    }

    return { status: 'REDIRECT' };
  } catch {
    clearTimeout(timeout);
    return { status: 'DEAD' };
  }
}

function isClosedRedirect(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower.includes('expired') ||
    lower.includes('closed') ||
    lower.includes('not-found') ||
    lower.includes('404') ||
    lower.includes('/jobs') && !lower.includes('/job/')
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
