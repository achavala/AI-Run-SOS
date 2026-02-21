import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getCommandCenter(tenantId: string) {
    const [
      activePlacements,
      openJobs,
      pendingInvoices,
      vendors,
      recentSubmissions,
    ] = await Promise.all([
      this.prisma.placement.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { consultant: true, vendor: true, job: true },
      }),
      this.prisma.job.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.invoice.findMany({
        where: { tenantId, status: { in: ['SENT', 'OVERDUE', 'PARTIAL'] } },
      }),
      this.prisma.vendor.findMany({
        where: { tenantId },
        select: { id: true, companyName: true, trustScore: true, paySpeedDays: true, ghostRate: true },
      }),
      this.prisma.submission.count({
        where: { tenantId, createdAt: { gte: this.daysAgo(30) } },
      }),
    ]);

    const totalBillRevenue = activePlacements.reduce(
      (sum, p) => sum + p.billRate * 40,
      0,
    );
    const totalPayCost = activePlacements.reduce(
      (sum, p) => sum + p.payRate * 40,
      0,
    );
    const weeklyMargin = totalBillRevenue - totalPayCost;
    const avgMarginPct =
      totalBillRevenue > 0 ? (weeklyMargin / totalBillRevenue) * 100 : 0;

    const arTotal = pendingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const arOverdue = pendingInvoices
      .filter((inv) => inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    const vendorTrust = vendors.map((v) => ({
      vendorId: v.id,
      companyName: v.companyName,
      trustScore: v.trustScore ?? 0,
      paySpeedDays: v.paySpeedDays ?? 0,
      ghostRate: v.ghostRate ?? 0,
    }));

    const riskItems: Array<{ type: string; severity: string; message: string }> = [];

    if (avgMarginPct < 15) {
      riskItems.push({
        type: 'MARGIN',
        severity: 'HIGH',
        message: `Average margin at ${avgMarginPct.toFixed(1)}% — below 15% threshold`,
      });
    }

    const lowTrustVendors = vendors.filter((v) => v.trustScore !== null && v.trustScore < 50);
    for (const v of lowTrustVendors) {
      riskItems.push({
        type: 'VENDOR_TRUST',
        severity: 'MEDIUM',
        message: `${v.companyName} trust score: ${v.trustScore}`,
      });
    }

    if (arOverdue > 0) {
      riskItems.push({
        type: 'AR_OVERDUE',
        severity: 'HIGH',
        message: `$${arOverdue.toLocaleString()} in overdue invoices`,
      });
    }

    return {
      revenuePipeline: {
        weeklyBillRevenue: totalBillRevenue,
        weeklyPayCost: totalPayCost,
        weeklyMargin,
        activePlacementCount: activePlacements.length,
      },
      marginHealth: {
        averageMarginPct: Math.round(avgMarginPct * 100) / 100,
        placementsByMargin: activePlacements.map((p) => ({
          placementId: p.id,
          consultantName: `${p.consultant.firstName} ${p.consultant.lastName}`,
          vendorName: p.vendor.companyName,
          billRate: p.billRate,
          payRate: p.payRate,
          margin: p.margin,
          marginPct: p.billRate > 0 ? ((p.billRate - p.payRate) / p.billRate) * 100 : 0,
        })),
      },
      vendorTrustScores: vendorTrust,
      riskHeatmap: riskItems,
      snapshot: {
        openJobs,
        activePlacements: activePlacements.length,
        submissionsLast30Days: recentSubmissions,
        arTotal,
        arOverdue,
      },
    };
  }

  async getRecruitment(tenantId: string) {
    const [openJobs, submissions, awaitingConsent] = await Promise.all([
      this.prisma.job.findMany({
        where: { tenantId, status: { in: ['OPEN', 'DRAFT'] } },
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
        where: { tenantId, status: 'AWAITING_CONSENT' },
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

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }
}
