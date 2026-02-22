import type PgBoss from "pg-boss";
import type { PrismaClient } from "@prisma/client";
import { handleDailyScoreboard } from "./daily-scoreboard";
import { handleMarginCheck } from "./margin-check";
import { handleTrustScoreUpdate } from "./trust-score-update";
import { handleFollowupCheck } from "./followup-check";
import { handleReqFreshness } from "./req-freshness";
import { handleMarketJobSync } from "./market-sync";
import { handleUrlHealthCheck } from "./url-health-check";
import { handleQaTruthSampler } from "./qa-truth-sampler";
import { handleVendorEmailSync } from "./vendor-email-sync";

export const JOB_NAMES = {
  DAILY_SCOREBOARD: "daily-scoreboard",
  MARGIN_CHECK: "margin-check",
  TRUST_SCORE_UPDATE: "trust-score-update",
  FOLLOWUP_CHECK: "followup-check",
  REQ_FRESHNESS: "req-freshness",
  MARKET_JOB_SYNC: "market-job-sync",
  URL_HEALTH_CHECK: "url-health-check",
  QA_TRUTH_SAMPLER: "qa-truth-sampler",
  VENDOR_EMAIL_SYNC: "vendor-email-sync",
} as const;

export async function registerJobHandlers(
  boss: PgBoss,
  prisma: PrismaClient
): Promise<void> {
  boss.work(JOB_NAMES.DAILY_SCOREBOARD, async (jobs) => {
    for (const job of jobs) {
      await handleDailyScoreboard(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.MARGIN_CHECK, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { rateCardId: string };
      await handleMarginCheck(prisma, data);
    }
  });

  boss.work(JOB_NAMES.TRUST_SCORE_UPDATE, { batchSize: 5 }, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as { entityType: string; entityId: string };
      await handleTrustScoreUpdate(prisma, data);
    }
  });

  boss.work(JOB_NAMES.FOLLOWUP_CHECK, async (jobs) => {
    for (const job of jobs) {
      await handleFollowupCheck(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.REQ_FRESHNESS, async (jobs) => {
    for (const job of jobs) {
      await handleReqFreshness(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.MARKET_JOB_SYNC, async (jobs) => {
    for (const job of jobs) {
      await handleMarketJobSync(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.URL_HEALTH_CHECK, async (jobs) => {
    for (const job of jobs) {
      await handleUrlHealthCheck(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.QA_TRUTH_SAMPLER, async (jobs) => {
    for (const job of jobs) {
      await handleQaTruthSampler(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });

  boss.work(JOB_NAMES.VENDOR_EMAIL_SYNC, async (jobs) => {
    for (const job of jobs) {
      await handleVendorEmailSync(prisma, (job.data ?? {}) as Record<string, unknown>);
    }
  });
}
