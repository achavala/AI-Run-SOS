/**
 * Full Sync + Extraction for all mailboxes.
 * 1. Syncs all 14 mailboxes (new ones get full history, existing get delta)
 * 2. Runs the full extraction pipeline (classify, vendors, consultants, clients, req signals)
 *
 * Usage: npx tsx src/syncAllAndExtract.ts
 */
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

const EXCLUDED = new Set([
  "akkayya.chavala@cloudresources.net",
  "accounts@cloudresources.net",
  "info@cloudresources.net",
]);

const DELAY_MS = 3000;
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  FULL SYNC + EXTRACTION — All Mailboxes             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");
  console.log(`  Started: ${new Date().toISOString()}\n`);

  const ok = await validateCredentials();
  if (!ok) {
    console.error("Credential validation failed.");
    process.exit(1);
  }

  const res = await pool.query("SELECT email FROM mailbox ORDER BY email");
  const allMailboxes: string[] = res.rows
    .map((r) => r.email)
    .filter((e: string) => !EXCLUDED.has(e));

  console.log(`\n  Syncing ${allMailboxes.length} mailboxes (excluding ${EXCLUDED.size} excluded):`);
  allMailboxes.forEach((e) => console.log(`    • ${e}`));
  console.log();

  let grandTotal = 0;
  let failures = 0;

  for (let i = 0; i < allMailboxes.length; i++) {
    const email = allMailboxes[i];
    try {
      const count = await syncMailbox(email);
      grandTotal += count;
      console.log(`  ✓ ${email}: ${count} new messages`);
    } catch (err: any) {
      failures++;
      console.error(`  ✗ ${email}: ${err.message}`);
    }

    if (i < allMailboxes.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n═══ SYNC COMPLETE ═══`);
  console.log(`  Total new emails: ${grandTotal}`);
  console.log(`  Failures: ${failures}/${allMailboxes.length}`);

  // Run extraction pipeline on ALL emails (classifier is incremental — only processes unclassified)
  console.log(`\n═══ RUNNING EXTRACTION PIPELINE ═══`);
  const t0 = Date.now();

  console.log("  [1/5] Classifying emails...");
  await classifyAllEmails(pool);

  console.log("  [2/5] Extracting vendors...");
  await extractVendors(pool);

  console.log("  [3/5] Extracting consultants...");
  await extractConsultants(pool);

  console.log("  [4/5] Extracting clients...");
  await extractClients(pool);

  console.log("  [5/5] Extracting req signals...");
  await extractReqSignals(pool);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  Extraction done in ${elapsed}s`);

  // Final counts
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM raw_email_message) as total_emails,
      (SELECT COUNT(DISTINCT mailbox_email) FROM raw_email_message) as mailboxes,
      (SELECT COUNT(*) FROM vendor_company) as vendor_companies,
      (SELECT COUNT(*) FROM vendor_contact) as vendor_contacts,
      (SELECT COUNT(*) FROM client_company) as client_companies,
      (SELECT COUNT(*) FROM consultant) as consultants,
      (SELECT COUNT(*) FROM vendor_req_signal) as req_signals
  `);
  const t = counts.rows[0];
  console.log("\n═══════════════════════════════════");
  console.log("       FINAL COUNTS");
  console.log("═══════════════════════════════════");
  console.log(`  Total emails:       ${t.total_emails}`);
  console.log(`  Active mailboxes:   ${t.mailboxes}`);
  console.log(`  Vendor companies:   ${t.vendor_companies}`);
  console.log(`  Vendor contacts:    ${t.vendor_contacts}`);
  console.log(`  Client companies:   ${t.client_companies}`);
  console.log(`  Consultants:        ${t.consultants}`);
  console.log(`  Req signals:        ${t.req_signals}`);
  console.log("═══════════════════════════════════\n");

  console.log(`  Finished: ${new Date().toISOString()}`);
  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
