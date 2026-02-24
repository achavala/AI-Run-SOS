import type { PrismaClient } from '@prisma/client';

export interface SpendCheckResult {
  allowed: boolean;
  requestsRemaining: number;
  newJobsRemaining: number;
  reason?: string;
}

/**
 * Check if a provider is within its spend budget for today.
 * Creates the SpendGuard row for today if it doesn't exist.
 */
export async function checkSpendBudget(
  prisma: PrismaClient,
  provider: string,
): Promise<SpendCheckResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Upsert today's record
  const guard = await prisma.spendGuard.upsert({
    where: { provider_date: { provider: provider as any, date: today } },
    create: {
      provider: provider as any,
      date: today,
      requestsMade: 0,
      newJobsIngested: 0,
      maxRequestsDay: getDefaultMaxRequests(provider),
      maxNewJobsDay: getDefaultMaxNewJobs(provider),
    },
    update: {},
  });

  const requestsRemaining = guard.maxRequestsDay - guard.requestsMade;
  const newJobsRemaining = guard.maxNewJobsDay - guard.newJobsIngested;

  if (requestsRemaining <= 0) {
    return { allowed: false, requestsRemaining: 0, newJobsRemaining, reason: `Daily request cap reached (${guard.maxRequestsDay})` };
  }
  if (newJobsRemaining <= 0) {
    return { allowed: false, requestsRemaining, newJobsRemaining: 0, reason: `Daily new jobs cap reached (${guard.maxNewJobsDay})` };
  }

  return { allowed: true, requestsRemaining, newJobsRemaining };
}

/**
 * Record usage after a sync run completes.
 * Fires an alert if thresholds are exceeded.
 */
export async function recordSpend(
  prisma: PrismaClient,
  provider: string,
  requestsMade: number,
  newJobsIngested: number,
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const guard = await prisma.spendGuard.upsert({
    where: { provider_date: { provider: provider as any, date: today } },
    create: {
      provider: provider as any,
      date: today,
      requestsMade,
      newJobsIngested,
      maxRequestsDay: getDefaultMaxRequests(provider),
      maxNewJobsDay: getDefaultMaxNewJobs(provider),
    },
    update: {
      requestsMade: { increment: requestsMade },
      newJobsIngested: { increment: newJobsIngested },
    },
  });

  // Check if we should fire an alert (80% threshold)
  const updatedGuard = await prisma.spendGuard.findUnique({
    where: { provider_date: { provider: provider as any, date: today } },
  });

  if (updatedGuard && !updatedGuard.alertFired) {
    const requestPct = updatedGuard.requestsMade / updatedGuard.maxRequestsDay;
    const jobPct = updatedGuard.newJobsIngested / updatedGuard.maxNewJobsDay;

    if (requestPct >= 0.8 || jobPct >= 0.8) {
      const msg = `[SpendGuard] ${provider} at ${Math.round(Math.max(requestPct, jobPct) * 100)}% daily budget — requests: ${updatedGuard.requestsMade}/${updatedGuard.maxRequestsDay}, jobs: ${updatedGuard.newJobsIngested}/${updatedGuard.maxNewJobsDay}`;
      console.warn(msg);
      await prisma.spendGuard.update({
        where: { id: updatedGuard.id },
        data: { alertFired: true, alertMessage: msg },
      });
    }
  }
}

/**
 * Check weekly spend across all days for a provider.
 * Returns false if weekly cap exceeded.
 */
export async function checkWeeklyBudget(
  prisma: PrismaClient,
  provider: string,
): Promise<{ allowed: boolean; weeklyRequests: number; weeklyMax: number }> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const weeklyData = await prisma.spendGuard.aggregate({
    where: { provider: provider as any, date: { gte: weekAgo } },
    _sum: { requestsMade: true },
  });

  const weeklyRequests = weeklyData._sum.requestsMade ?? 0;
  const weeklyMax = getDefaultMaxRequests(provider) * 7;

  return {
    allowed: weeklyRequests < weeklyMax,
    weeklyRequests,
    weeklyMax,
  };
}

function getDefaultMaxRequests(provider: string): number {
  switch (provider) {
    case 'JSEARCH': return 1600; // $75 Ultra plan = 50K/mo ≈ 1,666/day
    case 'ADZUNA': return 80;
    case 'JOOBLE': return 100;
    case 'CAREERJET': return 100;
    case 'ARBEITNOW': return 200;
    default: return 50;
  }
}

function getDefaultMaxNewJobs(provider: string): number {
  switch (provider) {
    case 'JSEARCH': return 500;
    case 'ADZUNA': return 400;
    case 'JOOBLE': return 600;
    case 'CAREERJET': return 600;
    case 'ARBEITNOW': return 300;
    default: return 500;
  }
}
