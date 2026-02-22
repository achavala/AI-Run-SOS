/**
 * Smart gap-fill: only syncs folders where we're missing significant data.
 * Compares Graph folder item count vs our DB count per mailbox.
 */
import axios from "axios";
import { getAccessToken, invalidateToken } from "./graphClient";
import { discoverFolders } from "./discoverFolders";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PAGE_SIZE = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SKIP_FOLDERS = new Set(["Conversation History", "RSS Feeds", "Outbox"]);

async function syncFolderFull(
  email: string,
  folderId: string,
  folderName: string,
  expectedItems: number
): Promise<number> {
  let token = await getAccessToken();
  const client = await pool.connect();
  let totalInserted = 0;
  let pageCount = 0;

  let url: string | null =
    `https://graph.microsoft.com/v1.0/users/${email}/mailFolders/${folderId}/messages` +
    `?$top=${PAGE_SIZE}` +
    `&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview` +
    `&$orderby=receivedDateTime desc`;

  try {
    while (url) {
      pageCount++;
      if (pageCount % 50 === 0) {
        const pct = Math.min(100, Math.round((pageCount * PAGE_SIZE / expectedItems) * 100));
        console.log(`      page ${pageCount} (${totalInserted} new, ~${pct}% scanned)...`);
      }

      try {
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const messages = response.data.value || [];
        if (messages.length === 0) break;

        for (const msg of messages) {
          const result = await client.query(
            `INSERT INTO raw_email_message
             (mailbox_email, graph_id, subject, from_email, from_name, to_emails, sent_at, body_preview, folder)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (mailbox_email, graph_id) DO NOTHING
             RETURNING id`,
            [
              email,
              msg.id,
              msg.subject,
              msg.from?.emailAddress?.address,
              msg.from?.emailAddress?.name,
              msg.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
              msg.receivedDateTime,
              msg.bodyPreview,
              folderName,
            ]
          );
          if (result.rowCount && result.rowCount > 0) {
            totalInserted++;
          }
        }

        url = response.data["@odata.nextLink"] || null;
      } catch (err: any) {
        if (err.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers["retry-after"] || "30", 10);
          console.log(`      Throttled page ${pageCount}. Waiting ${retryAfter}s...`);
          await sleep(retryAfter * 1000);
          continue;
        }
        if (err.response?.status === 401) {
          console.log(`      Token expired page ${pageCount}. Refreshing...`);
          invalidateToken();
          token = await getAccessToken();
          continue;
        }
        console.error(`      ERROR ${err.response?.status} page ${pageCount}`);
        break;
      }
    }
  } finally {
    client.release();
  }

  return totalInserted;
}

async function main() {
  console.log("=== Smart Gap-Fill Sync ===\n");

  const res = await pool.query("SELECT email FROM mailbox ORDER BY email");
  const mailboxes = res.rows.map((r) => r.email);

  // Get current DB counts per mailbox
  const dbCounts = await pool.query(`
    SELECT mailbox_email, COUNT(*) as cnt
    FROM raw_email_message
    GROUP BY mailbox_email
  `);
  const dbCountMap = new Map<string, number>();
  for (const r of dbCounts.rows) {
    dbCountMap.set(r.mailbox_email, parseInt(r.cnt));
  }

  let grandTotalNew = 0;

  for (const email of mailboxes) {
    console.log(`\n--- ${email} ---`);
    const dbCount = dbCountMap.get(email) || 0;

    let folders;
    try {
      folders = await discoverFolders(email);
    } catch (err: any) {
      console.error(`  ERROR discovering folders: ${err.message}`);
      continue;
    }

    const activeFolders = folders
      .filter((f) => f.totalItemCount > 0 && !SKIP_FOLDERS.has(f.displayName))
      .sort((a, b) => b.totalItemCount - a.totalItemCount);

    const graphTotal = activeFolders.reduce((s, f) => s + f.totalItemCount, 0);
    const gap = graphTotal - dbCount;

    console.log(`  Graph total: ${graphTotal} | DB: ${dbCount} | Gap: ${gap}`);

    if (gap <= 10) {
      console.log(`  SKIP — fully synced.`);
      continue;
    }

    for (const folder of activeFolders) {
      console.log(`    Syncing: ${folder.displayName} (${folder.totalItemCount} items)...`);
      const newCount = await syncFolderFull(email, folder.id, folder.displayName, folder.totalItemCount);
      grandTotalNew += newCount;
      console.log(`    → ${newCount} new messages stored`);
    }

    // Update last_synced_at
    const client = await pool.connect();
    await client.query("UPDATE mailbox SET last_synced_at = NOW() WHERE email = $1", [email]);
    client.release();
  }

  // Final stats
  const finalCount = await pool.query("SELECT COUNT(*) FROM raw_email_message");
  const senderCount = await pool.query("SELECT COUNT(DISTINCT from_email) FROM raw_email_message");

  console.log(`\n=== Gap-Fill Complete ===`);
  console.log(`  New messages stored: ${grandTotalNew}`);
  console.log(`  Total emails in DB:  ${finalCount.rows[0].count}`);
  console.log(`  Unique senders:      ${senderCount.rows[0].count}`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
