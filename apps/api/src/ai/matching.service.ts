import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AI-powered matching engine using TF-IDF cosine similarity
 * for consultant-to-job and job-to-consultant matching.
 */
@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find the best matching extracted consultants (from PST + spreadsheets)
   * for a given set of skills/requirements.
   */
  async findMatchingConsultants(params: {
    skills: string[];
    location?: string;
    limit?: number;
  }) {
    const { skills, location, limit = 20 } = params;
    if (skills.length === 0) return [];

    const normalizedSkills = skills.map((s) => s.toLowerCase().trim());

    const consultants = await this.prisma.extractedConsultant.findMany({
      where: {
        primarySkills: { isEmpty: false },
        NOT: { email: { contains: 'placeholder.local' } },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        primarySkills: true,
        sourceType: true,
        location: true,
        _count: { select: { resumeVersions: true } },
      },
    });

    const scored = consultants
      .map((c) => {
        const cSkills = c.primarySkills.map((s) => s.toLowerCase().trim());

        // Exact match scoring
        const exactMatches = normalizedSkills.filter((rs) =>
          cSkills.some((cs) => cs === rs),
        );

        // Fuzzy/partial match scoring
        const partialMatches = normalizedSkills.filter(
          (rs) =>
            !exactMatches.includes(rs) &&
            cSkills.some(
              (cs) =>
                cs.includes(rs) ||
                rs.includes(cs) ||
                levenshteinSimilarity(cs, rs) > 0.8,
            ),
        );

        // TF-IDF-style weighting: rare skills get higher weight
        const skillWeight = (skill: string) => {
          const freq = consultants.filter((c2) =>
            c2.primarySkills.some(
              (s) => s.toLowerCase().trim() === skill,
            ),
          ).length;
          return Math.log(consultants.length / Math.max(freq, 1));
        };

        let score =
          exactMatches.reduce((sum, s) => sum + skillWeight(s) * 1.0, 0) +
          partialMatches.reduce((sum, s) => sum + skillWeight(s) * 0.5, 0);

        // Normalize to 0-100
        const maxPossible = normalizedSkills.reduce(
          (sum, s) => sum + skillWeight(s),
          0,
        );
        score = maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 0;

        // Location bonus
        if (location && c.location) {
          const locMatch =
            c.location.toLowerCase().includes(location.toLowerCase()) ||
            location.toLowerCase().includes(c.location.toLowerCase());
          if (locMatch) score = Math.min(100, score + 5);
        }

        // Resume bonus (has evidence)
        if (c._count.resumeVersions > 0) score = Math.min(100, score + 3);

        return {
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          skills: c.primarySkills,
          sourceType: c.sourceType,
          location: c.location,
          resumeCount: c._count.resumeVersions,
          matchScore: score,
          matchingSkills: [
            ...exactMatches.map((s) => ({ skill: s, type: 'exact' as const })),
            ...partialMatches.map((s) => ({
              skill: s,
              type: 'partial' as const,
            })),
          ],
        };
      })
      .filter((c) => c.matchScore > 10)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return scored;
  }

  /**
   * Compute vendor trust score from historical email data.
   * Factors: email frequency, response patterns, req signal count, contact quality.
   */
  async computeVendorTrustScores() {
    const vendors = await this.prisma.extractedVendorCompany.findMany({
      include: {
        _count: {
          select: {
            contacts: true,
            reqSignals: true,
          },
        },
      },
    });

    return vendors.map((v) => {
      let score = 50; // Base score

      // Email volume signal (more emails = established relationship)
      if (v.emailCount > 100) score += 15;
      else if (v.emailCount > 50) score += 10;
      else if (v.emailCount > 20) score += 5;

      // Contact density (more contacts = larger firm)
      if (v._count.contacts > 10) score += 10;
      else if (v._count.contacts > 3) score += 5;

      // Req signal activity (sends real requirements)
      if (v._count.reqSignals > 10) score += 15;
      else if (v._count.reqSignals > 3) score += 10;
      else if (v._count.reqSignals > 0) score += 5;

      // Recency bonus
      if (v.lastSeenAt) {
        const daysSinceLastSeen = Math.floor(
          (Date.now() - v.lastSeenAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceLastSeen < 30) score += 10;
        else if (daysSinceLastSeen < 90) score += 5;
        else score -= 5;
      }

      // Domain presence (has a real domain)
      if (v.domain && !v.domain.includes('gmail') && !v.domain.includes('yahoo')) {
        score += 5;
      }

      return {
        vendorId: v.id,
        name: v.name,
        domain: v.domain,
        trustScore: Math.max(0, Math.min(100, score)),
        factors: {
          emailVolume: v.emailCount,
          contactCount: v._count.contacts,
          reqSignalCount: v._count.reqSignals,
          lastSeenAt: v.lastSeenAt,
        },
      };
    });
  }

  /**
   * Smart ranking for market jobs: combine realness + actionability + skill relevance.
   */
  async rankMarketJobsForPod(pod: string, skills: string[], limit = 50) {
    const jobs = await this.prisma.marketJob.findMany({
      where: {
        status: 'ACTIVE',
        employmentType: { in: ['C2C', 'CONTRACT', 'W2'] },
      },
      orderBy: { realnessScore: 'desc' },
      take: limit * 3,
    });

    const normalizedSkills = skills.map((s) => s.toLowerCase());

    const ranked = jobs
      .map((job) => {
        const jobSkills = Array.isArray(job.skills)
          ? (job.skills as string[]).map((s) => s.toLowerCase())
          : [];
        const titleLower = job.title.toLowerCase();
        const descLower = (job.description ?? '').toLowerCase();

        // Skill match
        let skillScore = 0;
        for (const skill of normalizedSkills) {
          if (jobSkills.some((js) => js.includes(skill) || skill.includes(js)))
            skillScore += 20;
          else if (titleLower.includes(skill) || descLower.includes(skill))
            skillScore += 10;
        }
        skillScore = Math.min(100, skillScore);

        // Combined score
        const combinedScore = Math.round(
          (job.realnessScore ?? 50) * 0.3 +
            (job.actionabilityScore ?? 50) * 0.3 +
            skillScore * 0.4,
        );

        return { ...job, skillScore, combinedScore };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    return ranked;
  }
}

/**
 * Levenshtein similarity (0 to 1) for fuzzy string matching.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1]!;
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]!) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }

  return (longer.length - (costs[shorter.length] ?? 0)) / longer.length;
}
