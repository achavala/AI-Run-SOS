import axios from "axios";
import { getAccessToken } from "./graphClient";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

export async function discoverFolders(email: string): Promise<MailFolder[]> {
  const token = await getAccessToken();
  const folders: MailFolder[] = [];

  let url: string | null =
    `https://graph.microsoft.com/v1.0/users/${email}/mailFolders` +
    `?$select=id,displayName,totalItemCount,unreadItemCount&$top=100`;

  while (url) {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    for (const f of res.data.value || []) {
      folders.push({
        id: f.id,
        displayName: f.displayName,
        totalItemCount: f.totalItemCount,
        unreadItemCount: f.unreadItemCount,
      });
    }
    url = res.data["@odata.nextLink"] || null;
  }

  return folders;
}

async function main() {
  console.log("=== Discovering All Mail Folders ===\n");

  const res = await pool.query("SELECT email FROM mailbox ORDER BY email");
  const mailboxes = res.rows.map((r) => r.email);

  let grandTotal = 0;

  for (const email of mailboxes) {
    console.log(`\n--- ${email} ---`);
    try {
      const folders = await discoverFolders(email);
      let mailboxTotal = 0;
      folders.sort((a, b) => b.totalItemCount - a.totalItemCount);

      for (const f of folders) {
        if (f.totalItemCount > 0) {
          console.log(`  ${f.displayName.padEnd(30)} ${String(f.totalItemCount).padStart(8)} items`);
        }
        mailboxTotal += f.totalItemCount;
      }
      console.log(`  ${"TOTAL".padEnd(30)} ${String(mailboxTotal).padStart(8)} items`);
      grandTotal += mailboxTotal;
    } catch (err: any) {
      console.error(`  ERROR: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  console.log(`\n=== Grand Total: ${grandTotal} items across all mailboxes ===`);
  await pool.end();
  process.exit(0);
}

// Only run as standalone script, not when imported
const isMain = require.main === module || process.argv[1]?.endsWith("discoverFolders.ts");
if (isMain) {
  main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}
