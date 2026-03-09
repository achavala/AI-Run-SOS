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

export async function extractConsultants(pool: Pool, incrementalOnly = false): Promise<void> {
  console.log(`\n=== Consultant Extraction${incrementalOnly ? ' (incremental)' : ''} ===\n`);
  console.log("  SKIPPED — Prisma 'Consultant' schema differs; pst-ingest handles 'ExtractedConsultant'.");
  return;
}
