import type { PrismaClient } from "@prisma/client";
import { JobStatus, Pod, SubmissionStatus, OfferStatus } from "@prisma/client";

export async function handleDailyScoreboard(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    const tenantId = tenant.id;

    // Today's metrics
    const [
      qualifiedReqs,
      highConfReqs,
      submissionsCount,
      interviewsCount,
      offersInMotion,
      closures,
    ] = await Promise.all([
      prisma.job.count({
        where: { tenantId, status: JobStatus.ACTIVE },
      }),
      prisma.job.count({
        where: {
          tenantId,
          status: JobStatus.ACTIVE,
          freshnessScore: { gte: 0.7 },
        },
      }),
      prisma.submission.count({
        where: {
          tenantId,
          status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.INTERVIEWING, SubmissionStatus.OFFERED] },
          createdAt: { gte: today, lt: todayEnd },
        },
      }),
      prisma.interview.count({
        where: {
          tenantId,
          scheduledAt: { gte: today, lt: todayEnd },
        },
      }),
      prisma.offer.count({
        where: {
          tenantId,
          status: OfferStatus.EXTENDED,
        },
      }),
      prisma.placement.count({
        where: {
          tenantId,
          startDate: { gte: today, lt: todayEnd },
        },
      }),
    ]);

    // 30-day data for conversion rates
    const recentSubmissions = await prisma.submission.findMany({
      where: {
        tenantId,
        status: { in: [SubmissionStatus.INTERVIEWING, SubmissionStatus.OFFERED, SubmissionStatus.ACCEPTED] },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { id: true },
    });
    const recentInterviews = await prisma.interview.count({
      where: {
        tenantId,
        scheduledAt: { gte: thirtyDaysAgo },
      },
    });
    const recentOffers = await prisma.offer.count({
      where: {
        tenantId,
        status: { in: [OfferStatus.EXTENDED, OfferStatus.ACCEPTED] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const recentAcceptances = await prisma.offer.count({
      where: {
        tenantId,
        status: OfferStatus.ACCEPTED,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const subToInterviewRate =
      recentSubmissions.length > 0 ? recentInterviews / recentSubmissions.length : null;
    const interviewToOfferRate =
      recentInterviews > 0 ? recentOffers / recentInterviews : null;
    const offerToAcceptRate =
      recentOffers > 0 ? recentAcceptances / recentOffers : null;

    // Pod focus: which pod has best req freshness + vendor response + bench availability
    const activeJobsByPod = await prisma.job.groupBy({
      by: ["pod"],
      where: {
        tenantId,
        status: JobStatus.ACTIVE,
        pod: { not: null },
      },
      _count: { id: true },
    });

    const podScores: Record<string, number> = {};
    for (const row of activeJobsByPod) {
      if (row.pod) {
        const jobCount = row._count.id;
        const avgFreshness = await prisma.job.aggregate({
          where: {
            tenantId,
            status: JobStatus.ACTIVE,
            pod: row.pod,
          },
          _avg: { freshnessScore: true },
        });
        const vendorCount = await prisma.job.findMany({
          where: {
            tenantId,
            status: JobStatus.ACTIVE,
            pod: row.pod,
          },
          select: { vendorId: true },
          distinct: ["vendorId"],
        });
        const benchCount = await prisma.consultant.count({
          where: {
            tenantId,
            readiness: "SUBMISSION_READY",
            pods: { has: row.pod },
          },
        });
        podScores[row.pod] =
          (avgFreshness._avg.freshnessScore ?? 0.5) * 0.4 +
          Math.min(vendorCount.length / 5, 1) * 0.3 +
          Math.min(benchCount / 10, 1) * 0.3;
      }
    }

    const podFocus =
      (Object.entries(podScores).sort((a, b) => b[1] - a[1])[0]?.[0] as Pod) ?? null;
    const podRotationReason = podFocus
      ? `Best req freshness, vendor response, and bench availability for ${podFocus}`
      : null;

    // Margin health
    const marginStats = await prisma.submission.aggregate({
      where: {
        tenantId,
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.INTERVIEWING, SubmissionStatus.OFFERED] },
        rateCardId: { not: null },
      },
      _count: { id: true },
    });
    const marginSafeCount = await prisma.submission.count({
      where: {
        tenantId,
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.INTERVIEWING, SubmissionStatus.OFFERED] },
        marginApproved: true,
      },
    });
    const marginOverrides = await prisma.submission.count({
      where: {
        tenantId,
        marginOverrideBy: { not: null },
      },
    });
    const avgMargin = await prisma.rateCard.aggregate({
      where: {
        tenantId,
        submissions: { some: { status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.INTERVIEWING, SubmissionStatus.OFFERED] } } },
      },
      _avg: { netMarginHr: true },
    });

    await prisma.dailyScoreboard.upsert({
      where: {
        tenantId_date: { tenantId, date: today },
      },
      create: {
        tenantId,
        date: today,
        actualQualifiedReqs: qualifiedReqs,
        actualHighConfReqs: highConfReqs,
        actualSubmissions: submissionsCount,
        actualInterviews: interviewsCount,
        actualActiveOffers: offersInMotion,
        actualClosures: closures,
        subToInterviewRate,
        interviewToOfferRate,
        offerToAcceptRate,
        podFocus,
        podRotationReason,
        avgMarginHr: avgMargin._avg.netMarginHr,
        marginSafeSubmissions: marginSafeCount,
        marginOverrides,
      },
      update: {
        actualQualifiedReqs: qualifiedReqs,
        actualHighConfReqs: highConfReqs,
        actualSubmissions: submissionsCount,
        actualInterviews: interviewsCount,
        actualActiveOffers: offersInMotion,
        actualClosures: closures,
        subToInterviewRate,
        interviewToOfferRate,
        offerToAcceptRate,
        podFocus,
        podRotationReason,
        avgMarginHr: avgMargin._avg.netMarginHr,
        marginSafeSubmissions: marginSafeCount,
        marginOverrides,
      },
    });
  }
}
