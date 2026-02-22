/**
 * Employment type classifier — parses job descriptions to detect
 * C2C, W2, 1099, and other contract types.
 *
 * Key design rule: NEGATIVE signals override positives.
 * "NO C2C" beats "C2C" because submitting C2C candidates to
 * W2-only reqs is the most expensive mistake.
 */

import { createHash } from 'crypto';

export type EmploymentClassification =
  | 'C2C'
  | 'W2'
  | 'W2_1099'
  | 'FULLTIME'
  | 'PARTTIME'
  | 'CONTRACT'
  | 'UNKNOWN';

export type CompPeriodType = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'UNKNOWN';

export interface ClassificationResult {
  type: EmploymentClassification;
  confidence: number;
  matchedKeywords: string[];
  negativeSignals: string[];
}

export interface RateResult {
  rateText: string | null;
  min?: number;
  max?: number;
  compPeriod: CompPeriodType;
  hourlyMin?: number;
  hourlyMax?: number;
}

// ── Negative signals: these OVERRIDE positive matches ──────────────

const NEGATIVE_PATTERNS: Array<{ pattern: RegExp; blocks: EmploymentClassification[]; label: string }> = [
  { pattern: /\bno\s+C2C\b/i, blocks: ['C2C'], label: 'NO C2C' },
  { pattern: /\bnot?\s+(?:accept(?:ing)?|open\s+to)\s+C2C\b/i, blocks: ['C2C'], label: 'Not accepting C2C' },
  { pattern: /\bno\s+(?:sub[\s-]?)?vendors?\b/i, blocks: ['C2C'], label: 'No vendors' },
  { pattern: /\bno\s+(?:third|3rd)[\s-]?part(?:y|ies)\b/i, blocks: ['C2C'], label: 'No third party' },
  { pattern: /\bno\s+sub[\s-]?contract(?:ing|ors?)?\b/i, blocks: ['C2C'], label: 'No subcontracting' },
  { pattern: /\bW[\s-]?2\s+only\b/i, blocks: ['C2C', 'W2_1099'], label: 'W2 only' },
  { pattern: /\bdirect[\s-]?hire\s+only\b/i, blocks: ['C2C', 'W2_1099', 'CONTRACT'], label: 'Direct hire only' },
  { pattern: /\bno\s+(?:agencies|staffing|recruiters)\b/i, blocks: ['C2C'], label: 'No agencies' },
  { pattern: /\bno\s+1099\b/i, blocks: ['W2_1099'], label: 'NO 1099' },
  { pattern: /\bno\s+corp[\s-]?to[\s-]?corp\b/i, blocks: ['C2C'], label: 'No corp-to-corp' },
];

// ── Positive signals ───────────────────────────────────────────────

const POSITIVE_PATTERNS: Record<EmploymentClassification, Array<{ pattern: RegExp; weight: number }>> = {
  C2C: [
    { pattern: /\bC2C\b/i, weight: 1.0 },
    { pattern: /\bcorp[\s-]?to[\s-]?corp\b/i, weight: 1.0 },
    { pattern: /\bcorporation[\s-]to[\s-]corporation\b/i, weight: 1.0 },
    { pattern: /\bC2C\s*\/\s*1099\b/i, weight: 0.9 },
    { pattern: /\bsub[\s-]?contract(?:or)?\b/i, weight: 0.6 },
    { pattern: /\bsub[\s-]?vendor\b/i, weight: 0.7 },
    { pattern: /\bindependent.*contractor\b/i, weight: 0.5 },
    { pattern: /\b(?:third[\s-]?party|3rd[\s-]?party).*vendor\b/i, weight: 0.5 },
  ],
  W2: [
    { pattern: /\bW[\s-]?2\b(?!\s*[\/&,]\s*(?:C2C|1099))/i, weight: 1.0 },
    { pattern: /\bW-2\s+contract\b/i, weight: 0.9 },
    { pattern: /\bw2\s+hourly\b/i, weight: 0.9 },
  ],
  W2_1099: [
    { pattern: /\bW[\s-]?2\s*[\/&,]\s*1099\b/i, weight: 1.0 },
    { pattern: /\b1099\s*[\/&,]\s*W[\s-]?2\b/i, weight: 1.0 },
    { pattern: /\bW2\s*[\/&,]\s*C2C\s*[\/&,]\s*1099\b/i, weight: 0.9 },
    { pattern: /\bC2C\s*[\/&,]\s*W2\b/i, weight: 0.8 },
    { pattern: /\b1099\b/i, weight: 0.5 },
  ],
  FULLTIME: [
    { pattern: /\bfull[\s-]?time\b/i, weight: 0.8 },
    { pattern: /\bFTE\b/, weight: 0.8 },
    { pattern: /\bpermanent\b/i, weight: 0.7 },
    { pattern: /\bdirect[\s-]?hire\b/i, weight: 0.9 },
    { pattern: /\bsalaried\b/i, weight: 0.6 },
  ],
  PARTTIME: [
    { pattern: /\bpart[\s-]?time\b/i, weight: 0.9 },
  ],
  CONTRACT: [
    { pattern: /\bcontract\b/i, weight: 0.4 },
    { pattern: /\bcontract[\s-]?to[\s-]?hire\b/i, weight: 0.6 },
    { pattern: /\bC2H\b/i, weight: 0.6 },
    { pattern: /\bCTH\b/i, weight: 0.6 },
    { pattern: /\bcontract[\s-]?to[\s-]?perm\b/i, weight: 0.6 },
    { pattern: /\btemp[\s-]?to[\s-]?perm\b/i, weight: 0.5 },
    { pattern: /\bfreelance\b/i, weight: 0.5 },
    { pattern: /\bhourly\s+rate\b/i, weight: 0.3 },
  ],
  UNKNOWN: [],
};

export function classifyEmploymentType(text: string): ClassificationResult {
  if (!text || text.length === 0) {
    return { type: 'UNKNOWN', confidence: 0, matchedKeywords: [], negativeSignals: [] };
  }

  // Step 1: Collect negative signals
  const blockedTypes = new Set<EmploymentClassification>();
  const negativeSignals: string[] = [];

  for (const { pattern, blocks, label } of NEGATIVE_PATTERNS) {
    if (pattern.test(text)) {
      negativeSignals.push(label);
      for (const b of blocks) blockedTypes.add(b);
    }
  }

  // Step 2: Score positive signals
  const scores: Record<EmploymentClassification, { score: number; matches: string[] }> = {
    C2C: { score: 0, matches: [] },
    W2: { score: 0, matches: [] },
    W2_1099: { score: 0, matches: [] },
    FULLTIME: { score: 0, matches: [] },
    PARTTIME: { score: 0, matches: [] },
    CONTRACT: { score: 0, matches: [] },
    UNKNOWN: { score: 0, matches: [] },
  };

  for (const [type, patterns] of Object.entries(POSITIVE_PATTERNS) as Array<[EmploymentClassification, typeof POSITIVE_PATTERNS.C2C]>) {
    // Skip types that are negated
    if (blockedTypes.has(type)) continue;

    for (const { pattern, weight } of patterns) {
      const match = text.match(pattern);
      if (match) {
        scores[type].score += weight;
        scores[type].matches.push(match[0]);
      }
    }
  }

  // C2C + W2 combo → W2_1099 (only if neither is blocked)
  if (!blockedTypes.has('W2_1099') && scores.C2C.score > 0.5 && scores.W2.score > 0.5) {
    scores.W2_1099.score = Math.max(scores.W2_1099.score, scores.C2C.score + scores.W2.score);
    scores.W2_1099.matches = [...new Set([...scores.W2_1099.matches, ...scores.C2C.matches, ...scores.W2.matches])];
  }

  // If "W2 only" is a negative signal, boost W2 as the positive result
  if (negativeSignals.includes('W2 only') && scores.W2.score === 0) {
    scores.W2.score = 1.0;
    scores.W2.matches.push('W2 only (inferred)');
  }

  let bestType: EmploymentClassification = 'UNKNOWN';
  let bestScore = 0;

  for (const [type, { score }] of Object.entries(scores) as Array<[EmploymentClassification, { score: number }]>) {
    if (type === 'UNKNOWN') continue;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  const confidence = Math.min(bestScore / 1.5, 1);

  return {
    type: bestScore > 0.3 ? bestType : 'UNKNOWN',
    confidence,
    matchedKeywords: scores[bestType]?.matches ?? [],
    negativeSignals,
  };
}

// ── Rate extraction with period normalization ──────────────────────

const HOURS_PER_YEAR = 2080;
const HOURS_PER_MONTH = 173.33;
const HOURS_PER_WEEK = 40;
const HOURS_PER_DAY = 8;

export function extractRate(text: string): RateResult {
  if (!text) return { rateText: null, compPeriod: 'UNKNOWN' };

  // Hourly: $50/hr, $50-80/hr, $50/hour, $50 per hour
  const hourlyPattern = /\$\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:[-–]\s*\$?\s*(\d{2,3}(?:\.\d{1,2})?))?\s*(?:\/\s*h(?:ou)?r|per\s+h(?:ou)?r|\s*hr)\b/i;
  const hourlyMatch = text.match(hourlyPattern);
  if (hourlyMatch) {
    const min = parseFloat(hourlyMatch[1]!);
    const max = hourlyMatch[2] ? parseFloat(hourlyMatch[2]) : undefined;
    return {
      rateText: hourlyMatch[0],
      min,
      max,
      compPeriod: 'HOUR',
      hourlyMin: min,
      hourlyMax: max,
    };
  }

  // Daily: $400/day, $400-500 per day
  const dailyPattern = /\$\s*(\d{3,4}(?:\.\d{1,2})?)\s*(?:[-–]\s*\$?\s*(\d{3,4}(?:\.\d{1,2})?))?\s*(?:\/\s*day|per\s+day)\b/i;
  const dailyMatch = text.match(dailyPattern);
  if (dailyMatch) {
    const min = parseFloat(dailyMatch[1]!);
    const max = dailyMatch[2] ? parseFloat(dailyMatch[2]) : undefined;
    return {
      rateText: dailyMatch[0],
      min,
      max,
      compPeriod: 'DAY',
      hourlyMin: min / HOURS_PER_DAY,
      hourlyMax: max ? max / HOURS_PER_DAY : undefined,
    };
  }

  // Weekly: $2000/week, $2000-3000 per week
  const weeklyPattern = /\$\s*(\d{3,5}(?:\.\d{1,2})?)\s*(?:[-–]\s*\$?\s*(\d{3,5}(?:\.\d{1,2})?))?\s*(?:\/\s*w(?:ee)?k|per\s+w(?:ee)?k)\b/i;
  const weeklyMatch = text.match(weeklyPattern);
  if (weeklyMatch) {
    const min = parseFloat(weeklyMatch[1]!);
    const max = weeklyMatch[2] ? parseFloat(weeklyMatch[2]) : undefined;
    return {
      rateText: weeklyMatch[0],
      min,
      max,
      compPeriod: 'WEEK',
      hourlyMin: min / HOURS_PER_WEEK,
      hourlyMax: max ? max / HOURS_PER_WEEK : undefined,
    };
  }

  // Annual: $100K, $100,000, $100K-$150K
  const annualPattern = /\$\s*(\d{2,3})(?:,\d{3}|[Kk])\s*(?:[-–]\s*\$?\s*(\d{2,3})(?:,\d{3}|[Kk]))?\s*(?:\/?\s*(?:year|yr|annual|per\s+(?:year|annum))|\s*(?:base|salary))?/i;
  const annualMatch = text.match(annualPattern);
  if (annualMatch) {
    let min = parseFloat(annualMatch[1]!);
    let max = annualMatch[2] ? parseFloat(annualMatch[2]) : undefined;
    if (min < 1000) min *= 1000;
    if (max && max < 1000) max *= 1000;
    return {
      rateText: annualMatch[0],
      min,
      max,
      compPeriod: 'YEAR',
      hourlyMin: min / HOURS_PER_YEAR,
      hourlyMax: max ? max / HOURS_PER_YEAR : undefined,
    };
  }

  // Monthly: $8000/month, $8000-12000 per month
  const monthlyPattern = /\$\s*(\d{3,6}(?:\.\d{1,2})?)\s*(?:[-–]\s*\$?\s*(\d{3,6}(?:\.\d{1,2})?))?\s*(?:\/\s*mo(?:nth)?|per\s+mo(?:nth)?)\b/i;
  const monthlyMatch = text.match(monthlyPattern);
  if (monthlyMatch) {
    const min = parseFloat(monthlyMatch[1]!);
    const max = monthlyMatch[2] ? parseFloat(monthlyMatch[2]) : undefined;
    return {
      rateText: monthlyMatch[0],
      min,
      max,
      compPeriod: 'MONTH',
      hourlyMin: min / HOURS_PER_MONTH,
      hourlyMax: max ? max / HOURS_PER_MONTH : undefined,
    };
  }

  return { rateText: null, compPeriod: 'UNKNOWN' };
}

// ── Skills extraction ──────────────────────────────────────────────

const SKILL_PATTERNS = [
  /\bJava\b(?!Script)/g, /\bJavaScript\b/gi, /\bTypeScript\b/gi,
  /\bPython\b/gi, /\bGo(?:lang)?\b/g, /\bRust\b/gi, /\bC\+\+\b/g,
  /\bC#\b/g, /\b\.NET\b/g, /\bRuby\b/gi, /\bScala\b/gi, /\bKotlin\b/gi,
  /\bSwift\b/gi, /\bReact(?:\.?js)?\b/gi, /\bAngular\b/gi, /\bVue(?:\.?js)?\b/gi,
  /\bNode(?:\.?js)?\b/gi, /\bDjango\b/gi, /\bFlask\b/gi, /\bSpring\s*(?:Boot)?\b/gi,
  /\bAWS\b/g, /\bAzure\b/gi, /\bGCP\b/g, /\bGoogle\s*Cloud\b/gi,
  /\bDocker\b/gi, /\bKubernetes\b/gi, /\bK8s\b/gi, /\bTerraform\b/gi,
  /\bAnsible\b/gi, /\bJenkins\b/gi, /\bCI\s*\/?\s*CD\b/gi,
  /\bSQL\b/gi, /\bPostgreSQL?\b/gi, /\bMySQL\b/gi, /\bMongoDB\b/gi,
  /\bRedis\b/gi, /\bElasticsearch\b/gi, /\bKafka\b/gi, /\bRabbitMQ\b/gi,
  /\bSnowflake\b/gi, /\bDatabricks\b/gi, /\bSpark\b/gi,
  /\bTableau\b/gi, /\bPower\s*BI\b/gi, /\bdbt\b/g, /\bAirflow\b/gi,
  /\bLinux\b/gi, /\bGraphQL\b/gi, /\bREST\s*(?:ful|API)?\b/gi,
  /\bMicroservices?\b/gi, /\bDevOps\b/gi, /\bSRE\b/g, /\bAgile\b/gi,
  /\bScrum\b/gi, /\bSOC\b/g, /\bSIEM\b/g, /\bSplunk\b/gi,
  /\bCISA\b/g, /\bCISSP\b/g, /\bPCI[\s-]?DSS\b/gi, /\bSOC\s*2\b/gi,
  /\bSalesforce\b/gi, /\bSAP\b/g, /\bServiceNow\b/gi,
  /\bPHP\b/gi, /\bLaravel\b/gi, /\bNext\.?js\b/gi,
  /\bFigma\b/gi, /\bUI\s*\/?\s*UX\b/gi,
];

export function extractSkills(title: string, description: string): string[] {
  const skills = new Set<string>();
  const combined = `${title} ${description}`;

  for (const pattern of SKILL_PATTERNS) {
    const matches = combined.match(pattern);
    if (matches) {
      for (const m of matches) skills.add(m.trim());
    }
  }

  return [...skills].slice(0, 30);
}

// ── Cross-provider fingerprint ─────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function extractDomain(url: string | undefined | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Compute a stable fingerprint for cross-provider deduplication.
 * Two listings for the same job from different boards will produce
 * the same fingerprint if title+company+location+domain+desc_prefix match.
 */
export function computeFingerprint(
  title: string,
  company: string,
  location: string | null | undefined,
  applyUrl: string | null | undefined,
  description: string,
): string {
  const parts = [
    normalize(title),
    normalize(company),
    normalize(location ?? ''),
    extractDomain(applyUrl),
    normalize(description.slice(0, 300)),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}
