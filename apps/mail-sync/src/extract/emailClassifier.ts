/**
 * Classifies every raw email into a category:
 *   VENDOR_REQ   — vendor sending job requirements
 *   VENDOR_OTHER — vendor non-req communication
 *   CONSULTANT   — resume/profile/availability
 *   CLIENT       — end-client or VMS communication
 *   INTERNAL     — own company (cloudresources / emonics)
 *   SYSTEM       — automated/no-reply/notifications
 *   PERSONAL     — free email domains
 *   OTHER        — unclassifiable
 */

import { Pool } from "pg";

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "protonmail.com", "aol.com", "icloud.com", "live.com",
  "msn.com", "ymail.com", "mail.com", "zoho.com",
  "me.com", "mac.com", "comcast.net", "att.net",
  "verizon.net", "sbcglobal.net", "cox.net",
  "googlemail.com", "yahoo.co.in", "yahoo.co.uk",
  "rediffmail.com", "in.com",
]);

const OWN_DOMAINS = new Set([
  "cloudresources.net", "emonics.com",
]);

const SYSTEM_PATTERNS = [
  /no[-_]?reply/i, /do[-_]?not[-_]?reply/i, /mailer[-_]?daemon/i,
  /postmaster/i, /notifications?@/i, /noreply/i, /alert@/i,
  /bounce/i, /undeliverable/i, /auto[-_]?respond/i,
];

const SYSTEM_DOMAINS = new Set([
  "cloud-protect.net", "ppe-hosted.com", "vectorvms.com",
  "googlegroups.com", "groups.google.com",
]);

// VMS / large enterprise client indicators
const CLIENT_DOMAIN_KEYWORDS = [
  "bank", "capital", "financial", "insurance", "health",
  "pharma", "energy", "motors", "auto", "aero",
  "gov", "state.", "county", "city.",
  "university", "edu", "hospital",
];

const CLIENT_SUBJECT_PATTERNS = [
  /\binterview\s+(scheduled|confirmed|invite|details)\b/i,
  /\bonboarding\b/i, /\bstart\s+date\b/i,
  /\boffer\s+(letter|extended|accepted)\b/i,
  /\bpo\s*(number|#)\b/i, /\bpurchase\s+order\b/i,
  /\bsow\b/i, /\bstatement\s+of\s+work\b/i,
  /\btimesheet\b/i, /\binvoice\b/i,
  /\bbackground\s+check\b/i, /\bdrug\s+(test|screen)\b/i,
  /\bextension\b/i, /\brenewal\b/i,
];

const VMS_DOMAINS = new Set([
  "vectorvms.com", "fieldglass.net", "beeline.com",
  "iqnavigator.com", "vms.com", "pontoon.com",
  "kforce.com", "teksystems.com", "randstad.com",
]);

const REQ_PATTERNS = [
  /\bc2c\b/i, /\bw2\b/i, /\bcorp[\s-]?to[\s-]?corp\b/i,
  /\brequirement\b/i, /\bhot\s*req\b/i,
  /\burgent\b.*\b(need|requirement|position|role|opening)\b/i,
  /\b(need|looking\s+for)\b.*\b(developer|engineer|architect|analyst|consultant|admin|tester|lead)\b/i,
  /\brole\s*:/i, /\bposition\s*:/i, /\bjob\s*(title|description)\s*:/i,
  /\bhiring\b/i, /\bimmediate\s+(need|start|opening|hire)\b/i,
  /\brate\s*:/i, /\bduration\s*:/i, /\blocation\s*:/i,
];

const RESUME_PATTERNS = [
  /resume/i, /\bcv\b/i, /profile\s+(attached|enclosed|below)/i,
  /submission/i, /candidate\s+(profile|resume|details)/i,
  /available\s+(for|immediately|on\s+\w+\s+\d)/i,
  /bench\s+(sales|consultant|resource)/i, /hotlist/i,
  /years?\s+of\s+(exp|experience)/i,
  /\b(h1b|h-1b|opt|cpt|gc|green\s+card|ead|tn\s+visa|l2)\b/i,
  /visa\s+status/i, /work\s+authorization/i,
  /current\s+location\s*:/i,
  /attached\s+resume/i, /please\s+find.*resume/i,
];

export type EmailCategory =
  | "VENDOR_REQ"
  | "VENDOR_OTHER"
  | "CONSULTANT"
  | "CLIENT"
  | "INTERNAL"
  | "SYSTEM"
  | "PERSONAL"
  | "OTHER";

export function classifyEmail(
  fromEmail: string,
  fromName: string,
  subject: string,
  bodyPreview: string,
  toEmails: string[]
): EmailCategory {
  const email = (fromEmail || "").toLowerCase().trim();
  const domain = email.split("@")[1] || "";
  const text = `${subject} ${bodyPreview}`;

  // 1. Internal
  if (OWN_DOMAINS.has(domain)) return "INTERNAL";

  // 2. System / Automated
  if (SYSTEM_DOMAINS.has(domain)) return "SYSTEM";
  for (const p of SYSTEM_PATTERNS) {
    if (p.test(email) || p.test(fromName || "")) return "SYSTEM";
  }

  // 3. Personal / free email
  if (FREE_DOMAINS.has(domain)) {
    // But could still be consultant sending resume from gmail
    for (const p of RESUME_PATTERNS) {
      if (p.test(text)) return "CONSULTANT";
    }
    return "PERSONAL";
  }

  // 4. VMS / known client systems
  if (VMS_DOMAINS.has(domain)) return "CLIENT";

  // 5. Client indicators in subject
  for (const p of CLIENT_SUBJECT_PATTERNS) {
    if (p.test(subject)) return "CLIENT";
  }

  // 6. Client domain heuristic (large enterprise keywords)
  for (const kw of CLIENT_DOMAIN_KEYWORDS) {
    if (domain.includes(kw)) return "CLIENT";
  }

  // 7. Consultant / resume
  let resumeScore = 0;
  for (const p of RESUME_PATTERNS) {
    if (p.test(text)) resumeScore++;
  }
  if (resumeScore >= 2) return "CONSULTANT";

  // 8. Vendor req
  let reqScore = 0;
  for (const p of REQ_PATTERNS) {
    if (p.test(text)) reqScore++;
  }
  if (reqScore >= 2) return "VENDOR_REQ";

  // 9. If from a company domain and has some req signal
  if (reqScore >= 1) return "VENDOR_REQ";
  if (resumeScore >= 1) return "CONSULTANT";

  // 10. If from a company domain, treat as vendor
  if (domain && !FREE_DOMAINS.has(domain)) return "VENDOR_OTHER";

  return "OTHER";
}

export async function classifyAllEmails(pool: Pool): Promise<void> {
  console.log("\n=== Email Classification (full) ===\n");

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, from_email, from_name, subject, body_preview, to_emails
      FROM raw_email_message
      ORDER BY sent_at DESC
    `);

    const counts: Record<string, number> = {};
    let processed = 0;

    for (const row of result.rows) {
      const category = classifyEmail(
        row.from_email || "",
        row.from_name || "",
        row.subject || "",
        row.body_preview || "",
        row.to_emails || []
      );

      await client.query(
        "UPDATE raw_email_message SET category = $1 WHERE id = $2",
        [category, row.id]
      );

      counts[category] = (counts[category] || 0) + 1;
      processed++;
    }

    console.log(`  Classified ${processed} emails:\n`);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [cat, cnt] of sorted) {
      const pct = ((cnt / processed) * 100).toFixed(1);
      console.log(`    ${cat.padEnd(15)} ${String(cnt).padStart(6)}  (${pct}%)`);
    }
  } finally {
    client.release();
  }
}

export async function classifyNewEmails(pool: Pool): Promise<void> {
  console.log("\n=== Email Classification (incremental) ===\n");

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, from_email, from_name, subject, body_preview, to_emails
      FROM raw_email_message
      WHERE category IS NULL
      ORDER BY sent_at DESC
    `);

    if (result.rows.length === 0) {
      console.log("  No unclassified emails found");
      return;
    }

    const counts: Record<string, number> = {};
    let processed = 0;

    for (const row of result.rows) {
      const category = classifyEmail(
        row.from_email || "",
        row.from_name || "",
        row.subject || "",
        row.body_preview || "",
        row.to_emails || []
      );

      await client.query(
        "UPDATE raw_email_message SET category = $1 WHERE id = $2",
        [category, row.id]
      );

      counts[category] = (counts[category] || 0) + 1;
      processed++;
    }

    console.log(`  Classified ${processed} new emails:\n`);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [cat, cnt] of sorted) {
      const pct = ((cnt / processed) * 100).toFixed(1);
      console.log(`    ${cat.padEnd(15)} ${String(cnt).padStart(6)}  (${pct}%)`);
    }
  } finally {
    client.release();
  }
}
