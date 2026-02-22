import { Pool } from "pg";
import { syncMailbox } from "./syncMailbox";
import { validateCredentials } from "./graphClient";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DELAY_BETWEEN_MAILBOXES_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Mail Sync — Phase 1: Initial Ingestion ===\n");

  // Pre-flight: validate credentials before touching any mailbox
  const credentialsOk = await validateCredentials();
  if (!credentialsOk) {
    await pool.end();
    process.exit(1);
  }

  const res = await pool.query(
    "SELECT email FROM mailbox ORDER BY email"
  );
  const mailboxes: string[] = res.rows.map((r) => r.email);

  console.log(`Found ${mailboxes.length} mailboxes to sync:`);
  mailboxes.forEach((e) => console.log(`  • ${e}`));

  let grandTotal = 0;
  let failures = 0;

  for (let i = 0; i < mailboxes.length; i++) {
    try {
      const count = await syncMailbox(mailboxes[i]);
      grandTotal += count;
    } catch (err: any) {
      failures++;
      console.error(`  FAILED: ${mailboxes[i]} — ${err.message}`);
    }

    if (i < mailboxes.length - 1) {
      console.log(
        `\n  Waiting ${DELAY_BETWEEN_MAILBOXES_MS / 1000}s before next mailbox...`
      );
      await sleep(DELAY_BETWEEN_MAILBOXES_MS);
    }
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`  Mailboxes: ${mailboxes.length} (${failures} failed)`);
  console.log(`  New messages stored: ${grandTotal}`);

  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
