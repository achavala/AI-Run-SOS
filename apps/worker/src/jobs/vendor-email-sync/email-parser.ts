/**
 * Deterministic email parser for extracting job requirements from vendor emails.
 * Regex-based, no LLM. Exports everything for testability.
 */

import {
  classifyEmploymentType,
  extractRate,
  extractSkills,
  type EmploymentClassification,
} from "../market-sync/classifier";

export interface ParsedVendorReq {
  title: string | null;
  description: string | null;
  location: string | null;
  locationType: "REMOTE" | "HYBRID" | "ONSITE" | null;
  employmentType: "C2C" | "W2" | "W2_1099" | "FULLTIME" | "CONTRACT" | "UNKNOWN";
  rateText: string | null;
  hourlyRateMin: number | null;
  hourlyRateMax: number | null;
  duration: string | null;
  clientHint: string | null;
  skills: string[];
  negativeSignals: string[];
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterPhone: string | null;
}

const SUBJECT_PREFIXES = [
  /^\s*(?:Req\.?|RE:|FW:|Fwd:|FWD:|Job:|Position:|Opening:|Requirement:|Hot\s+Req\.?)\s*/i,
];

const PHONE_PATTERNS = [
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractTitle(subject: string, body: string): string | null {
  let s = subject.trim();
  for (const re of SUBJECT_PREFIXES) {
    s = s.replace(re, "");
  }
  s = s.trim();
  if (!s) return null;

  const dashIdx = s.indexOf(" - ");
  const pipeIdx = s.indexOf(" | ");
  const sepIdx = dashIdx >= 0 && pipeIdx >= 0 ? Math.min(dashIdx, pipeIdx) : dashIdx >= 0 ? dashIdx : pipeIdx;

  if (sepIdx >= 0) {
    const first = s.slice(0, sepIdx).trim();
    if (first.length > 2) return first;
  }
  return s.length > 2 ? s : null;
}

function extractLocation(body: string): { location: string | null; locationType: "REMOTE" | "HYBRID" | "ONSITE" | null } {
  let location: string | null = null;
  let locationType: "REMOTE" | "HYBRID" | "ONSITE" | null = null;

  if (/\bremote\b/i.test(body)) locationType = "REMOTE";
  else if (/\bhybrid\b/i.test(body)) locationType = "HYBRID";
  else if (/\bonsite\b|\bon-site\b|\bin-office\b/i.test(body)) locationType = "ONSITE";

  const locationPatterns = [
    /(?:location|work\s+location|job\s+location)[:\s]+([^\n,;]+)/i,
    /(?:city|based\s+in)[:\s]+([^\n,;]+)/i,
    /onsite\s+at\s+([^\n,;]+)/i,
    /(?:located\s+in|based\s+in)\s+([^\n,;]+)/i,
  ];

  for (const re of locationPatterns) {
    const m = body.match(re);
    if (m?.[1]) {
      const loc = m[1].trim();
      if (loc.length > 1 && loc.length < 120) {
        location = loc;
        break;
      }
    }
  }

  if (!location && locationType === "REMOTE") location = "Remote";
  if (!location && locationType === "HYBRID") location = "Hybrid";

  return { location, locationType };
}

function mapEmploymentType(
  type: EmploymentClassification
): "C2C" | "W2" | "W2_1099" | "FULLTIME" | "CONTRACT" | "UNKNOWN" {
  if (type === "PARTTIME") return "UNKNOWN";
  return type;
}

function extractDuration(body: string): string | null {
  const m = body.match(
    /duration\s*[:=]?\s*(\d+\+?\s*(?:months?|weeks?|years?)|long\s*term)/i
  );
  if (m?.[1]) return m[1].trim();

  const m2 = body.match(/(\d+)\s*\+\s*(?:months?|mos?)\s*(?:contract)?/i);
  if (m2) return `${m2[1]}+ months`;

  const m3 = body.match(/(\d+)\s*(?:months?|mos?)\s*(?:contract)?/i);
  if (m3) return `${m3[1]} months`;

  if (/\blong\s*term\b/i.test(body)) return "Long term";
  return null;
}

function extractClientHint(body: string): string | null {
  const patterns = [
    /(?:end\s+)?client[:\s]+([^\n,;]+)/i,
    /company[:\s]+([^\n,;]+)/i,
    /(?:fortune\s+500|f500)\s*[:\s]*([^\n,;]+)?/i,
  ];
  for (const re of patterns) {
    const m = body.match(re);
    if (m?.[1]) {
      const hint = m[1].trim();
      if (hint.length > 1 && hint.length < 100) return hint;
    }
  }
  if (/\bfortune\s+500\b|\bf500\b/i.test(body)) return "Fortune 500";
  return null;
}

function extractSkillsFromEmail(body: string, title: string | null): string[] {
  return extractSkills(title ?? "", body);
}

function extractContactFromSignature(
  body: string,
  fromEmail: string,
  fromName: string | null
): {
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterPhone: string | null;
} {
  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const lastLines = lines.slice(-15).join("\n");

  let phone: string | null = null;
  for (const re of PHONE_PATTERNS) {
    const m = lastLines.match(re);
    if (m?.[0]) {
      phone = m[0].replace(/\s+/g, " ").trim();
      break;
    }
  }

  let email: string | null = null;
  const emailMatch = lastLines.match(EMAIL_PATTERN);
  if (emailMatch?.length) {
    const candidates = emailMatch.filter((e) => e !== fromEmail);
    email = candidates[0] ?? fromEmail;
  } else {
    email = fromEmail;
  }

  let name: string | null = fromName;
  const namePatterns = [
    /^(?:best|thanks|regards|sincerely),?\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/im,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n\s*(?:Recruiter|Technical\s+Recruiter)/im,
  ];
  for (const re of namePatterns) {
    const m = lastLines.match(re);
    if (m?.[1]) {
      name = m[1].trim();
      break;
    }
  }

  return {
    recruiterName: name,
    recruiterEmail: email,
    recruiterPhone: phone,
  };
}

export function parseVendorEmail(
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string | null
): ParsedVendorReq {
  const combined = `${subject}\n\n${body}`;
  const title = extractTitle(subject, body);
  const { location, locationType } = extractLocation(body);
  const empResult = classifyEmploymentType(combined);
  const rateResult = extractRate(combined);
  const duration = extractDuration(body);
  const clientHint = extractClientHint(body);
  const skills = extractSkillsFromEmail(body, title);
  const contact = extractContactFromSignature(body, fromEmail, fromName);

  let hourlyMin: number | null = null;
  let hourlyMax: number | null = null;
  if (rateResult.hourlyMin != null) hourlyMin = rateResult.hourlyMin;
  if (rateResult.hourlyMax != null) hourlyMax = rateResult.hourlyMax;

  return {
    title,
    description: body.trim() || null,
    location,
    locationType,
    employmentType: mapEmploymentType(empResult.type),
    rateText: rateResult.rateText,
    hourlyRateMin: hourlyMin,
    hourlyRateMax: hourlyMax,
    duration,
    clientHint,
    skills,
    negativeSignals: empResult.negativeSignals,
    recruiterName: contact.recruiterName,
    recruiterEmail: contact.recruiterEmail,
    recruiterPhone: contact.recruiterPhone,
  };
}
