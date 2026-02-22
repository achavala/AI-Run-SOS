import type PgBoss from "pg-boss";
import { JOB_NAMES } from "./jobs";

export async function createQueues(boss: PgBoss): Promise<void> {
  const queues = Object.values(JOB_NAMES);
  for (const queue of queues) {
    await boss.createQueue(queue);
  }
}

export async function scheduleRecurringJobs(boss: PgBoss): Promise<void> {
  // daily-scoreboard: 7am weekdays (Mon-Fri)
  await boss.schedule(JOB_NAMES.DAILY_SCOREBOARD, "0 7 * * 1-5", {}, { tz: "UTC" });

  // followup-check: 9am and 2pm weekdays
  await boss.schedule(JOB_NAMES.FOLLOWUP_CHECK, "0 9,14 * * 1-5", {}, { tz: "UTC" });

  // req-freshness: 6am weekdays
  await boss.schedule(JOB_NAMES.REQ_FRESHNESS, "0 6 * * 1-5", {}, { tz: "UTC" });

  // market-job-sync: every hour (rotating queries via hourSlots in QueryPlan)
  await boss.schedule(JOB_NAMES.MARKET_JOB_SYNC, "0 * * * *", {}, { tz: "UTC" });

  // url-health-check: every 2 hours (verifies apply URLs are still live)
  await boss.schedule(JOB_NAMES.URL_HEALTH_CHECK, "30 */2 * * *", {}, { tz: "UTC" });

  // qa-truth-sampler: daily at 8am (samples 20 random jobs for quality check)
  await boss.schedule(JOB_NAMES.QA_TRUTH_SAMPLER, "0 8 * * *", {}, { tz: "UTC" });

  // vendor-email-sync: every 5 minutes (near-real-time vendor req ingestion)
  await boss.schedule(JOB_NAMES.VENDOR_EMAIL_SYNC, "*/5 * * * *", {}, { tz: "UTC" });
}
