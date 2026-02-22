/**
 * Actionability score (0-100) — measures whether we can actually place
 * a candidate on a job through our C2C/W2 staffing pipeline.
 *
 * Separate from realness (which measures "is this job real and fresh?").
 * Actionability focuses on staffing-specific signals: vendor mapping,
 * employment type, recruiter contact, rate, and blocking language.
 */

export interface ActionabilityInput {
  title: string;
  company: string;
  description: string;
  location: string | null | undefined;
  employmentType: string;
  negativeSignals: string[];
  recruiterEmail: string | null | undefined;
  recruiterName: string | null | undefined;
  hourlyRateMin: number | null | undefined;
  hourlyRateMax: number | null | undefined;
  rateText: string | null | undefined;
  applyUrl: string | null | undefined;
  urlStatus: string | null | undefined;
  matchedVendorId: string | null | undefined;
  classificationConfidence: number;
  companyDomain: string | null | undefined;
  realnessScore: number | null | undefined;
}

export interface ActionabilityResult {
  score: number; // 0-100
  reasons: string[];
}

const C2C_BLOCKING_SIGNALS = ['NO C2C', 'No vendors', 'No third party'];
const DIRECT_HIRE_SIGNALS = ['W2 only', 'Direct hire only'];

function hasNegativeSignal(signals: string[], candidates: string[]): boolean {
  const normalized = new Set(signals.map((s) => s.trim()));
  return candidates.some((c) => normalized.has(c));
}

function isC2CType(type: string): boolean {
  return type === 'C2C';
}

function isStaffingFriendlyType(type: string): boolean {
  return type === 'C2C' || type === 'W2_1099';
}

function isHourlyRateInGoodRange(
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  const hourlyMin = min ?? max;
  const hourlyMax = max ?? min;
  if (hourlyMin == null && hourlyMax == null) return false;
  const lo = Math.min(hourlyMin ?? 0, hourlyMax ?? 0);
  const hi = Math.max(hourlyMin ?? 0, hourlyMax ?? 0);
  return lo <= 150 && hi >= 30;
}

function hasRateInfo(input: ActionabilityInput): boolean {
  return (
    (input.hourlyRateMin != null && input.hourlyRateMin > 0) ||
    (input.hourlyRateMax != null && input.hourlyRateMax > 0) ||
    (input.rateText != null && input.rateText.length > 0)
  );
}

function hasClientInfo(input: ActionabilityInput): boolean {
  const company = (input.company ?? '').trim().toLowerCase();
  return (
    company.length > 0 &&
    !company.includes('confidential') &&
    company !== 'unknown'
  );
}

function hasLocationInfo(location: string | null | undefined): boolean {
  return location != null && location.trim().length > 3;
}

export function computeActionabilityScore(
  input: ActionabilityInput,
): ActionabilityResult {
  let score = 50; // baseline
  const reasons: string[] = [];

  // ── Strong positives ────────────────────────────────────────────

  if (input.matchedVendorId) {
    score += 20;
    reasons.push('+20 matched to known vendor (best signal)');
  }

  if (input.recruiterEmail) {
    score += 15;
    reasons.push('+15 recruiter email present');
  }

  if (isStaffingFriendlyType(input.employmentType)) {
    score += 10;
    reasons.push(`+10 employment type ${input.employmentType} (staffing-friendly)`);
  } else if (input.employmentType === 'W2') {
    score += 8;
    reasons.push('+8 employment type W2 (still actionable)');
  }

  if (isHourlyRateInGoodRange(input.hourlyRateMin, input.hourlyRateMax)) {
    score += 5;
    reasons.push('+5 hourly rate in good range ($30-$150/hr)');
  }

  if (hasLocationInfo(input.location)) {
    score += 5;
    reasons.push('+5 location is specific');
  }

  if (input.classificationConfidence >= 0.7) {
    score += 5;
    reasons.push('+5 classification confidence >= 0.7');
  }

  if (input.urlStatus === 'ALIVE') {
    score += 3;
    reasons.push('+3 apply URL alive');
  }

  const domain = (input.companyDomain ?? '').trim().toLowerCase();
  if (domain.length > 0 && !domain.includes('confidential')) {
    score += 3;
    reasons.push('+3 has company domain');
  }

  // ── Strong negatives ────────────────────────────────────────────

  if (
    isC2CType(input.employmentType) &&
    hasNegativeSignal(input.negativeSignals, C2C_BLOCKING_SIGNALS)
  ) {
    score -= 30;
    reasons.push(
      `-30 C2C type but blocking signals: ${input.negativeSignals.filter((s) =>
        C2C_BLOCKING_SIGNALS.includes(s),
      ).join(', ')}`,
    );
  }

  if (hasNegativeSignal(input.negativeSignals, DIRECT_HIRE_SIGNALS)) {
    score -= 25;
    reasons.push(
      `-25 direct-hire-only signals: ${input.negativeSignals.filter((s) =>
        DIRECT_HIRE_SIGNALS.includes(s),
      ).join(', ')}`,
    );
  }

  if (input.employmentType === 'FULLTIME') {
    score -= 15;
    reasons.push('-15 employment type FULLTIME (usually not staffing)');
  }

  const company = (input.company ?? '').trim();
  if (
    company.toLowerCase().includes('confidential') ||
    company === 'Unknown'
  ) {
    score -= 10;
    reasons.push('-10 company is confidential or Unknown');
  }

  if (
    !hasRateInfo(input) &&
    !hasClientInfo(input) &&
    !hasLocationInfo(input.location)
  ) {
    score -= 10;
    reasons.push('-10 no rate, no client, and no location (too vague to act on)');
  }

  if (input.urlStatus === 'DEAD') {
    score -= 10;
    reasons.push('-10 apply URL is dead');
  }

  if (input.description.length < 100) {
    score -= 8;
    reasons.push('-8 description very short (<100 chars)');
  }

  if (input.employmentType === 'UNKNOWN') {
    score -= 5;
    reasons.push('-5 employment type UNKNOWN');
  }

  if (
    input.realnessScore != null &&
    typeof input.realnessScore === 'number' &&
    input.realnessScore < 40
  ) {
    score -= 5;
    reasons.push(`-5 realness score low (${input.realnessScore} < 40)`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
  };
}
