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

export async function extractVendors(pool: Pool): Promise<void> {
  console.log("\n=== Vendor Extraction ===\n");

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT from_email, from_name, MIN(sent_at) as first_seen, MAX(sent_at) as last_seen, COUNT(*) as cnt
      FROM raw_email_message
      WHERE from_email IS NOT NULL AND from_email != ''
      GROUP BY from_email, from_name
      ORDER BY cnt DESC
    `);

    let vendorDomains = 0;
    let vendorContacts = 0;
    let skippedFree = 0;
    let skippedOwn = 0;

    for (const row of result.rows) {
      const email = row.from_email.toLowerCase().trim();
      const domain = getDomain(email);
      if (!domain) continue;

      if (FREE_DOMAINS.has(domain)) { skippedFree++; continue; }
      if (OWN_DOMAINS.has(domain)) { skippedOwn++; continue; }

      // Upsert vendor_company
      const companyResult = await client.query(`
        INSERT INTO vendor_company (domain, name, email_count, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (domain) DO UPDATE SET
          email_count = vendor_company.email_count + $3,
          first_seen = LEAST(vendor_company.first_seen, $4),
          last_seen = GREATEST(vendor_company.last_seen, $5)
        RETURNING id
      `, [domain, guessCompanyName(domain), parseInt(row.cnt), row.first_seen, row.last_seen]);

      const companyId = companyResult.rows[0].id;

      // Upsert vendor_contact
      const contactResult = await client.query(`
        INSERT INTO vendor_contact (vendor_company_id, name, email, email_count, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(NULLIF($2, ''), vendor_contact.name),
          email_count = vendor_contact.email_count + $4,
          first_seen = LEAST(vendor_contact.first_seen, $5),
          last_seen = GREATEST(vendor_contact.last_seen, $6)
        RETURNING id
      `, [companyId, row.from_name || null, email, parseInt(row.cnt), row.first_seen, row.last_seen]);

      if (contactResult.rowCount && contactResult.rowCount > 0) vendorContacts++;
    }

    // Count unique domains
    const domainCount = await client.query("SELECT COUNT(*) FROM vendor_company");
    vendorDomains = parseInt(domainCount.rows[0].count);

    const contactCount = await client.query("SELECT COUNT(*) FROM vendor_contact");
    vendorContacts = parseInt(contactCount.rows[0].count);

    console.log(`  Vendor domains extracted: ${vendorDomains}`);
    console.log(`  Vendor contacts extracted: ${vendorContacts}`);
    console.log(`  Skipped (free email): ${skippedFree}`);
    console.log(`  Skipped (own company): ${skippedOwn}`);
  } finally {
    client.release();
  }
}
