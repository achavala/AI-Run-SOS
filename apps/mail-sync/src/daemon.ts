/**
 * Delta Sync Daemon — runs continuously, syncing new emails every 60 minutes
 * and re-running incremental extraction on new data.
 *
 * Excludes: akkayya.chavala@cloudresources.net, accounts@cloudresources.net
 *
 * Usage: npx tsx src/daemon.ts
 */
import cron from "node-cron";
import { Pool } from "pg";
import { syncMailbox } from "./syncMailbox";
import { validateCredentials } from "./graphClient";
import { classifyAllEmails, classifyNewEmails } from "./extract/emailClassifier";
import { extractVendors } from "./extract/vendorExtractor";
import { extractConsultants } from "./extract/consultantExtractor";
import { extractClients } from "./extract/clientExtractor";
import { extractReqSignals } from "./extract/reqSignalExtractor";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let running = false;

const EXCLUDED = new Set([
  "akkayya.chavala@cloudresources.net",
  "accounts@cloudresources.net",
  "info@cloudresources.net",
]);

async function syncCycle() {
  if (running) {
    console.log(`[${ts()}] Skipping — previous cycle still running`);
    return;
  }
  running = true;
  const start = Date.now();
  console.log(`\n[${ts()}] ════ Delta Sync Cycle Started ════`);

  try {
    let mailboxes: string[] = [];

    try {
      const res = await pool.query(`SELECT DISTINCT mailbox FROM "EmailSyncState" ORDER BY mailbox`);
      mailboxes = res.rows.map((r: any) => r.mailbox).filter((e: string) => !EXCLUDED.has(e));
    } catch {
      // Fallback: get unique pstBatch values as mailbox identifiers
      const res = await pool.query(`SELECT DISTINCT "pstBatch" as mailbox FROM "RawEmailMessage" WHERE "pstBatch" IS NOT NULL AND "pstBatch" != '' ORDER BY "pstBatch"`);
      mailboxes = res.rows.map((r: any) => r.mailbox).filter((e: string) => !EXCLUDED.has(e));
    }

    if (mailboxes.length === 0 && process.env.GRAPH_MAILBOX) {
      mailboxes = process.env.GRAPH_MAILBOX.split(",").map(e => e.trim()).filter(e => !EXCLUDED.has(e));
    }

    let totalNew = 0;

    for (const email of mailboxes) {
      try {
        const count = await syncMailbox(email);
        totalNew += count;
      } catch (err: any) {
        console.error(`  [WARN] ${email}: ${err.message}`);
      }
    }

    console.log(`[${ts()}] Sync done: ${totalNew} new emails from ${mailboxes.length} mailboxes`);

    if (totalNew > 0) {
      console.log(`[${ts()}] Running incremental extraction on ${totalNew} new emails...`);
      await classifyNewEmails(pool);
      await extractVendors(pool, true);
      await extractConsultants(pool, true);
      await extractClients(pool, true);
      await extractReqSignals(pool, true);
      console.log(`[${ts()}] Extraction complete`);
    } else {
      console.log(`[${ts()}] No new emails — skipping extraction`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${ts()}] ════ Cycle Complete (${elapsed}s, ${totalNew} new) ════`);
  } catch (err: any) {
    console.error(`[${ts()}] Cycle failed: ${err.message}`);
  } finally {
    running = false;
  }
}

function ts() {
  return new Date().toLocaleTimeString();
}

async function main() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║   Mail Sync Daemon — Delta Mode (60 min)       ║");
  console.log("║   Excludes: akkayya.chavala@, accounts@         ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  const ok = await validateCredentials();
  if (!ok) {
    console.error("Credential validation failed. Exiting.");
    process.exit(1);
  }

  // Run immediately on startup
  await syncCycle();

  // Then every 60 minutes
  cron.schedule("0 * * * *", () => {
    syncCycle();
  });

  console.log(`\n[${ts()}] Daemon running. Next sync in 60 minutes. Press Ctrl+C to stop.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
