/**
 * Sync only the 5 newly added mailboxes, then run full extraction pipeline.
 * Usage: npx tsx src/syncNewMailboxes.ts
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

const NEW_MAILBOXES = [
  "sameera@cloudresources.net",
  "michael@cloudresources.net",
  "alan@cloudresources.net",
  "jasonfinn@cloudresources.net",
  "jobs@cloudresources.net",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  Sync 5 New Mailboxes + Extract & Classify   ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  const ok = await validateCredentials();
  if (!ok) {
    await pool.end();
    process.exit(1);
  }

  let grandTotal = 0;
  let failures = 0;

  for (let i = 0; i < NEW_MAILBOXES.length; i++) {
    const email = NEW_MAILBOXES[i];
    console.log(`\n[${ i + 1}/${NEW_MAILBOXES.length}] Syncing ${email}...`);
    try {
      const count = await syncMailbox(email);
      grandTotal += count;
      console.log(`  ✓ ${email}: ${count} new messages`);
    } catch (err: any) {
      failures++;
      console.error(`  ✗ ${email}: ${err.message}`);
    }

    if (i < NEW_MAILBOXES.length - 1) {
      console.log("  Waiting 3s before next mailbox...");
      await sleep(3000);
    }
  }

  console.log(`\n═══ Sync Phase Complete ═══`);
  console.log(`  Total new messages: ${grandTotal}`);
  console.log(`  Failures: ${failures}`);

  if (grandTotal > 0) {
    console.log(`\n═══ Running Extraction Pipeline ═══`);
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
    console.log("\n  ✓ Extraction pipeline complete!");
  }

  console.log(`\n═══ All Done ═══`);
  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
