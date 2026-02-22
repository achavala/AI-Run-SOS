import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarginGuardService } from '../margin-guard/margin-guard.service';

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private marginGuard: MarginGuardService,
  ) {}

  async findAll(tenantId: string) {
    const offers = await this.prisma.offer.findMany({
      where: { tenantId },
      include: {
        job: { select: { title: true } },
        consultant: { select: { firstName: true, lastName: true } },
        vendor: { select: { companyName: true } },
        submission: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return offers.map((o) => ({
      id: o.id,
      jobTitle: o.job.title,
      consultantName: `${o.consultant.firstName} ${o.consultant.lastName}`,
      vendorName: o.vendor.companyName,
      billRate: o.billRate,
      payRate: o.payRate,
      status: o.status,
      startDate: o.startDate?.toISOString() ?? null,
      endDate: o.endDate?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async findOne(tenantId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, tenantId },
      include: {
        job: { include: { vendor: true } },
        consultant: true,
        vendor: true,
        submission: { include: { rateCard: true } },
      },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async create(
    tenantId: string,
    userId: string,
    userRole: string,
    data: {
      submissionId: string;
      billRate: number;
      payRate: number;
      startDate: string;
      endDate: string;
      overrideMargin?: boolean;
      vendorCutPct?: number;
      burdenPct?: number;
      payrollTaxPct?: number;
      portalFeePct?: number;
      otherFees?: number;
      notes?: string;
    },
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: { id: data.submissionId, tenantId },
      include: { job: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const rateCard = await this.marginGuard.createRateCard(tenantId, {
      billRate: data.billRate,
      payRate: data.payRate,
      vendorCutPct: data.vendorCutPct,
      burdenPct: data.burdenPct,
      payrollTaxPct: data.payrollTaxPct,
      portalFeePct: data.portalFeePct,
      otherFees: data.otherFees,
    });

    const margin = this.marginGuard.computeMargin({
      billRate: data.billRate,
      payRate: data.payRate,
      vendorCutPct: data.vendorCutPct,
      burdenPct: data.burdenPct,
      payrollTaxPct: data.payrollTaxPct,
      portalFeePct: data.portalFeePct,
      otherFees: data.otherFees,
    });

    if (!margin.marginSafe) {
      if (!data.overrideMargin || userRole !== 'MANAGEMENT') {
        throw new BadRequestException({
          message: `Margin $${margin.netMarginHr.toFixed(2)}/hr is below $10/hr minimum`,
          netMarginHr: margin.netMarginHr,
          suggestedBillRate: margin.suggestedBillRate,
          suggestedPayRate: data.payRate,
          breakdown: margin,
        });
      }
    }

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: { rateCardId: rateCard.id },
    });

    return this.prisma.offer.create({
      data: {
        tenantId,
        submissionId: submission.id,
        jobId: submission.jobId,
        consultantId: submission.consultantId,
        vendorId: submission.job.vendorId,
        billRate: data.billRate,
        payRate: data.payRate,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: 'EXTENDED',
        approvedById: userId,
        notes: data.notes,
      },
      include: {
        job: { select: { title: true } },
        consultant: { select: { firstName: true, lastName: true } },
        vendor: { select: { companyName: true } },
      },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: { status: 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN'; notes?: string },
  ) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, tenantId },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const updatedOffer = await this.prisma.offer.update({
      where: { id },
      data: { status: data.status, notes: data.notes },
    });

    if (data.status === 'ACCEPTED') {
      await this.prisma.submission.update({
        where: { id: offer.submissionId },
        data: { status: 'ACCEPTED' },
      });

      await this.prisma.consultant.update({
        where: { id: offer.consultantId },
        data: { readiness: 'ON_ASSIGNMENT' },
      });
    }

    return updatedOffer;
  }

  async remove(tenantId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, tenantId },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    return this.prisma.offer.update({
      where: { id },
      data: { status: 'WITHDRAWN', notes: 'Soft-deleted by management' },
    });
  }
}
