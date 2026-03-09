import { Pool } from "pg";
import crypto from "crypto";

function cuid(): string {
  return 'c' + crypto.randomBytes(12).toString('hex') + Date.now().toString(36);
}

const FREE_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "protonmail.com", "aol.com", "icloud.com", "live.com",
  "msn.com", "ymail.com", "mail.com", "zoho.com",
  "me.com", "mac.com", "comcast.net", "att.net",
  "verizon.net", "sbcglobal.net", "cox.net",
  "googlemail.com", "yahoo.co.in", "yahoo.co.uk",
  "rediffmail.com", "in.com",
]);

// Also skip the company's own domains (these aren't vendors)
const OWN_DOMAINS = new Set([
  "cloudresources.net", "emonics.com",
]);

function getDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

function guessCompanyName(domain: string): string {
  const parts = domain.split(".");
  const name = parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function extractVendors(pool: Pool, incrementalOnly = false): Promise<void> {
  console.log(`\n=== Vendor Extraction${incrementalOnly ? ' (incremental)' : ''} ===\n`);

  const client = await pool.connect();
  try {
    const whereClause = incrementalOnly
      ? `WHERE "fromEmail" IS NOT NULL AND "fromEmail" != '' AND "createdAt" >= NOW() - interval '2 hours'`
      : `WHERE "fromEmail" IS NOT NULL AND "fromEmail" != ''`;

    const result = await client.query(`
      SELECT "fromEmail", "fromName", MIN("sentAt") as first_seen, MAX("sentAt") as last_seen, COUNT(*) as cnt
      FROM "RawEmailMessage"
      ${whereClause}
      GROUP BY "fromEmail", "fromName"
      ORDER BY cnt DESC
    `);

    let vendorDomains = 0;
    let vendorContacts = 0;
    let skippedFree = 0;
    let skippedOwn = 0;

    for (const row of result.rows) {
      const email = row.fromEmail.toLowerCase().trim();
      const domain = getDomain(email);
      if (!domain) continue;

      if (FREE_DOMAINS.has(domain)) { skippedFree++; continue; }
      if (OWN_DOMAINS.has(domain)) { skippedOwn++; continue; }

      const companyResult = await client.query(`
        INSERT INTO "ExtractedVendorCompany" (id, domain, name, "emailCount", "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt")
        VALUES ($6, $1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (domain) DO UPDATE SET
          "emailCount" = "ExtractedVendorCompany"."emailCount" + $3,
          "firstSeenAt" = LEAST("ExtractedVendorCompany"."firstSeenAt", $4),
          "lastSeenAt" = GREATEST("ExtractedVendorCompany"."lastSeenAt", $5),
          "updatedAt" = NOW()
        RETURNING id
      `, [domain, guessCompanyName(domain), parseInt(row.cnt), row.first_seen, row.last_seen, cuid()]);

      const companyId = companyResult.rows[0].id;

      const contactResult = await client.query(`
        INSERT INTO "ExtractedVendorContact" (id, "vendorCompanyId", name, email, "emailCount", "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt")
        VALUES ($7, $1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(NULLIF($2, ''), "ExtractedVendorContact".name),
          "emailCount" = "ExtractedVendorContact"."emailCount" + $4,
          "firstSeenAt" = LEAST("ExtractedVendorContact"."firstSeenAt", $5),
          "lastSeenAt" = GREATEST("ExtractedVendorContact"."lastSeenAt", $6),
          "updatedAt" = NOW()
        RETURNING id
      `, [companyId, row.fromName || null, email, parseInt(row.cnt), row.first_seen, row.last_seen, cuid()]);

      if (contactResult.rowCount && contactResult.rowCount > 0) vendorContacts++;
    }

    const domainCount = await client.query(`SELECT COUNT(*) FROM "ExtractedVendorCompany"`);
    vendorDomains = parseInt(domainCount.rows[0].count);

    const contactCount = await client.query(`SELECT COUNT(*) FROM "ExtractedVendorContact"`);
    vendorContacts = parseInt(contactCount.rows[0].count);

    console.log(`  Vendor domains extracted: ${vendorDomains}`);
    console.log(`  Vendor contacts extracted: ${vendorContacts}`);
    console.log(`  Skipped (free email): ${skippedFree}`);
    console.log(`  Skipped (own company): ${skippedOwn}`);
  } finally {
    client.release();
  }
}
