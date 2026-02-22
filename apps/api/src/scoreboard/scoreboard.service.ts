import { Injectable } from '@nestjs/common';
import { Pod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScoreboardService {
  constructor(private prisma: PrismaService) {}

  async getToday(tenantId: string) {
    const today = this.todayDate();
    let board = await this.prisma.dailyScoreboard.findUnique({
      where: { tenantId_date: { tenantId, date: today } },
    });

    if (!board) {
      board = await this.prisma.dailyScoreboard.create({
        data: { tenantId, date: today },
      });
    }

    return board;
  }

  async refresh(tenantId: string) {
    const today = this.todayDate();
    const startOfDay = today;
    const endOfDay = new Date(today);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      qualifiedReqs,
      highConfReqs,
      todaySubmissions,
      todayInterviews,
      activeOffers,
      todayClosures,
      last30Submissions,
      last30Interviews,
      last30Offers,
      last30Accepted,
      todayRateCards,
      podStats,
      marginOverrides,
    ] = await Promise.all([
      this.prisma.job.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      this.prisma.job.count({
        where: { tenantId, status: 'ACTIVE', closureLikelihood: { gt: 0.6 } },
      }),
      this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
      }),
      this.prisma.interview.count({
        where: {
          tenantId,
          status: 'SCHEDULED',
          scheduledAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.offer.count({
        where: { tenantId, status: 'EXTENDED' },
      }),
      this.prisma.offer.count({
        where: {
          tenantId,
          status: 'ACCEPTED',
          updatedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.interview.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.offer.count({
        where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.offer.count({
        where: { tenantId, status: 'ACCEPTED', updatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.rateCard.findMany({
        where: { tenantId, createdAt: { gte: startOfDay, lt: endOfDay } },
        select: { netMarginHr: true, marginSafe: true },
      }),
      this.prisma.job.groupBy({
        by: ['pod'],
        where: { tenantId, status: 'ACTIVE', pod: { not: null } },
        _count: true,
        _avg: { freshnessScore: true, closureLikelihood: true },
      }),
      this.prisma.submission.count({
        where: {
          tenantId,
          marginOverrideBy: { not: null },
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);

    const subToInterviewRate = last30Submissions > 0
      ? last30Interviews / last30Submissions
      : null;
    const interviewToOfferRate = last30Interviews > 0
      ? last30Offers / last30Interviews
      : null;
    const offerToAcceptRate = last30Offers > 0
      ? last30Accepted / last30Offers
      : null;

    const podFocus = this.determinePodFocus(podStats);

    const avgMarginHr = todayRateCards.length > 0
      ? todayRateCards.reduce((sum, rc) => sum + (rc.netMarginHr ?? 0), 0) / todayRateCards.length
      : null;
    const marginSafeCount = todayRateCards.filter((rc) => rc.marginSafe).length;

    const board = await this.prisma.dailyScoreboard.upsert({
      where: { tenantId_date: { tenantId, date: today } },
      create: {
        tenantId,
        date: today,
        actualQualifiedReqs: qualifiedReqs,
        actualHighConfReqs: highConfReqs,
        actualSubmissions: todaySubmissions,
        actualInterviews: todayInterviews,
        actualActiveOffers: activeOffers,
        actualClosures: todayClosures,
        podFocus: (podFocus?.pod as Pod) ?? null,
        podRotationReason: podFocus?.reason ?? null,
        subToInterviewRate,
        interviewToOfferRate,
        offerToAcceptRate,
        avgMarginHr,
        marginSafeSubmissions: marginSafeCount,
        marginOverrides,
      },
      update: {
        actualQualifiedReqs: qualifiedReqs,
        actualHighConfReqs: highConfReqs,
        actualSubmissions: todaySubmissions,
        actualInterviews: todayInterviews,
        actualActiveOffers: activeOffers,
        actualClosures: todayClosures,
        podFocus: (podFocus?.pod as Pod) ?? null,
        podRotationReason: podFocus?.reason ?? null,
        subToInterviewRate,
        interviewToOfferRate,
        offerToAcceptRate,
        avgMarginHr,
        marginSafeSubmissions: marginSafeCount,
        marginOverrides,
      },
    });

    return board;
  }

  async getHistory(tenantId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.dailyScoreboard.findMany({
      where: { tenantId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });
  }

  private determinePodFocus(
    podStats: Array<{
      pod: string | null;
      _count: number;
      _avg: { freshnessScore: number | null; closureLikelihood: number | null };
    }>,
  ): { pod: string; reason: string } | null {
    if (!podStats.length) return null;

    let bestPod: string | null = null;
    let bestScore = -1;

    for (const ps of podStats) {
      if (!ps.pod) continue;
      const freshness = ps._avg.freshnessScore ?? 0.5;
      const closure = ps._avg.closureLikelihood ?? 0.3;
      const score = freshness * closure * ps._count;
      if (score > bestScore) {
        bestScore = score;
        bestPod = ps.pod;
      }
    }

    if (!bestPod) return null;

    return {
      pod: bestPod,
      reason: `Highest composite score (freshness × closure × volume): ${bestScore.toFixed(2)}`,
    };
  }

  private todayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}
