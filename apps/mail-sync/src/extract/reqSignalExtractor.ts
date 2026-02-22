import { Pool } from "pg";

const REQ_SUBJECT_PATTERNS = [
  /\bc2c\b/i, /\bw2\b/i, /\bcorp[\s-]?to[\s-]?corp\b/i,
  /\brequirement\b/i, /\breq\b/i,
  /\burgent\b.*\b(need|requirement|position|role)\b/i,
  /\b(need|looking\s+for)\b.*\b(developer|engineer|architect|analyst|admin|consultant|lead|manager|specialist|tester)\b/i,
  /\brole\s*:/i, /\bposition\s*:/i, /\bjob\s*:/i,
  /\bhot\s*(req|requirement)\b/i,
  /\bhiring\b/i,
  /\bcontract\b.*\b(role|position|opportunity)\b/i,
  /\bimmediate\s+(need|start|requirement|opening|hire)\b/i,
];

const REQ_BODY_PATTERNS = [
  /\bjob\s*(title|description)\s*:/i,
  /\blocation\s*:/i,
  /\bduration\s*:/i,
  /\brate\s*:/i,
  /\bstart\s*date\s*:/i,
  /\bclient\s*:/i,
  /\binterview\s*(type|mode|process)\s*:/i,
  /\bvisa\s*(requirements?|status)\s*:/i,
  /\$/,
  /\bper\s+(hour|hr|annum|year|month|diem)\b/i,
];

const EMPLOYMENT_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\bc2c\b/i, type: "C2C" },
  { pattern: /\bcorp[\s-]?to[\s-]?corp\b/i, type: "C2C" },
  { pattern: /\bw2\b/i, type: "W2" },
  { pattern: /\b1099\b/i, type: "1099" },
  { pattern: /\bcontract\s*to\s*hire\b/i, type: "C2H" },
  { pattern: /\bc2h\b/i, type: "C2H" },
  { pattern: /\bfte\b/i, type: "FTE" },
  { pattern: /\bfull[\s-]?time\b/i, type: "FTE" },
  { pattern: /\bcontract\b/i, type: "CONTRACT" },
];

const LOCATION_REGEX = /\blocation\s*:\s*([^\n;,]{3,50})/i;
const RATE_REGEX = /\brate\s*:\s*([^\n;]{3,50})/i;
const TITLE_REGEX = /(?:title|role|position)\s*:\s*([^\n;]{3,80})/i;

const SKILL_KEYWORDS = [
  "java", "python", "javascript", "typescript", "react", "angular",
  ".net", "c#", "aws", "azure", "gcp", "docker", "kubernetes",
  "sql", "oracle", "salesforce", "sap", "servicenow",
  "spring boot", "microservices", "devops", "terraform",
  "tableau", "power bi", "snowflake", "databricks",
  "selenium", "qa", "automation", "pega", "appian",
  "mulesoft", "informatica", "cybersecurity",
  "sharepoint", "dynamics 365",
];

function isReqEmail(subject: string, body: string): boolean {
  for (const p of REQ_SUBJECT_PATTERNS) {
    if (p.test(subject)) return true;
  }
  let bodyHits = 0;
  for (const p of REQ_BODY_PATTERNS) {
    if (p.test(body)) bodyHits++;
  }
  return bodyHits >= 2;
}

function extractEmploymentType(text: string): string | null {
  for (const { pattern, type } of EMPLOYMENT_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function extractField(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_KEYWORDS) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) found.push(skill);
  }
  return [...new Set(found)];
}

function extractTitle(subject: string, body: string): string | null {
  const fromBody = extractField(body, TITLE_REGEX);
  if (fromBody) return fromBody;

  // Clean subject: remove RE:, FW:, and common prefixes
  let title = subject.replace(/^(re|fw|fwd)\s*:\s*/gi, "").trim();
  if (title.length > 5 && title.length < 120) return title;
  return null;
}

export async function extractReqSignals(pool: Pool): Promise<void> {
  console.log("\n=== Req Signal Extraction ===\n");

  const client = await pool.connect();
  try {
    // Pre-load vendor contact lookup
    const contactRows = await client.query("SELECT id, email FROM vendor_contact");
    const contactMap = new Map<string, string>();
    for (const c of contactRows.rows) contactMap.set(c.email.toLowerCase(), c.id);

    // Pre-load vendor company lookup by domain
    const companyRows = await client.query("SELECT id, domain FROM vendor_company");
    const companyMap = new Map<string, string>();
    for (const c of companyRows.rows) companyMap.set(c.domain.toLowerCase(), c.id);

    const result = await client.query(`
      SELECT id, from_email, subject, body_preview, sent_at
      FROM raw_email_message
      WHERE from_email IS NOT NULL
      ORDER BY sent_at DESC
    `);

    let detected = 0;
    let inserted = 0;

    for (const row of result.rows) {
      const subject = row.subject || "";
      const body = row.body_preview || "";
      const allText = `${subject} ${body}`;

      if (!isReqEmail(subject, body)) continue;
      detected++;

      const senderEmail = row.from_email.toLowerCase().trim();
      const domain = senderEmail.split("@")[1];

      const companyId = domain ? companyMap.get(domain) || null : null;
      const contactId = contactMap.get(senderEmail) || null;

      const title = extractTitle(subject, body);
      const location = extractField(allText, LOCATION_REGEX);
      const rateText = extractField(allText, RATE_REGEX);
      const employmentType = extractEmploymentType(allText);
      const skills = extractSkills(allText);

      await client.query(`
        INSERT INTO vendor_req_signal
          (vendor_company_id, vendor_contact_id, raw_email_id, title, location, rate_text, employment_type, skills)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [companyId, contactId, row.id, title, location, rateText, employmentType, skills]);

      inserted++;
    }

    console.log(`  Req-like emails detected: ${detected}`);
    console.log(`  Req signals stored: ${inserted}`);

    // Quick breakdown
    const typeBreakdown = await client.query(`
      SELECT employment_type, COUNT(*) as cnt
      FROM vendor_req_signal
      WHERE employment_type IS NOT NULL
      GROUP BY employment_type
      ORDER BY cnt DESC
    `);
    console.log("\n  Employment type breakdown:");
    for (const r of typeBreakdown.rows) {
      console.log(`    ${r.employment_type}: ${r.cnt}`);
    }
  } finally {
    client.release();
  }
}
