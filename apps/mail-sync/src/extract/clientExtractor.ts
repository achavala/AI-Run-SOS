import { Pool } from "pg";

function getDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

function guessCompanyName(domain: string): string {
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function extractClients(pool: Pool): Promise<void> {
  console.log("\n=== Client Extraction ===\n");

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT from_email, from_name,
             MIN(sent_at) as first_seen, MAX(sent_at) as last_seen,
             COUNT(*) as cnt
      FROM raw_email_message
      WHERE category = 'CLIENT'
        AND from_email IS NOT NULL AND from_email != ''
      GROUP BY from_email, from_name
      ORDER BY cnt DESC
    `);

    let companies = 0;
    let contacts = 0;

    for (const row of result.rows) {
      const email = row.from_email.toLowerCase().trim();
      const domain = getDomain(email);
      if (!domain) continue;

      const companyResult = await client.query(`
        INSERT INTO client_company (domain, name, email_count, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (domain) DO UPDATE SET
          email_count = client_company.email_count + $3,
          first_seen = LEAST(client_company.first_seen, $4),
          last_seen = GREATEST(client_company.last_seen, $5)
        RETURNING id
      `, [domain, guessCompanyName(domain), parseInt(row.cnt), row.first_seen, row.last_seen]);

      const companyId = companyResult.rows[0].id;
      companies++;

      await client.query(`
        INSERT INTO client_contact (client_company_id, name, email, email_count, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(NULLIF($2, ''), client_contact.name),
          email_count = client_contact.email_count + $4,
          first_seen = LEAST(client_contact.first_seen, $5),
          last_seen = GREATEST(client_contact.last_seen, $6)
      `, [companyId, row.from_name || null, email, parseInt(row.cnt), row.first_seen, row.last_seen]);

      contacts++;
    }

    const companyCount = await client.query("SELECT COUNT(*) FROM client_company");
    const contactCount = await client.query("SELECT COUNT(*) FROM client_contact");

    console.log(`  Client companies: ${companyCount.rows[0].count}`);
    console.log(`  Client contacts:  ${contactCount.rows[0].count}`);
  } finally {
    client.release();
  }
}
