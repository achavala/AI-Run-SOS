/**
 * Delta Sync Daemon — runs continuously, syncing new emails every 15 minutes
 * and re-running extraction on new data.
 *
 * Usage: npx tsx src/daemon.ts
 */
import cron from "node-cron";
import { Pool } from "pg";
import { syncMailbox } from "./syncMailbox";
import { validateCredentials } from "./graphClient";
import { classifyAllEmails } from "./extract/emailClassifier";
import { extractVendors } from "./extract/vendorExtractor";
import { extractConsultants } from "./extract/consultantExtractor";
import { extractClients } from "./extract/clientExtractor";
import { extractReqSignals } from "./extract/reqSignalExtractor";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let running = false;

async function syncCycle() {
  if (running) {
    console.log(`[${ts()}] Skipping — previous cycle still running`);
    return;
  }
  running = true;
  const start = Date.now();
  console.log(`\n[${ts()}] ════ Delta Sync Cycle Started ════`);

  try {
    const res = await pool.query("SELECT email FROM mailbox ORDER BY email");
    const mailboxes: string[] = res.rows.map((r) => r.email);
    let totalNew = 0;

    for (const email of mailboxes) {
      try {
        const count = await syncMailbox(email);
        totalNew += count;
      } catch (err: any) {
        console.error(`  [WARN] ${email}: ${err.message}`);
      }
    }

    console.log(`[${ts()}] Sync done: ${totalNew} new emails`);

    if (totalNew > 0) {
      console.log(`[${ts()}] Running extraction on new data...`);
      await classifyAllEmails(pool);
      await extractVendors(pool);
      await extractConsultants(pool);
      await extractClients(pool);
      await extractReqSignals(pool);
      console.log(`[${ts()}] Extraction complete`);
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
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Mail Sync Daemon — Delta Mode        ║");
  console.log("║   Syncs every 15 minutes               ║");
  console.log("╚════════════════════════════════════════╝\n");

  const ok = await validateCredentials();
  if (!ok) {
    console.error("Credential validation failed. Exiting.");
    process.exit(1);
  }

  // Run immediately on startup
  await syncCycle();

  // Then every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    syncCycle();
  });

  console.log(`\n[${ts()}] Daemon running. Next sync in 15 minutes. Press Ctrl+C to stop.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
