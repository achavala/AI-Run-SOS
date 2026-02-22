import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MarginInput {
  billRate: number;
  payRate: number;
  vendorCutPct?: number;
  burdenPct?: number;
  payrollTaxPct?: number;
  portalFeePct?: number;
  otherFees?: number;
}

export interface MarginBreakdown {
  billRate: number;
  payRate: number;
  grossMarginHr: number;
  effectiveCosts: number;
  netMarginHr: number;
  marginSafe: boolean;
  suggestedBillRate: number;
  vendorCutPct: number;
  burdenPct: number;
  payrollTaxPct: number;
  portalFeePct: number;
  otherFees: number;
}

const MIN_MARGIN_TARGET = 10;

@Injectable()
export class MarginGuardService {
  constructor(private prisma: PrismaService) {}

  computeMargin(input: MarginInput): MarginBreakdown {
    const vendorCutPct = input.vendorCutPct ?? 0;
    const burdenPct = input.burdenPct ?? 0;
    const payrollTaxPct = input.payrollTaxPct ?? 0;
    const portalFeePct = input.portalFeePct ?? 0;
    const otherFees = input.otherFees ?? 0;

    const grossMarginHr = input.billRate - input.payRate;

    const effectiveCosts =
      (input.payRate * (burdenPct + payrollTaxPct)) / 100 +
      (input.billRate * (vendorCutPct + portalFeePct)) / 100 +
      otherFees;

    const netMarginHr = grossMarginHr - effectiveCosts;
    const marginSafe = netMarginHr >= MIN_MARGIN_TARGET;
    const suggestedBillRate = input.payRate + effectiveCosts + MIN_MARGIN_TARGET;

    return {
      billRate: input.billRate,
      payRate: input.payRate,
      grossMarginHr,
      effectiveCosts,
      netMarginHr,
      marginSafe,
      suggestedBillRate,
      vendorCutPct,
      burdenPct,
      payrollTaxPct,
      portalFeePct,
      otherFees,
    };
  }

  async createRateCard(tenantId: string, input: MarginInput) {
    const breakdown = this.computeMargin(input);

    return this.prisma.rateCard.create({
      data: {
        tenantId,
        billRate: input.billRate,
        payRate: input.payRate,
        vendorCutPct: input.vendorCutPct ?? 0,
        burdenPct: input.burdenPct ?? 0,
        payrollTaxPct: input.payrollTaxPct ?? 0,
        portalFeePct: input.portalFeePct ?? 0,
        otherFees: input.otherFees ?? 0,
        grossMarginHr: breakdown.grossMarginHr,
        netMarginHr: breakdown.netMarginHr,
        marginSafe: breakdown.marginSafe,
        minMarginTarget: MIN_MARGIN_TARGET,
      },
    });
  }

  async getRateCard(tenantId: string, id: string) {
    const rateCard = await this.prisma.rateCard.findFirst({
      where: { id, tenantId },
    });
    if (!rateCard) throw new NotFoundException('Rate card not found');
    return rateCard;
  }

  async checkSubmission(submissionId: string): Promise<MarginBreakdown | null> {
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId },
      include: { rateCard: true },
    });

    if (!submission?.rateCard) return null;

    const rc = submission.rateCard;
    return this.computeMargin({
      billRate: rc.billRate,
      payRate: rc.payRate,
      vendorCutPct: rc.vendorCutPct,
      burdenPct: rc.burdenPct,
      payrollTaxPct: rc.payrollTaxPct,
      portalFeePct: rc.portalFeePct,
      otherFees: rc.otherFees,
    });
  }
}
