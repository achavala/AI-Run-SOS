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

  // market-job-sync: every 30 minutes (C2C openings refresh twice per hour)
  await boss.schedule(JOB_NAMES.MARKET_JOB_SYNC, "*/30 * * * *", {}, { tz: "UTC" });

  // url-health-check: every 2 hours (verifies apply URLs are still live)
  await boss.schedule(JOB_NAMES.URL_HEALTH_CHECK, "30 */2 * * *", {}, { tz: "UTC" });

  // qa-truth-sampler: daily at 8am (samples 20 random jobs for quality check)
  await boss.schedule(JOB_NAMES.QA_TRUTH_SAMPLER, "0 8 * * *", {}, { tz: "UTC" });

  // vendor-email-sync: every 5 minutes (near-real-time vendor req ingestion)
  await boss.schedule(JOB_NAMES.VENDOR_EMAIL_SYNC, "*/5 * * * *", {}, { tz: "UTC" });

  // linkedin-enrichment: daily at 6:30 AM UTC + every 4 hours
  await boss.schedule(JOB_NAMES.LINKEDIN_ENRICHMENT, "30 6,10,14,18,22 * * *", {}, { tz: "UTC" });

  // trust-score-update: every 6 hours — recomputes vendor trust scores from response patterns
  await boss.schedule(JOB_NAMES.TRUST_SCORE_UPDATE, "0 0,6,12,18 * * *", {}, { tz: "UTC" });

  // margin-check: daily at 7:30 AM — validates active submissions against margin thresholds
  await boss.schedule(JOB_NAMES.MARGIN_CHECK, "30 7 * * 1-5", {}, { tz: "UTC" });

  // recruiter-digest: daily at 7 AM weekdays — morning push with top-10 reqs and pipeline summary
  await boss.schedule(JOB_NAMES.RECRUITER_DIGEST, "0 7 * * 1-5", {}, { tz: "UTC" });

  // interview-detection: every 15 minutes — scans emails for interview/offer signals
  await boss.schedule(JOB_NAMES.INTERVIEW_DETECTION, "*/15 * * * *", {}, { tz: "UTC" });

  // llm-extraction: every 2 hours — processes ambiguous emails with LLM for better extraction
  await boss.schedule(JOB_NAMES.LLM_EXTRACTION, "15 */2 * * *", {}, { tz: "UTC" });
}
