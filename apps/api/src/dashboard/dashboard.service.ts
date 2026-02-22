import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreboardService } from '../scoreboard/scoreboard.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private scoreboard: ScoreboardService,
  ) {}

  async getCommandCenter(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activePlacements,
      openJobs,
      pendingInvoices,
      vendors,
      recentSubmissions,
      dailyScoreboard,
      todayRateCards,
      marginOverrideCount,
      yesterdayScoreboard,
      previousWeekPlacements,
      previousWeekInvoicesOverdue,
      submissionsByStatus,
      overdueInvoiceDetails,
      expiringWorkAuths,
      activityFeed,
      vendorJobCounts,
      vendorTrustTrends,
      podBenchReady,
    ] = await Promise.all([
      // Active placements with details
      this.prisma.placement.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { consultant: true, vendor: true, job: true },
      }),
      // Open jobs count
      this.prisma.job.count({ where: { tenantId, status: 'ACTIVE' } }),
      // Pending invoices for AR
      this.prisma.invoice.findMany({
        where: { tenantId, status: { in: ['SENT', 'OVERDUE', 'PARTIAL'] } },
      }),
      // All vendors
      this.prisma.vendor.findMany({
        where: { tenantId },
        select: {
          id: true, companyName: true, trustScore: true,
          paySpeedDays: true, ghostRate: true,
        },
      }),
      // Recent submissions count
      this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: this.daysAgo(30) } },
      }),
      // Today's scoreboard (live refresh)
      this.scoreboard.refresh(tenantId),
      // Today's rate cards for margin health
      this.prisma.rateCard.findMany({
        where: { tenantId, createdAt: { gte: this.startOfDay() } },
        select: { netMarginHr: true, marginSafe: true },
      }),
      // Today's margin overrides
      this.prisma.submission.count({
        where: {
          tenantId,
          marginOverrideBy: { not: null },
          createdAt: { gte: this.startOfDay() },
        },
      }),
      // Yesterday's scoreboard for trend comparison
      this.prisma.dailyScoreboard.findFirst({
        where: {
          tenantId,
          date: { lt: this.startOfDay() },
        },
        orderBy: { date: 'desc' },
      }),
      // Previous week placements for KPI comparison
      this.prisma.placement.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          createdAt: { lt: this.daysAgo(7) },
        },
      }),
      // Previous overdue for KPI comparison
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: 'OVERDUE',
          dueDate: { lt: this.daysAgo(7) },
        },
        _sum: { totalAmount: true },
      }),
      // Submission pipeline by status
      this.prisma.submission.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      // Overdue invoices with vendor details
      this.prisma.invoice.findMany({
        where: { tenantId, status: 'OVERDUE' },
        include: { vendor: { select: { companyName: true } } },
        orderBy: { dueDate: 'asc' },
      }),
      // Expiring work authorizations (next 90 days)
      this.prisma.consultantWorkAuth.findMany({
        where: {
          tenantId,
          isCurrent: true,
          expiryDate: {
            not: null,
            lte: this.daysAgo(-90),
          },
        },
        include: {
          consultant: { select: { firstName: true, lastName: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
      // Activity feed from CommunicationEvent
      this.prisma.communicationEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Job counts per vendor
      this.prisma.job.groupBy({
        by: ['vendorId'],
        where: { tenantId, status: { in: ['ACTIVE', 'NEW'] } },
        _count: true,
      }),
      // Trust events for trend (last 30 days, 2 most recent per vendor)
      this.prisma.trustEvent.findMany({
        where: {
          tenantId,
          entityType: 'VENDOR',
          createdAt: { gte: this.daysAgo(30) },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Bench-ready consultants per pod
      this.prisma.consultant.findMany({
        where: {
          tenantId,
          readiness: { in: ['SUBMISSION_READY', 'VERIFIED'] },
        },
        select: { pods: true },
      }),
    ]);

    // ── Revenue & Margin KPIs ───────────────────────────────────────
    const totalBillRevenue = activePlacements.reduce(
      (sum, p) => sum + p.billRate * 40, 0,
    );
    const totalPayCost = activePlacements.reduce(
      (sum, p) => sum + p.payRate * 40, 0,
    );
    const weeklyMargin = totalBillRevenue - totalPayCost;
    const avgMarginPct =
      totalBillRevenue > 0 ? (weeklyMargin / totalBillRevenue) * 100 : 0;

    const monthlyRevenue = totalBillRevenue * 4.33;

    // AR calculations
    const arOverdueTotal = pendingInvoices
      .filter((inv) => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + inv.totalAmount - (inv.paidAmount ?? 0), 0);
    const arTotal = pendingInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount - (inv.paidAmount ?? 0), 0,
    );

    // Previous week AR overdue for comparison
    const prevArOverdue = previousWeekInvoicesOverdue._sum.totalAmount ?? 0;

    // ── Margin Health ───────────────────────────────────────────────
    const avgMarginHr = todayRateCards.length > 0
      ? todayRateCards.reduce((s, rc) => s + (rc.netMarginHr ?? 0), 0) / todayRateCards.length
      : null;
    const marginSafePct = todayRateCards.length > 0
      ? (todayRateCards.filter((rc) => rc.marginSafe).length / todayRateCards.length) * 100
      : null;

    // ── Conversion Funnel with Trends ───────────────────────────────
    const conversionFunnel = {
      subToInterview: {
        current: dailyScoreboard.subToInterviewRate,
        previous: yesterdayScoreboard?.subToInterviewRate ?? null,
        trend: this.computeTrend(
          dailyScoreboard.subToInterviewRate,
          yesterdayScoreboard?.subToInterviewRate,
        ),
      },
      interviewToOffer: {
        current: dailyScoreboard.interviewToOfferRate,
        previous: yesterdayScoreboard?.interviewToOfferRate ?? null,
        trend: this.computeTrend(
          dailyScoreboard.interviewToOfferRate,
          yesterdayScoreboard?.interviewToOfferRate,
        ),
      },
      offerToAccept: {
        current: dailyScoreboard.offerToAcceptRate,
        previous: yesterdayScoreboard?.offerToAcceptRate ?? null,
        trend: this.computeTrend(
          dailyScoreboard.offerToAcceptRate,
          yesterdayScoreboard?.offerToAcceptRate,
        ),
      },
    };

    // ── Pod Focus with Metrics ──────────────────────────────────────
    const focusPod = dailyScoreboard.podFocus;
    let podReqCount = 0;
    let podBenchCount = 0;
    let podAvgMargin = 0;

    if (focusPod) {
      const podJobs = await this.prisma.job.findMany({
        where: { tenantId, pod: focusPod, status: 'ACTIVE' },
        select: { rateMin: true, rateMax: true },
      });
      podReqCount = podJobs.length;

      podBenchCount = podBenchReady.filter((c) =>
        c.pods.includes(focusPod),
      ).length;

      const podPlacements = activePlacements.filter(
        (p) => p.job.pod === focusPod,
      );
      podAvgMargin = podPlacements.length > 0
        ? podPlacements.reduce((s, p) => s + ((p.billRate - p.payRate) / p.billRate) * 100, 0) / podPlacements.length
        : 0;
    }

    // ── Full Pipeline Funnel (jobs → submissions → placements) ─────
    const [newJobs, activeJobs, jobAvgRate] = await Promise.all([
      this.prisma.job.count({ where: { tenantId, status: 'NEW' } }),
      this.prisma.job.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.job.aggregate({
        where: { tenantId, status: { in: ['NEW', 'ACTIVE'] }, rateMax: { not: null } },
        _avg: { rateMax: true },
      }),
    ]);
    const avgJobRate = jobAvgRate._avg.rateMax ?? 0;

    const subStatusOrder = [
      'SUBMITTED', 'INTERVIEWING', 'OFFERED',
    ] as const;
    const subsByStatusMap: Record<string, number> = {};
    for (const s of submissionsByStatus) {
      subsByStatusMap[s.status] = s._count;
    }

    const submissionsByStatusWithRates = await this.prisma.submission.findMany({
      where: {
        tenantId,
        status: { in: [...subStatusOrder] },
      },
      select: {
        status: true,
        rateCard: { select: { billRate: true } },
      },
    });

    const revenueByStatus: Record<string, number> = {};
    for (const sub of submissionsByStatusWithRates) {
      const rate = sub.rateCard?.billRate ?? 0;
      revenueByStatus[sub.status] = (revenueByStatus[sub.status] ?? 0) + rate * 40;
    }

    const submissionPipeline = [
      { stage: 'New Reqs', status: 'NEW_JOB', count: newJobs, estWeeklyRevenue: newJobs * avgJobRate * 40 },
      { stage: 'Qualified', status: 'ACTIVE_JOB', count: activeJobs, estWeeklyRevenue: activeJobs * avgJobRate * 40 },
      { stage: 'Submitted', status: 'SUBMITTED', count: subsByStatusMap['SUBMITTED'] ?? 0, estWeeklyRevenue: revenueByStatus['SUBMITTED'] ?? 0 },
      { stage: 'Interview', status: 'INTERVIEWING', count: subsByStatusMap['INTERVIEWING'] ?? 0, estWeeklyRevenue: revenueByStatus['INTERVIEWING'] ?? 0 },
      { stage: 'Offer', status: 'OFFERED', count: subsByStatusMap['OFFERED'] ?? 0, estWeeklyRevenue: revenueByStatus['OFFERED'] ?? 0 },
      { stage: 'Placed', status: 'PLACED', count: activePlacements.length, estWeeklyRevenue: totalBillRevenue },
    ];

    // ── Risk Monitor ────────────────────────────────────────────────
    const riskItems: Array<{
      type: string;
      description: string;
      severity: 'high' | 'medium' | 'low';
      metric?: number;
      metricLabel?: string;
    }> = [];

    for (const inv of overdueInvoiceDetails) {
      const outstanding = inv.totalAmount - (inv.paidAmount ?? 0);
      const daysOverdue = inv.dueDate
        ? Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000)
        : 0;
      riskItems.push({
        type: 'AR Overdue',
        description: `${inv.vendor.companyName} — ${inv.invoiceNumber} ($${outstanding.toLocaleString()})`,
        severity: daysOverdue > 30 ? 'high' : 'medium',
        metric: daysOverdue,
        metricLabel: `${daysOverdue}d overdue`,
      });
    }

    if (avgMarginPct < 15 && activePlacements.length > 0) {
      riskItems.push({
        type: 'Margin Alert',
        description: `Average portfolio margin at ${avgMarginPct.toFixed(1)}% — below 15% threshold`,
        severity: avgMarginPct < 10 ? 'high' : 'medium',
      });
    }

    const now = new Date();
    for (const wa of expiringWorkAuths) {
      if (!wa.expiryDate) continue;
      const daysLeft = Math.floor((wa.expiryDate.getTime() - now.getTime()) / 86400000);
      if (daysLeft > 90) continue;
      riskItems.push({
        type: 'Compliance',
        description: `${wa.consultant.firstName} ${wa.consultant.lastName} — ${wa.authType} expiring ${wa.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        severity: daysLeft <= 30 ? 'high' : 'medium',
        metric: daysLeft,
        metricLabel: `${daysLeft}d left`,
      });
    }

    const highGhostVendors = vendors.filter((v) => (v.ghostRate ?? 0) > 0.15);
    for (const v of highGhostVendors) {
      riskItems.push({
        type: 'Ghost Risk',
        description: `${v.companyName} — ${((v.ghostRate ?? 0) * 100).toFixed(0)}% ghost rate`,
        severity: (v.ghostRate ?? 0) > 0.25 ? 'high' : 'low',
      });
    }

    riskItems.sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 };
      return sev[a.severity] - sev[b.severity];
    });

    // ── Vendor Trust Scores with Jobs & Trends ──────────────────────
    const jobCountByVendor: Record<string, number> = {};
    for (const jc of vendorJobCounts) {
      jobCountByVendor[jc.vendorId] = jc._count;
    }

    const trendByVendor: Record<string, 'up' | 'down' | 'stable'> = {};
    for (const v of vendors) {
      const events = vendorTrustTrends
        .filter((e) => e.entityId === v.id)
        .slice(0, 3);
      if (events.length === 0) {
        trendByVendor[v.id] = 'stable';
      } else {
        const totalDelta = events.reduce((s, e) => s + (e.delta ?? 0), 0);
        trendByVendor[v.id] = totalDelta > 0 ? 'up' : totalDelta < 0 ? 'down' : 'stable';
      }
    }

    const vendorTrustScores = vendors
      .map((v) => ({
        vendorId: v.id,
        name: v.companyName,
        score: v.trustScore ?? 0,
        paySpeed: v.paySpeedDays ?? 0,
        jobs: jobCountByVendor[v.id] ?? 0,
        trend: trendByVendor[v.id] ?? ('stable' as const),
      }))
      .sort((a, b) => b.score - a.score);

    // ── Activity Feed ───────────────────────────────────────────────
    const recentActivity = activityFeed.map((ev) => {
      const minutesAgo = Math.floor((Date.now() - ev.createdAt.getTime()) / 60000);
      let timeStr: string;
      if (minutesAgo < 60) timeStr = `${minutesAgo} min ago`;
      else if (minutesAgo < 1440) timeStr = `${Math.floor(minutesAgo / 60)} hr ago`;
      else timeStr = `${Math.floor(minutesAgo / 1440)}d ago`;

      return {
        action: ev.subject ?? 'Activity',
        detail: ev.body ?? '',
        time: timeStr,
        channel: ev.channel,
        direction: ev.direction,
        isAgent: ev.sentByAgent,
      };
    });

    // ── KPI Cards with period-over-period ───────────────────────────
    const recentPlacements = activePlacements.filter((p) =>
      p.createdAt >= this.daysAgo(7),
    ).length;

    const prevWeekRevenue = previousWeekPlacements > 0
      ? (totalBillRevenue / activePlacements.length) * previousWeekPlacements * 4.33
      : 0;
    const revenueChange = monthlyRevenue > 0 && prevWeekRevenue > 0
      ? ((monthlyRevenue - prevWeekRevenue) / prevWeekRevenue) * 100
      : null;

    const prevAvgMarginHr = yesterdayScoreboard?.avgMarginHr != null
      ? Number(yesterdayScoreboard.avgMarginHr)
      : null;
    const marginChange = prevAvgMarginHr != null && avgMarginHr != null
      ? avgMarginHr - prevAvgMarginHr
      : null;

    return {
      dailyScoreboard: {
        date: dailyScoreboard.date,
        targets: {
          qualifiedReqs: dailyScoreboard.targetQualifiedReqs,
          submissions: dailyScoreboard.targetSubmissions,
          interviews: dailyScoreboard.targetInterviews,
          activeOffers: dailyScoreboard.targetActiveOffers,
          closures: dailyScoreboard.targetClosures,
        },
        actuals: {
          qualifiedReqs: dailyScoreboard.actualQualifiedReqs,
          submissions: dailyScoreboard.actualSubmissions,
          interviews: dailyScoreboard.actualInterviews,
          activeOffers: dailyScoreboard.actualActiveOffers,
          closures: dailyScoreboard.actualClosures,
        },
      },
      podFocus: {
        currentPod: focusPod,
        reason: dailyScoreboard.podRotationReason,
        reqCount: podReqCount,
        benchReady: podBenchCount,
        avgMargin: Math.round(podAvgMargin * 10) / 10,
      },
      conversionFunnel,
      marginHealth: {
        avgMarginHr: avgMarginHr != null ? Math.round(avgMarginHr * 100) / 100 : null,
        marginSafePct: marginSafePct != null ? Math.round(marginSafePct) : null,
        overrideCount: marginOverrideCount,
        averageMarginPct: Math.round(avgMarginPct * 10) / 10,
      },
      kpiCards: {
        revenuePipeline: {
          value: Math.round(monthlyRevenue),
          formattedValue: this.formatCurrency(monthlyRevenue),
          change: revenueChange != null ? `${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%` : null,
          changeType: (revenueChange ?? 0) > 0 ? 'positive' : (revenueChange ?? 0) < 0 ? 'negative' : 'neutral',
          subtitle: 'monthly projected',
        },
        activePlacements: {
          value: activePlacements.length,
          formattedValue: String(activePlacements.length),
          change: recentPlacements > 0 ? `+${recentPlacements}` : null,
          changeType: recentPlacements > 0 ? 'positive' : 'neutral',
          subtitle: 'this week',
        },
        marginHealth: {
          value: avgMarginPct,
          formattedValue: `${avgMarginPct.toFixed(1)}%`,
          change: marginChange != null ? `${marginChange > 0 ? '+' : ''}$${Math.abs(marginChange).toFixed(2)}/hr` : null,
          changeType: avgMarginPct >= 20 ? 'positive' : 'negative',
          subtitle: 'avg gross margin',
        },
        arAtRisk: {
          value: arOverdueTotal,
          formattedValue: this.formatCurrency(arOverdueTotal),
          change: prevArOverdue > 0
            ? `${arOverdueTotal > prevArOverdue ? '+' : ''}${this.formatCurrency(arOverdueTotal - prevArOverdue)}`
            : null,
          changeType: arOverdueTotal > 0 ? 'negative' : 'positive',
          subtitle: 'overdue > 30 days',
        },
      },
      submissionPipeline,
      riskMonitor: riskItems,
      vendorTrustScores,
      recentActivity,
      snapshot: {
        openJobs,
        activePlacements: activePlacements.length,
        submissionsLast30Days: recentSubmissions,
        arTotal,
        arOverdue: arOverdueTotal,
      },
    };
  }

  async getRecruitment(tenantId: string) {
    const [openJobs, submissions, awaitingConsent] = await Promise.all([
      this.prisma.job.findMany({
        where: { tenantId, status: { in: ['ACTIVE', 'NEW'] } },
        include: {
          vendor: { select: { companyName: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.submission.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.submission.findMany({
        where: { tenantId, status: 'CONSENT_PENDING' },
        include: {
          consultant: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
        },
      }),
    ]);

    const interviews = await this.prisma.interview.findMany({
      where: {
        tenantId,
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      include: {
        submission: {
          include: {
            consultant: { select: { firstName: true, lastName: true } },
            job: { select: { title: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    });

    const submissionStats: Record<string, number> = {};
    for (const s of submissions) {
      submissionStats[s.status] = s._count;
    }

    return {
      openJobs: openJobs.map((j) => ({
        id: j.id,
        title: j.title,
        vendorName: j.vendor.companyName,
        status: j.status,
        submissionCount: j._count.submissions,
        createdAt: j.createdAt.toISOString(),
      })),
      submissionStats,
      awaitingConsent: awaitingConsent.map((s) => ({
        id: s.id,
        consultantName: `${s.consultant.firstName} ${s.consultant.lastName}`,
        jobTitle: s.job.title,
        createdAt: s.createdAt.toISOString(),
      })),
      upcomingInterviews: interviews.map((i) => ({
        id: i.id,
        candidateName: `${i.submission.consultant.firstName} ${i.submission.consultant.lastName}`,
        jobTitle: i.submission.job.title,
        scheduledAt: i.scheduledAt.toISOString(),
        interviewType: i.interviewType,
      })),
    };
  }

  async getSales(tenantId: string) {
    const [vendors, jobs, placements] = await Promise.all([
      this.prisma.vendor.findMany({
        where: { tenantId },
        include: {
          _count: { select: { jobs: true, invoices: true, placements: true } },
        },
        orderBy: { companyName: 'asc' },
      }),
      this.prisma.job.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.placement.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { billRate: true, payRate: true, margin: true },
      }),
    ]);

    const jobPipeline: Record<string, number> = {};
    for (const j of jobs) {
      jobPipeline[j.status] = j._count;
    }

    const totalRevenue = placements.reduce((s, p) => s + p.billRate * 40 * 4, 0);
    const totalMargin = placements.reduce((s, p) => s + p.margin * 40 * 4, 0);

    return {
      vendorStats: vendors.map((v) => ({
        id: v.id,
        companyName: v.companyName,
        msaStatus: v.msaStatus,
        trustScore: v.trustScore,
        paySpeedDays: v.paySpeedDays,
        ghostRate: v.ghostRate,
        activeJobs: v._count.jobs,
        totalInvoices: v._count.invoices,
        activePlacements: v._count.placements,
      })),
      dealPipeline: jobPipeline,
      monthlyProjection: {
        estimatedRevenue: totalRevenue,
        estimatedMargin: totalMargin,
        activePlacements: placements.length,
      },
    };
  }

  async getAccounts(tenantId: string) {
    const [invoices, recentPayments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId },
        include: { vendor: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.payment.findMany({
        where: { tenantId },
        include: {
          invoice: {
            select: { invoiceNumber: true, vendor: { select: { companyName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const byStatus: Record<string, { count: number; total: number }> = {};

    for (const inv of invoices) {
      const bucket = byStatus[inv.status] ?? { count: 0, total: 0 };
      bucket.count++;
      bucket.total += inv.totalAmount;
      byStatus[inv.status] = bucket;

      if (inv.status === 'PAID') continue;

      const outstanding = inv.totalAmount - (inv.paidAmount ?? 0);
      if (outstanding <= 0) continue;

      const daysSinceDue = inv.dueDate
        ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000)
        : 0;

      if (daysSinceDue <= 0) aging.current += outstanding;
      else if (daysSinceDue <= 30) aging.days30 += outstanding;
      else if (daysSinceDue <= 60) aging.days60 += outstanding;
      else if (daysSinceDue <= 90) aging.days90 += outstanding;
      else aging.over90 += outstanding;
    }

    return {
      arAging: aging,
      invoicesByStatus: byStatus,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoice.invoiceNumber,
        vendorName: p.invoice.vendor.companyName,
        amount: p.amount,
        paymentDate: p.paymentDate?.toISOString() ?? null,
        status: p.status,
      })),
      totalOutstanding: Object.values(aging).reduce((a, b) => a + b, 0),
    };
  }

  private computeTrend(
    current: number | null | undefined,
    previous: number | null | undefined,
  ): 'up' | 'down' | 'stable' {
    if (current == null || previous == null) return 'stable';
    const diff = current - previous;
    if (Math.abs(diff) < 0.02) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  }

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }
}
