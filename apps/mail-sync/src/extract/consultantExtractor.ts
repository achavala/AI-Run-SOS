import { Pool } from "pg";

const RESUME_SUBJECT_PATTERNS = [
  /resume/i, /\bcv\b/i, /profile/i,
  /submission/i, /candidate/i,
  /available\s+(for|immediately)/i,
  /bench/i, /hotlist/i,
  /looking\s+for\s+(a\s+)?project/i,
];

const RESUME_BODY_PATTERNS = [
  /attached\s+resume/i, /please\s+find\s+(attached\s+)?resume/i,
  /pfa\s+resume/i, /resume\s+attached/i,
  /please\s+find\s+(the\s+)?cv/i,
  /years?\s+of\s+experience/i,
  /available\s+(on|for|from|immediately)/i,
  /visa\s+status/i, /work\s+authorization/i,
  /\b(h1b|h-1b|opt|cpt|gc|green\s+card|ead|tn\s+visa|l2\s+ead)\b/i,
  /current\s+location/i, /relocation/i,
];

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SKILL_KEYWORDS = [
  "java", "python", "javascript", "typescript", "react", "angular", "vue",
  "node", "nodejs", "node.js", ".net", "c#", "c++", "go", "golang", "rust",
  "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform",
  "jenkins", "ci/cd", "devops", "linux", "sql", "nosql", "mongodb",
  "postgresql", "mysql", "oracle", "redis", "kafka", "rabbitmq",
  "spring", "spring boot", "microservices", "rest", "graphql",
  "salesforce", "sap", "servicenow", "workday", "peoplesoft",
  "tableau", "power bi", "snowflake", "databricks", "spark",
  "machine learning", "ai", "data science", "etl",
  "selenium", "cypress", "qa", "testing", "automation",
  "scrum", "agile", "jira", "confluence",
  "html", "css", "sass", "webpack", "nextjs", "next.js",
  "swift", "kotlin", "flutter", "react native",
  "pega", "appian", "mulesoft", "informatica", "talend",
  "security", "cybersecurity", "soc", "siem",
  "network", "cisco", "vmware", "active directory",
  "sharepoint", "dynamics 365", "power platform",
];

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const skill of SKILL_KEYWORDS) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) {
      found.push(skill);
    }
  }
  return [...new Set(found)];
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map(m => m.replace(/[^\d+]/g, "")))];
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches.map(e => e.toLowerCase()))];
}

function isResumeEmail(subject: string, body: string): boolean {
  for (const p of RESUME_SUBJECT_PATTERNS) {
    if (p.test(subject)) return true;
  }
  for (const p of RESUME_BODY_PATTERNS) {
    if (p.test(body)) return true;
  }
  return false;
}

function guessName(fromName: string | null, subject: string): string | null {
  if (fromName && fromName.trim().length > 1) {
    const cleaned = fromName.replace(/['"<>]/g, "").trim();
    if (cleaned.length > 1 && !cleaned.includes("@")) return cleaned;
  }

  // Try extracting from subject: "Resume - John Smith" or "John Smith - Java Developer"
  const nameFromSubject = subject.match(
    /(?:resume|cv|profile|submission)\s*[-–:]\s*([A-Z][a-z]+ [A-Z][a-z]+)/i
  );
  if (nameFromSubject) return nameFromSubject[1];

  return null;
}

export async function extractConsultants(pool: Pool): Promise<void> {
  console.log("\n=== Consultant Extraction ===\n");

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, from_email, from_name, subject, body_preview, sent_at
      FROM raw_email_message
      WHERE from_email IS NOT NULL
      ORDER BY sent_at DESC
    `);

    let detected = 0;
    let inserted = 0;

    for (const row of result.rows) {
      const subject = row.subject || "";
      const body = row.body_preview || "";

      if (!isResumeEmail(subject, body)) continue;
      detected++;

      const allText = `${subject} ${body}`;
      const emails = extractEmails(allText);
      const phones = extractPhones(allText);
      const skills = extractSkills(allText);
      const name = guessName(row.from_name, subject);

      // Use the sender email as primary, or first found email
      const consultantEmail = row.from_email.toLowerCase().trim();

      const res = await client.query(`
        INSERT INTO consultant (full_name, email, phone, primary_skills, source_email_id, first_seen, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        ON CONFLICT (email) DO UPDATE SET
          full_name = COALESCE(NULLIF($1, ''), consultant.full_name),
          phone = COALESCE(NULLIF($3, ''), consultant.phone),
          primary_skills = (
            SELECT ARRAY(SELECT DISTINCT unnest(consultant.primary_skills || $4::text[]))
          ),
          last_seen = GREATEST(consultant.last_seen, $6)
        RETURNING id
      `, [
        name,
        consultantEmail,
        phones[0] || null,
        skills,
        row.id,
        row.sent_at,
      ]);

      if (res.rowCount && res.rowCount > 0) inserted++;
    }

    const totalCount = await client.query("SELECT COUNT(*) FROM consultant");

    console.log(`  Resume-like emails detected: ${detected}`);
    console.log(`  Consultant records upserted: ${inserted}`);
    console.log(`  Total consultants in DB: ${totalCount.rows[0].count}`);
  } finally {
    client.release();
  }
}
