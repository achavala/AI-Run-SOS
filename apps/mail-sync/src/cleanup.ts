/**
 * Data Quality Cleanup Script
 * - Filters out system/mailer-daemon vendor companies
 * - Deduplicates consultants by normalized name + phone
 * - Improves client detection with broader heuristics
 *
 * Usage: npx tsx src/cleanup.ts
 */
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SYSTEM_VENDOR_DOMAINS = [
  'ppe-hosted.com', 'dispatch1-us1.ppe-hosted.com',
  'googlegroups.com', 'groups.google.com',
  'cloud-protect.net', 'vectorvms.com',
  'bounce.secureserver.net', 'mailer-daemon%',
  'postmaster%', 'noreply%', 'no-reply%',
  'mailgun.org', 'sendgrid.net', 'mandrillapp.com',
  'amazonses.com', 'sparkpostmail.com',
  'mailchimp.com', 'constantcontact.com',
  'linkedin.com', 'facebookmail.com',
  'indeed.com', 'dice.com', 'monster.com',
  'notifications.google.com',
];

const ADDITIONAL_CLIENT_DOMAINS = [
  'cognizant.com', 'infosys.com', 'wipro.com', 'tcs.com',
  'hcl.com', 'accenture.com', 'deloitte.com', 'pwc.com',
  'ey.com', 'kpmg.com', 'ibm.com', 'microsoft.com',
  'amazon.com', 'google.com', 'apple.com', 'meta.com',
  'oracle.com', 'salesforce.com', 'sap.com',
  'jpmorgan.com', 'chase.com', 'wellsfargo.com',
  'citi.com', 'citigroup.com', 'goldmansachs.com',
  'morganstanley.com', 'barclays.com',
  'anthem.com', 'uhg.com', 'unitedhealth.com',
  'kaiser.org', 'cigna.com', 'aetna.com',
  'lockheedmartin.com', 'boeing.com', 'raytheon.com',
  'northropgrumman.com', 'generaldynamics.com',
  'pfizer.com', 'merck.com', 'jnj.com', 'abbvie.com',
  'walmart.com', 'target.com', 'costco.com',
  'ford.com', 'gm.com', 'tesla.com',
  'disney.com', 'comcast.com', 'verizon.com', 'att.com',
];

const CLIENT_KEYWORD_PATTERNS = [
  '%bank%', '%capital%', '%financial%', '%insurance%',
  '%health%', '%pharma%', '%energy%', '%motors%',
  '%university%', '%hospital%', '%medical%',
  '%federal%', '%government%', '%defense%',
  '%airlines%', '%telecom%', '%utilities%',
];

async function cleanupSystemVendors() {
  const client = await pool.connect();
  try {
    console.log("\n--- Step 1: Marking system/junk vendor domains ---");

    let totalMarked = 0;
    for (const domain of SYSTEM_VENDOR_DOMAINS) {
      const like = domain.includes('%');
      const q = like
        ? `UPDATE vendor_company SET name = '[SYSTEM] ' || name WHERE domain LIKE $1 AND name NOT LIKE '[SYSTEM]%'`
        : `UPDATE vendor_company SET name = '[SYSTEM] ' || name WHERE domain = $1 AND name NOT LIKE '[SYSTEM]%'`;
      const r = await client.query(q, [domain]);
      totalMarked += r.rowCount || 0;
    }

    // Also mark vendors with mailer-daemon contacts
    const mdResult = await client.query(`
      UPDATE vendor_company SET name = '[SYSTEM] ' || name
      WHERE id IN (
        SELECT DISTINCT vendor_company_id FROM vendor_contact
        WHERE email ILIKE '%mailer-daemon%' OR email ILIKE '%postmaster%'
        OR email ILIKE '%noreply%' OR email ILIKE '%no-reply%'
        OR email ILIKE '%donotreply%'
      ) AND name NOT LIKE '[SYSTEM]%'
    `);
    totalMarked += mdResult.rowCount || 0;

    console.log(`  Marked ${totalMarked} vendor companies as [SYSTEM]`);
  } finally {
    client.release();
  }
}

async function deduplicateConsultants() {
  const client = await pool.connect();
  try {
    console.log("\n--- Step 2: Deduplicating consultants ---");

    // Find duplicates by normalized email (keep the one with most skills)
    const emailDupes = await client.query(`
      WITH ranked AS (
        SELECT id, email,
          ROW_NUMBER() OVER (
            PARTITION BY lower(trim(email))
            ORDER BY array_length(primary_skills, 1) DESC NULLS LAST, last_seen DESC NULLS LAST
          ) as rn
        FROM consultant
        WHERE email IS NOT NULL AND email != ''
      )
      SELECT id FROM ranked WHERE rn > 1
    `);

    if (emailDupes.rows.length > 0) {
      const ids = emailDupes.rows.map(r => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`DELETE FROM consultant WHERE id IN (${placeholders})`, ids);
      console.log(`  Removed ${ids.length} duplicate consultants (by email)`);
    } else {
      console.log(`  No email-based duplicates found`);
    }

    // Find duplicates by normalized name + phone
    const nameDupes = await client.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY lower(trim(full_name)), phone
            ORDER BY array_length(primary_skills, 1) DESC NULLS LAST, last_seen DESC NULLS LAST
          ) as rn
        FROM consultant
        WHERE full_name IS NOT NULL AND full_name != '' AND phone IS NOT NULL AND phone != ''
      )
      SELECT id FROM ranked WHERE rn > 1
    `);

    if (nameDupes.rows.length > 0) {
      const ids = nameDupes.rows.map(r => r.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`DELETE FROM consultant WHERE id IN (${placeholders})`, ids);
      console.log(`  Removed ${ids.length} duplicate consultants (by name+phone)`);
    } else {
      console.log(`  No name+phone duplicates found`);
    }

    // Remove junk entries (no name, no email, no skills)
    const junkResult = await client.query(`
      DELETE FROM consultant
      WHERE (full_name IS NULL OR full_name = '' OR full_name = '—')
        AND (email IS NULL OR email = '')
        AND (primary_skills IS NULL OR array_length(primary_skills, 1) IS NULL)
    `);
    console.log(`  Removed ${junkResult.rowCount} junk entries (no name/email/skills)`);

    const remaining = await client.query("SELECT COUNT(*)::int as cnt FROM consultant");
    console.log(`  Consultants remaining: ${remaining.rows[0].cnt}`);
  } finally {
    client.release();
  }
}

async function improveClientDetection() {
  const client = await pool.connect();
  try {
    console.log("\n--- Step 3: Improving client detection ---");

    // Re-classify emails from known client domains
    let reclassified = 0;
    for (const domain of ADDITIONAL_CLIENT_DOMAINS) {
      const r = await client.query(`
        UPDATE raw_email_message SET category = 'CLIENT'
        WHERE from_email ILIKE $1 AND category NOT IN ('CLIENT', 'INTERNAL')
      `, [`%@${domain}`]);
      reclassified += r.rowCount || 0;
    }

    // Also check keyword patterns in from_email domain
    for (const pattern of CLIENT_KEYWORD_PATTERNS) {
      const r = await client.query(`
        UPDATE raw_email_message SET category = 'CLIENT'
        WHERE from_email ILIKE $1
          AND category NOT IN ('CLIENT', 'INTERNAL', 'SYSTEM')
          AND from_email NOT ILIKE '%@gmail.com'
          AND from_email NOT ILIKE '%@yahoo.com'
      `, [`%@${pattern}`]);
      reclassified += r.rowCount || 0;
    }

    console.log(`  Reclassified ${reclassified} emails as CLIENT`);

    // Now extract new client companies from these reclassified emails
    const newClients = await client.query(`
      INSERT INTO client_company (name, domain, email_count, first_seen, last_seen, source)
      SELECT
        split_part(split_part(from_email, '@', 2), '.', 1) as name,
        split_part(from_email, '@', 2) as domain,
        COUNT(*) as email_count,
        MIN(sent_at) as first_seen,
        MAX(sent_at) as last_seen,
        'email_classifier'
      FROM raw_email_message
      WHERE category = 'CLIENT'
        AND from_email IS NOT NULL
        AND split_part(from_email, '@', 2) NOT IN (SELECT domain FROM client_company WHERE domain IS NOT NULL)
      GROUP BY split_part(from_email, '@', 2)
      HAVING COUNT(*) >= 2
      ON CONFLICT (domain) DO UPDATE SET
        email_count = EXCLUDED.email_count,
        last_seen = GREATEST(client_company.last_seen, EXCLUDED.last_seen)
      RETURNING id
    `);
    console.log(`  Added/updated ${newClients.rowCount} client companies`);

    // Extract new client contacts — use a temp table to avoid ON CONFLICT affecting same row twice
    await client.query(`
      CREATE TEMP TABLE _tmp_cc AS
      SELECT DISTINCT ON (rem.from_email)
        cc.id as client_company_id,
        rem.from_name as name,
        rem.from_email as email,
        COUNT(*) OVER (PARTITION BY rem.from_email) as email_count,
        MIN(rem.sent_at) OVER (PARTITION BY rem.from_email) as first_seen,
        MAX(rem.sent_at) OVER (PARTITION BY rem.from_email) as last_seen
      FROM raw_email_message rem
      JOIN client_company cc ON cc.domain = split_part(rem.from_email, '@', 2)
      WHERE rem.category = 'CLIENT' AND rem.from_email IS NOT NULL
      ORDER BY rem.from_email, rem.sent_at DESC
    `);
    const newContacts = await client.query(`
      INSERT INTO client_contact (client_company_id, name, email, email_count, first_seen, last_seen)
      SELECT client_company_id, name, email, email_count, first_seen, last_seen FROM _tmp_cc
      ON CONFLICT (email) DO UPDATE SET
        email_count = EXCLUDED.email_count,
        last_seen = GREATEST(client_contact.last_seen, EXCLUDED.last_seen)
    `);
    await client.query("DROP TABLE IF EXISTS _tmp_cc");
    console.log(`  Added/updated ${newContacts.rowCount} client contacts`);

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM client_company) as companies,
        (SELECT COUNT(*)::int FROM client_contact) as contacts
    `);
    console.log(`  Total clients: ${totals.rows[0].companies} companies, ${totals.rows[0].contacts} contacts`);
  } finally {
    client.release();
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║   Data Quality Cleanup                 ║");
  console.log("╚════════════════════════════════════════╝");

  await cleanupSystemVendors();
  await deduplicateConsultants();
  await improveClientDetection();

  console.log("\n✓ Cleanup complete");
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
