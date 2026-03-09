/**
 * Delta Sync Daemon — runs continuously, syncing all configured mailboxes
 * every 60 minutes and re-running incremental extraction on new data.
 *
 * Usage: npx tsx src/daemon.ts
 */
import cron from "node-cron";
import axios from "axios";
import { Pool } from "pg";
import { syncMailbox } from "./syncMailbox";
import { validateCredentials } from "./graphClient";
import { extractVendors } from "./extract/vendorExtractor";
import { extractReqSignals } from "./extract/reqSignalExtractor";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let running = false;

const DELAY_BETWEEN_MAILBOXES_MS = 2000;
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function syncCycle() {
  if (running) {
    console.log(`[${ts()}] Skipping — previous cycle still running`);
    return;
  }
  running = true;
  const start = Date.now();
  console.log(`\n[${ts()}] ════ Delta Sync Cycle Started ════`);

  try {
    const mailboxSet = new Set<string>();

    // Source 1: GRAPH_MAILBOX env (primary — all configured mailboxes)
    if (process.env.GRAPH_MAILBOX) {
      for (const e of process.env.GRAPH_MAILBOX.split(",")) {
        const trimmed = e.trim();
        if (trimmed && trimmed.includes("@")) mailboxSet.add(trimmed);
      }
    }

    // Source 2: Previously synced mailboxes from EmailSyncState
    try {
      const res = await pool.query(`SELECT DISTINCT mailbox FROM "EmailSyncState" ORDER BY mailbox`);
      for (const r of res.rows) {
        if (r.mailbox && r.mailbox.includes("@") && !r.mailbox.includes(",")) mailboxSet.add(r.mailbox);
      }
    } catch {}

    const mailboxes = [...mailboxSet].sort();

    console.log(`[${ts()}] Syncing ${mailboxes.length} mailboxes:`);
    mailboxes.forEach(e => console.log(`    • ${e}`));

    let totalNew = 0;
    let failures = 0;

    for (let i = 0; i < mailboxes.length; i++) {
      const email = mailboxes[i];
      try {
        const count = await syncMailbox(email);
        totalNew += count;
      } catch (err: any) {
        failures++;
        console.error(`  [WARN] ${email}: ${err.message}`);
      }
      if (i < mailboxes.length - 1) await sleep(DELAY_BETWEEN_MAILBOXES_MS);
    }

    console.log(`[${ts()}] Sync done: ${totalNew} new emails from ${mailboxes.length} mailboxes (${failures} failures)`);

    if (totalNew > 0) {
      console.log(`[${ts()}] Running incremental extraction on ${totalNew} new emails...`);
      try { await extractVendors(pool, true); } catch (e: any) { console.error(`  [WARN] vendor extraction: ${e.message}`); }
      try { await extractReqSignals(pool, true); } catch (e: any) { console.error(`  [WARN] req signal extraction: ${e.message}`); }

      // Trigger API-side re-extraction for Prisma-based signals
      try {
        const apiBase = process.env.API_URL || 'http://localhost:3001/api';
        const loginRes = await axios.post(`${apiBase}/auth/login`, { email: 'md@apex-staffing.com', password: 'Password123!' });
        const token = loginRes.data.accessToken;
        const extractRes = await axios.post(`${apiBase}/mail-intel/re-extract`, {}, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`[${ts()}] API re-extract: ${extractRes.data.signalsCreated} new signals, ${extractRes.data.vendorsCreated} new vendors`);
      } catch (e: any) {
        console.error(`  [WARN] API re-extract: ${e.message}`);
      }

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
  console.log("║   Auto-syncs + extracts every hour             ║");
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
