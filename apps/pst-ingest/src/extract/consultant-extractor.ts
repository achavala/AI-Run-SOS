import * as fs from 'fs';
import * as path from 'path';
import prisma from '../db';

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const RESUME_FILENAME_PATTERNS = /resume|cv/i;
const RESUME_EXTENSIONS = /\.(pdf|doc|docx)$/i;
const NON_RESUME_PATTERNS = /invoice|timesheet|contract|agreement|nda/i;

const TECH_SKILLS = [
  'Java',
  'Python',
  'AWS',
  'Azure',
  'React',
  'Angular',
  'Node',
  '.NET',
  'C#',
  'SQL',
  'Snowflake',
  'Databricks',
  'Kubernetes',
  'Docker',
  'Terraform',
  'DevOps',
  'JavaScript',
  'TypeScript',
  'Go',
  'Scala',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'MongoDB',
  'PostgreSQL',
  'Redis',
  'Elasticsearch',
  'Kafka',
  'Spark',
  'Hadoop',
  'Machine Learning',
  'Tableau',
  'Power BI',
  'Jenkins',
  'Git',
  'CI/CD',
  'REST API',
  'GraphQL',
  'Microservices',
  'Spring Boot',
  'Django',
  'Flask',
  'FastAPI',
  'Express',
  'Vue',
  'Svelte',
  'Redux',
  'NoSQL',
  'Linux',
  'Ansible',
  'Prometheus',
  'Grafana',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
const CITY_STATE_REGEX = /([A-Za-z\s]+,\s*[A-Z]{2})(?:\s+\d{5})?/;

function isResumeAttachment(filename: string | null): boolean {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  if (RESUME_FILENAME_PATTERNS.test(filename)) return true;
  if (!RESUME_EXTENSIONS.test(filename)) return false;
  if (NON_RESUME_PATTERNS.test(filename)) return false;
  return true;
}

function extractSkills(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const skill of TECH_SKILLS) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) found.add(skill);
  }
  return Array.from(found);
}

function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  const hasSpecial = /[@#$%^&*()\[\]{}|\\;:'",.<>?/]/.test(trimmed);
  if (hasSpecial) return false;
  const allCapitalized = words.every((w) => /^[A-Z]/.test(w) || /^[a-z]/.test(w));
  return allCapitalized;
}

function sanitizeText(text: string): string {
  // Remove null bytes and other problematic characters that Postgres can't handle
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

async function extractTextFromFile(storagePath: string, filename: string): Promise<string | null> {
  const ext = path.extname(filename || '').toLowerCase();
  const fullPath = path.isAbsolute(storagePath) ? storagePath : path.resolve(process.cwd(), storagePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const buf = fs.readFileSync(fullPath);

  if (ext === '.pdf') {
    try {
      const data = await pdfParse(buf);
      return data?.text ? sanitizeText(data.text) : null;
    } catch {
      return null;
    }
  }

  if (ext === '.docx' || ext === '.doc') {
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result?.value ? sanitizeText(result.value) : null;
    } catch {
      return null;
    }
  }

  return null;
}

function parseResumeText(text: string): {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  skills: string[];
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let location: string | null = null;

  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) email = emailMatch[0];

  const phoneMatch = text.match(PHONE_REGEX);
  if (phoneMatch) phone = phoneMatch[0];

  const locMatch = text.match(CITY_STATE_REGEX);
  if (locMatch) location = locMatch[1].trim();

  for (const line of lines.slice(0, 15)) {
    if (!name && looksLikeName(line)) {
      name = line;
      break;
    }
  }

  const skills = extractSkills(text);
  return { name, email, phone, location, skills };
}

export async function extractConsultants(): Promise<{ consultants: number; resumes: number }> {
  let consultantsCreated = 0;
  let resumesProcessed = 0;
  let processed = 0;

  const attachments = await prisma.rawEmailAttachment.findMany({
    where: { filename: { not: null } },
    orderBy: { id: 'asc' },
  });

  const resumeAttachments = attachments.filter((a) => isResumeAttachment(a.filename));

  for (const att of resumeAttachments) {
    try {
      if (!att.sha256) continue;

      const existingResume = await prisma.extractedResumeVersion.findFirst({
        where: { sha256: att.sha256 },
      });
      if (existingResume) continue;

      const text = await extractTextFromFile(att.storagePath, att.filename ?? '');
      if (!text || text.length < 50) continue;

      const parsed = parseResumeText(text);
      const { name, email, phone, location, skills } = parsed;

      const upsertEmail = email ?? `resume-${att.sha256.slice(0, 12)}@placeholder.local`;
      const existingConsultant = await prisma.extractedConsultant.findUnique({
        where: { email: upsertEmail },
      });
      const mergedSkills = existingConsultant
        ? Array.from(new Set([...existingConsultant.primarySkills, ...skills]))
        : skills;

      const consultant = await prisma.extractedConsultant.upsert({
        where: { email: upsertEmail },
        create: {
          fullName: name,
          email: upsertEmail,
          phone,
          location,
          primarySkills: skills,
          lastSeenAt: new Date(),
        },
        update: {
          fullName: name ?? undefined,
          phone: phone ?? undefined,
          location: location ?? undefined,
          primarySkills: mergedSkills,
          lastSeenAt: new Date(),
        },
      });

      if (!existingConsultant) consultantsCreated++;

      try {
        await prisma.extractedResumeVersion.create({
          data: {
            consultantId: consultant.id,
            sha256: att.sha256 ?? 'unknown',
            filename: att.filename,
            storagePath: att.storagePath,
            extractedText: text ? text.slice(0, 5000) : null,
          },
        });
        resumesProcessed++;
      } catch (resumeErr: any) {
        if (resumeErr?.message?.includes('Unique constraint')) {
          resumesProcessed++;
        } else {
          console.error(`[consultant-extractor] Resume create error for ${att.id}: ${String(resumeErr?.message ?? resumeErr).slice(0, 200)}`);
        }
      }

      const facts: { entityType: string; entityId: string; field: string; value: string }[] = [];
      if (name) facts.push({ entityType: 'consultant', entityId: consultant.id, field: 'fullName', value: name });
      if (email) facts.push({ entityType: 'consultant', entityId: consultant.id, field: 'email', value: email });
      if (phone) facts.push({ entityType: 'consultant', entityId: consultant.id, field: 'phone', value: phone });
      if (location) facts.push({ entityType: 'consultant', entityId: consultant.id, field: 'location', value: location });

      for (const f of facts) {
        await prisma.extractionFact.create({
          data: {
            ...f,
            confidence: 0.7,
            sourceAttachmentId: att.id,
          },
        });
      }

      if (skills.length > 0) {
        await prisma.extractionFact.create({
          data: {
            entityType: 'consultant',
            entityId: consultant.id,
            field: 'skills',
            value: skills.join(', '),
            confidence: 0.6,
            sourceAttachmentId: att.id,
          },
        });
      }

      processed++;
      if (processed % 50 === 0) {
        console.log(`[consultant-extractor] Processed ${processed}/${resumeAttachments.length} resumes, consultants: ${consultantsCreated}`);
      }
    } catch (err) {
      console.error(`[consultant-extractor] Error processing attachment ${att.id}:`, err);
    }
  }

  console.log(`[consultant-extractor] Done. Consultants created: ${consultantsCreated}, Resumes processed: ${resumesProcessed}`);
  return { consultants: consultantsCreated, resumes: resumesProcessed };
}
