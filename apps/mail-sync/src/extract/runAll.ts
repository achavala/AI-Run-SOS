import { Pool } from "pg";
import { classifyAllEmails } from "./emailClassifier";
import { extractVendors } from "./vendorExtractor";
import { extractConsultants } from "./consultantExtractor";
import { extractReqSignals } from "./reqSignalExtractor";
import { extractClients } from "./clientExtractor";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runReport(pool: Pool) {
  const client = await pool.connect();
  try {
    console.log("\n══════════════════════════════════════════════");
    console.log("       VENDOR INTELLIGENCE REPORT");
    console.log("══════════════════════════════════════════════\n");

    // Email classification breakdown
    const catBreakdown = await client.query(`
      SELECT category, COUNT(*) as cnt
      FROM raw_email_message
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY cnt DESC
    `);
    console.log("--- Email Categories ---");
    for (const r of catBreakdown.rows) {
      console.log(`  ${(r.category || 'NULL').padEnd(15)} ${String(r.cnt).padStart(6)}`);
    }

    // Top 20 vendor domains
    const topDomains = await client.query(`
      SELECT domain, name, email_count
      FROM vendor_company
      ORDER BY email_count DESC
      LIMIT 20
    `);
    console.log("\n--- Top 20 Vendor Companies ---");
    topDomains.rows.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${r.domain.padEnd(35)} ${String(r.email_count).padStart(5)} emails`);
    });

    // Top 20 recruiter contacts
    const topContacts = await client.query(`
      SELECT vc.email, vc.name, vc.email_count, v.domain
      FROM vendor_contact vc
      JOIN vendor_company v ON v.id = vc.vendor_company_id
      ORDER BY vc.email_count DESC
      LIMIT 20
    `);
    console.log("\n--- Top 20 Recruiter Contacts ---");
    for (const r of topContacts.rows) {
      console.log(`  ${r.email.padEnd(45)} ${String(r.email_count).padStart(4)} emails  (${r.name || "?"})`);
    }

    // Top client companies
    const topClients = await client.query(`
      SELECT domain, name, email_count
      FROM client_company
      ORDER BY email_count DESC
      LIMIT 15
    `);
    console.log("\n--- Top 15 Client Companies ---");
    topClients.rows.forEach((r, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${(r.name || r.domain).padEnd(35)} ${String(r.email_count).padStart(5)} emails  (${r.domain})`);
    });

    // Consultant stats
    const consultantSkills = await client.query(`
      SELECT skill, COUNT(*) as cnt
      FROM consultant, unnest(primary_skills) as skill
      GROUP BY skill ORDER BY cnt DESC LIMIT 15
    `);
    console.log("\n--- Top 15 Consultant Skills ---");
    for (const r of consultantSkills.rows) {
      console.log(`  ${r.skill.padEnd(20)} ${r.cnt}`);
    }

    // Req signal stats
    const reqSkills = await client.query(`
      SELECT skill, COUNT(*) as cnt
      FROM vendor_req_signal, unnest(skills) as skill
      GROUP BY skill ORDER BY cnt DESC LIMIT 15
    `);
    console.log("\n--- Top 15 Skills in Demand (from Req Signals) ---");
    for (const r of reqSkills.rows) {
      console.log(`  ${r.skill.padEnd(20)} ${r.cnt}`);
    }

    // Employment type breakdown
    const empTypes = await client.query(`
      SELECT employment_type, COUNT(*) as cnt
      FROM vendor_req_signal
      WHERE employment_type IS NOT NULL
      GROUP BY employment_type ORDER BY cnt DESC
    `);
    console.log("\n--- Employment Types in Reqs ---");
    for (const r of empTypes.rows) {
      console.log(`  ${r.employment_type.padEnd(12)} ${r.cnt}`);
    }

    // Grand totals
    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM raw_email_message) as total_emails,
        (SELECT COUNT(DISTINCT mailbox_email) FROM raw_email_message) as mailboxes,
        (SELECT COUNT(DISTINCT from_email) FROM raw_email_message) as unique_senders,
        (SELECT COUNT(*) FROM vendor_company) as vendor_companies,
        (SELECT COUNT(*) FROM vendor_contact) as vendor_contacts,
        (SELECT COUNT(*) FROM client_company) as client_companies,
        (SELECT COUNT(*) FROM client_contact) as client_contacts,
        (SELECT COUNT(*) FROM consultant) as consultants,
        (SELECT COUNT(*) FROM vendor_req_signal) as req_signals,
        (SELECT COUNT(*) FROM raw_email_message WHERE subject ILIKE '%c2c%') as c2c_emails,
        (SELECT COUNT(*) FROM raw_email_message WHERE subject ILIKE '%w2%') as w2_emails
    `);
    const t = totals.rows[0];
    console.log("\n═══════════════════════════════════");
    console.log("         GRAND TOTALS");
    console.log("═══════════════════════════════════");
    console.log(`  Total emails ingested:  ${t.total_emails}`);
    console.log(`  Mailboxes synced:       ${t.mailboxes}`);
    console.log(`  Unique senders:         ${t.unique_senders}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  Vendor companies:       ${t.vendor_companies}`);
    console.log(`  Vendor contacts:        ${t.vendor_contacts}`);
    console.log(`  Client companies:       ${t.client_companies}`);
    console.log(`  Client contacts:        ${t.client_contacts}`);
    console.log(`  Consultants:            ${t.consultants}`);
    console.log(`  Req signals:            ${t.req_signals}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  C2C emails:             ${t.c2c_emails}`);
    console.log(`  W2 emails:              ${t.w2_emails}`);
    console.log("═══════════════════════════════════\n");
  } finally {
    client.release();
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  MAIL INTELLIGENCE — FULL EXTRACTION RUN    ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  console.log(`  Started: ${new Date().toISOString()}`);

  const emailCount = await pool.query("SELECT COUNT(*) FROM raw_email_message");
  console.log(`  Emails to process: ${emailCount.rows[0].count}\n`);

  // Step 1: Classify every email
  await classifyAllEmails(pool);

  // Step 2: Extract vendors (from non-free, non-internal, non-system senders)
  await extractVendors(pool);

  // Step 3: Extract consultants (from resume-like emails)
  await extractConsultants(pool);

  // Step 4: Extract clients (from CLIENT-classified emails)
  await extractClients(pool);

  // Step 5: Extract req signals (from VENDOR_REQ emails)
  await extractReqSignals(pool);

  // Step 6: Report
  await runReport(pool);

  console.log(`  Finished: ${new Date().toISOString()}`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
