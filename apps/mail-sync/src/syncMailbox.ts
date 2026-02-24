import axios from "axios";
import { getAccessToken, invalidateToken } from "./graphClient";
import { discoverFolders, MailFolder } from "./discoverFolders";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PAGE_SIZE = 50;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CONSECUTIVE_EMPTY_PAGES_TO_STOP = 3;

async function syncFolder(
  email: string,
  folderId: string,
  folderName: string,
  token: string,
  client: any
): Promise<number> {
  let totalInserted = 0;
  let pageCount = 0;
  let consecutiveEmptyPages = 0;

  let url: string | null =
    `https://graph.microsoft.com/v1.0/users/${email}/mailFolders/${folderId}/messages` +
    `?$top=${PAGE_SIZE}` +
    `&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview` +
    `&$orderby=receivedDateTime desc`;

  while (url) {
    pageCount++;
    if (pageCount % 50 === 0) {
      console.log(`    ${folderName} page ${pageCount} (${totalInserted} new)...`);
    }

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const messages = response.data.value || [];
      if (messages.length === 0) break;

      let pageInserts = 0;
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
          pageInserts++;
        }
      }

      if (pageInserts === 0) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= CONSECUTIVE_EMPTY_PAGES_TO_STOP) {
          console.log(`    ${folderName}: caught up (${consecutiveEmptyPages} consecutive pages with no new msgs)`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
      }

      url = response.data["@odata.nextLink"] || null;
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryAfter = parseInt(err.response.headers["retry-after"] || "30", 10);
        console.log(`    Throttled on page ${pageCount}. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (err.response?.status === 401) {
        console.log(`    Token expired on page ${pageCount}. Refreshing...`);
        invalidateToken();
        token = await getAccessToken();
        continue;
      }
      const errorBody = err.response?.data?.error;
      console.error(
        `    ERROR ${err.response?.status} on page ${pageCount}: ${errorBody?.code} — ${errorBody?.message}`
      );
      break;
    }
  }

  if (totalInserted > 0 || pageCount > 1) {
    console.log(`    ${folderName}: ${totalInserted} new (${pageCount} pages)`);
  }
  return totalInserted;
}

const SKIP_FOLDERS = new Set([
  "Conversation History", "RSS Feeds", "Outbox",
]);

export async function syncMailbox(email: string): Promise<number> {
  console.log(`\n--- Syncing ALL folders: ${email} ---`);

  let token = await getAccessToken();
  const client = await pool.connect();
  let total = 0;

  try {
    const folders = await discoverFolders(email);
    const activeFolders = folders
      .filter((f) => f.totalItemCount > 0 && !SKIP_FOLDERS.has(f.displayName))
      .sort((a, b) => b.totalItemCount - a.totalItemCount);

    console.log(`  Found ${activeFolders.length} folders with content:`);
    for (const f of activeFolders) {
      console.log(`    ${f.displayName.padEnd(25)} ${String(f.totalItemCount).padStart(8)} items`);
    }

    for (const folder of activeFolders) {
      const count = await syncFolder(email, folder.id, folder.displayName, token, client);
      total += count;

      // Re-fetch token if it might be expiring (proactive refresh every folder)
      try {
        token = await getAccessToken();
      } catch {
        invalidateToken();
        token = await getAccessToken();
      }
    }

    await client.query(
      `UPDATE mailbox SET last_synced_at = NOW() WHERE email = $1`,
      [email]
    );
  } finally {
    client.release();
  }

  console.log(`  TOTAL for ${email}: ${total} new messages`);
  return total;
}
