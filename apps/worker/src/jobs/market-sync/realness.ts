/**
 * Realness score (0-100) — rules-based scoring that evaluates
 * how "actionable" a market job is for staffing submissions.
 *
 * Strong positives: recruiter contact, detailed info, freshness
 * Strong negatives: missing info, stale, "confidential", harvest signals
 */

interface RealnessInput {
  title: string;
  company: string;
  description: string;
  location: string | null | undefined;
  employmentType: string;
  negativeSignals: string[];
  recruiterEmail: string | null | undefined;
  recruiterName: string | null | undefined;
  recruiterPhone: string | null | undefined;
  hourlyRateMin: number | null | undefined;
  hourlyRateMax: number | null | undefined;
  rateText: string | null | undefined;
  sourcePostedAt: Date | null | undefined;
  postedAt: Date | null | undefined;
  applyUrl: string | null | undefined;
  urlStatus: string | null | undefined;
  classificationConfidence: number;
}

interface RealnessResult {
  score: number;
  reasons: string[];
}

export function computeRealnessScore(input: RealnessInput): RealnessResult {
  let score = 50; // baseline
  const reasons: string[] = [];

  // ── Positive signals ──────────────────────────

  if (input.recruiterEmail) {
    score += 15;
    reasons.push('+15 recruiter email present');
  }
  if (input.recruiterName) {
    score += 5;
    reasons.push('+5 recruiter name present');
  }
  if (input.recruiterPhone) {
    score += 5;
    reasons.push('+5 recruiter phone present');
  }

  if (input.location && input.location.length > 3) {
    score += 5;
    reasons.push('+5 location specified');
  }

  if (input.hourlyRateMin || input.hourlyRateMax || input.rateText) {
    score += 8;
    reasons.push('+8 compensation info present');
  }

  if (input.description.length > 500) {
    score += 5;
    reasons.push('+5 detailed description (>500 chars)');
  }

  if (input.classificationConfidence >= 0.7) {
    score += 5;
    reasons.push('+5 high classification confidence');
  }

  // Freshness based on source timestamp
  const refDate = input.sourcePostedAt ?? input.postedAt;
  if (refDate) {
    const hoursAgo = (Date.now() - new Date(refDate).getTime()) / 3600000;
    if (hoursAgo <= 6) {
      score += 10;
      reasons.push('+10 posted within 6 hours');
    } else if (hoursAgo <= 24) {
      score += 7;
      reasons.push('+7 posted within 24 hours');
    } else if (hoursAgo <= 72) {
      score += 3;
      reasons.push('+3 posted within 3 days');
    }
  }

  if (input.applyUrl) {
    score += 3;
    reasons.push('+3 apply URL present');
  }

  if (input.urlStatus === 'ALIVE') {
    score += 5;
    reasons.push('+5 apply URL verified alive');
  }

  // ── Negative signals ──────────────────────────

  if (input.negativeSignals.length > 0) {
    const penalty = Math.min(input.negativeSignals.length * 8, 25);
    score -= penalty;
    reasons.push(`-${penalty} negative signals: ${input.negativeSignals.join(', ')}`);
  }

  if (input.company.toLowerCase().includes('confidential') || input.company === 'Unknown') {
    score -= 10;
    reasons.push('-10 confidential/unknown company');
  }

  // Harvest detection: super-generic postings
  const harvestPatterns = [
    /\bimmediately?\s+hiring\b/i,
    /\bwe\s+are\s+looking\s+for\s+multiple\b/i,
    /\b(?:urgent|asap|immediate)\s+(?:need|opening|start)\b/i,
  ];
  const harvestCount = harvestPatterns.filter((p) => p.test(input.description)).length;
  if (harvestCount >= 2) {
    score -= 10;
    reasons.push('-10 possible resume harvesting signals');
  }

  if (input.urlStatus === 'DEAD') {
    score -= 20;
    reasons.push('-20 apply URL is dead');
  }

  if (input.urlStatus === 'REDIRECT') {
    score -= 5;
    reasons.push('-5 apply URL redirects (may be closed)');
  }

  if (!refDate) {
    score -= 5;
    reasons.push('-5 no posted date available');
  } else {
    const daysOld = (Date.now() - new Date(refDate).getTime()) / 86400000;
    if (daysOld > 7) {
      score -= 8;
      reasons.push('-8 posting older than 7 days');
    }
  }

  if (input.description.length < 100) {
    score -= 8;
    reasons.push('-8 very short description (<100 chars)');
  }

  if (input.employmentType === 'UNKNOWN') {
    score -= 5;
    reasons.push('-5 unknown employment type');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}
