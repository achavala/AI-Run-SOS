import prisma from '../db';

const BATCH_SIZE = 500;

const FREE_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'ymail.com',
  'live.com',
  'msn.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'cox.net',
  'sbcglobal.net',
  'earthlink.net',
  'charter.net',
  'emonics.com',
]);

const REQ_SUBJECT_KEYWORDS = [
  'req',
  'requirement',
  'position',
  'job',
  'opening',
  'urgent',
  'hot',
  'immediate',
  'need',
  'looking for',
  'role',
];

const RATE_PATTERN = /\$\d+([-–]\d+)?\s*\/\s*hr|C2C|W2/i;
const LOCATION_PATTERN = /(?:Location|City|State)\s*[:=]\s*([^\n\r]+)/i;
const EMPLOYMENT_PATTERNS = [
  /\bC2C\b/i,
  /\bW2\b/i,
  /\b1099\b/,
  /\bcontract\b/i,
  /\bfull[- ]?time\b/i,
  /\bpart[- ]?time\b/i,
  /\bNo\s+C2C\b/i,
  /\bCorp\s+to\s+Corp\b/i,
];
const RATE_LABEL_PATTERN = /(?:Rate|Bill Rate|Pay Rate)\s*[:=]\s*([^\n\r]+)/i;
const RATE_VALUE_PATTERN = /\$[\d,]+([-–][\d,]+)?\s*(?:\/|\s)(?:hr|hour|hourly)/gi;
const CLIENT_PATTERN = /(?:Client|End Client)\s*[:=]\s*([^\n\r]+)/i;

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

function extractDomain(email: string): string | null {
  const at = email.indexOf('@');
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
}

function stripSubjectPrefix(subject: string): string {
  return subject
    .replace(/^(RE:\s*|FW:\s*|Fwd:\s*)+/i, '')
    .trim();
}

function looksLikeReq(subject: string, bodyPrefix: string): boolean {
  const subj = subject.toLowerCase();
  const hasKeyword = REQ_SUBJECT_KEYWORDS.some((kw) => subj.includes(kw));
  if (hasKeyword) return true;
  const bodySample = bodyPrefix.slice(0, 500);
  return RATE_PATTERN.test(bodySample);
}

function extractLocation(body: string): string | null {
  const match = body.match(LOCATION_PATTERN);
  if (!match) return null;
  const val = match[1]?.trim();
  return val || null;
}

function extractEmploymentType(body: string): string | null {
  for (const re of EMPLOYMENT_PATTERNS) {
    const m = body.match(re);
    if (m) {
      const s = m[0];
      if (/No\s+C2C/i.test(s)) return 'No C2C';
      if (/\bC2C\b/i.test(s)) return 'C2C';
      if (/\bW2\b/i.test(s)) return 'W2';
      if (/\b1099\b/.test(s)) return '1099';
      if (/contract/i.test(s)) return 'Contract';
      if (/full[- ]?time/i.test(s)) return 'Full-time';
      if (/part[- ]?time/i.test(s)) return 'Part-time';
      if (/Corp\s+to\s+Corp/i.test(s)) return 'C2C';
    }
  }
  return null;
}

function extractRateText(body: string): string | null {
  const rateLabel = body.match(RATE_LABEL_PATTERN);
  if (rateLabel) {
    const val = rateLabel[1]?.trim();
    if (val) return val;
  }
  const rateVal = body.match(RATE_VALUE_PATTERN);
  return rateVal ? rateVal[0].trim() : null;
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

function extractClientHint(body: string): string | null {
  const match = body.match(CLIENT_PATTERN);
  if (!match) return null;
  const val = match[1]?.trim();
  return val || null;
}

export async function extractReqSignals(): Promise<{ signals: number }> {
  let signalsCreated = 0;
  let totalProcessed = 0;

  let cursor: string | undefined;

  while (true) {
    const emails = await prisma.rawEmailMessage.findMany({
      where: {
        processed: true,
        fromEmail: { not: null },
      },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    if (emails.length === 0) break;

    for (const email of emails) {
      try {
        const fromEmail = email.fromEmail?.trim();
        if (!fromEmail) continue;

        const domain = extractDomain(fromEmail);
        if (!domain || FREE_DOMAINS.has(domain)) continue;

        const subject = email.subject ?? '';
        const body = (email.bodyText ?? email.bodyHtml ?? '').replace(/<[^>]+>/g, ' ');
        const bodyPrefix = body.slice(0, 500);

        if (!looksLikeReq(subject, bodyPrefix)) continue;

        const existing = await prisma.vendorReqSignal.findFirst({
          where: { rawEmailId: email.id },
        });
        if (existing) continue;

        const title = stripSubjectPrefix(subject) || null;
        const location = extractLocation(body);
        const employmentType = extractEmploymentType(body);
        const rateText = extractRateText(body);
        const skills = extractSkills(subject + '\n' + body);
        const clientHint = extractClientHint(body);

        const hasTitle = !!title;
        const hasRateAndType = !!(rateText && employmentType);
        if (!hasTitle && !hasRateAndType) continue;

        const vendorCompany = domain
          ? await prisma.extractedVendorCompany.findUnique({ where: { domain } })
          : null;
        const vendorContact = await prisma.extractedVendorContact.findUnique({
          where: { email: fromEmail },
        });

        await prisma.vendorReqSignal.create({
          data: {
            vendorCompanyId: vendorCompany?.id ?? null,
            vendorContactId: vendorContact?.id ?? null,
            rawEmailId: email.id,
            title,
            location,
            employmentType,
            rateText,
            skills,
            clientHint,
          },
        });

        signalsCreated++;
      } catch (err) {
        console.error(`[req-signal-extractor] Error processing email ${email.id}:`, err);
      }
    }

    totalProcessed += emails.length;
    cursor = emails[emails.length - 1].id;
    console.log(
      `[req-signal-extractor] Processed ${totalProcessed} emails, signals created: ${signalsCreated}`
    );
  }

  console.log(`[req-signal-extractor] Done. Total signals: ${signalsCreated}`);
  return { signals: signalsCreated };
}
