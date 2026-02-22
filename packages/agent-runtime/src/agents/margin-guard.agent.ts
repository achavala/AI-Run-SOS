import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

interface MarginInput {
  billRate: number;
  payRate: number;
  vendorCutPct: number;
  burdenPct: number;
  payrollTaxPct: number;
  portalFeePct: number;
  otherFees: number;
}

interface MarginBreakdown {
  billRate: number;
  payRate: number;
  grossMarginHr: number;
  vendorCost: number;
  portalCost: number;
  burdenCost: number;
  payrollTaxCost: number;
  otherFees: number;
  totalEffectiveCosts: number;
  netMarginHr: number;
  netMarginPct: number;
}

const MARGIN_SAFE_THRESHOLD = 10;
const HARD_BLOCK_THRESHOLD = 5;

/**
 * MarginGuard — Deal Desk agent that computes margin breakdowns for submissions,
 * approves/blocks based on net margin thresholds, and suggests counter-offers.
 */
export class MarginGuardAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const submissionId = (context.input["submissionId"] as string) ?? "";
    const billRate = (context.input["billRate"] as number) ?? 0;
    const payRate = (context.input["payRate"] as number) ?? 0;
    const vendorCutPct = (context.input["vendorCutPct"] as number) ?? 0;
    const burdenPct = (context.input["burdenPct"] as number) ?? 0;
    const payrollTaxPct = (context.input["payrollTaxPct"] as number) ?? 0;
    const portalFeePct = (context.input["portalFeePct"] as number) ?? 0;
    const otherFees = (context.input["otherFees"] as number) ?? 0;

    if (billRate <= 0 || payRate <= 0) {
      return this.buildResult(false, {
        error: "billRate and payRate must be positive numbers",
      });
    }

    const breakdown = this.computeMarginBreakdown({
      billRate,
      payRate,
      vendorCutPct,
      burdenPct,
      payrollTaxPct,
      portalFeePct,
      otherFees,
    });

    const ratecardResult = await this.callTool(
      "ratecard.compute",
      {
        billRate,
        payRate,
        vendorCutPct,
        burdenPct,
        payrollTaxPct,
        portalFeePct,
        otherFees,
      },
      `Computing ratecard for bill=${billRate} pay=${payRate}`,
      context.workflowId
    );

    await this.callTool(
      "ratecard.create",
      {
        submissionId,
        breakdown,
        computedAt: new Date().toISOString(),
      },
      `Logging ratecard for submission ${submissionId}`,
      context.workflowId
    );

    if (breakdown.netMarginHr >= MARGIN_SAFE_THRESHOLD) {
      if (submissionId) {
        await this.callTool(
          "submission.approve",
          {
            submissionId,
            reason: `Net margin $${breakdown.netMarginHr.toFixed(2)}/hr meets threshold`,
            breakdown,
          },
          `Approving submission ${submissionId} — margin safe`,
          context.workflowId
        );
      }

      return this.buildResult(true, {
        approved: true,
        netMarginHr: breakdown.netMarginHr,
        grossMarginHr: breakdown.grossMarginHr,
        suggestedBillRate: null,
        suggestedPayRate: null,
        breakdown,
      });
    }

    const suggestedBillRate = this.computeMinBillRate(
      payRate,
      vendorCutPct,
      burdenPct,
      payrollTaxPct,
      portalFeePct,
      otherFees,
      MARGIN_SAFE_THRESHOLD
    );

    const suggestedPayRate = this.computeMaxPayRate(
      billRate,
      vendorCutPct,
      burdenPct,
      payrollTaxPct,
      portalFeePct,
      otherFees,
      MARGIN_SAFE_THRESHOLD
    );

    if (breakdown.netMarginHr < HARD_BLOCK_THRESHOLD) {
      if (submissionId) {
        await this.callTool(
          "submission.block",
          {
            submissionId,
            reason: `Hard block: net margin $${breakdown.netMarginHr.toFixed(2)}/hr below $${HARD_BLOCK_THRESHOLD} — requires CFO override`,
            breakdown,
          },
          `Hard-blocking submission ${submissionId} — margin critically low`,
          context.workflowId
        );
      }

      await this.callTool(
        "alert.create",
        {
          type: "margin_critical",
          severity: "critical",
          submissionId,
          message: `Critically low margin: $${breakdown.netMarginHr.toFixed(2)}/hr on bill=${billRate} pay=${payRate}`,
          breakdown,
          suggestedBillRate,
          suggestedPayRate,
        },
        "Creating critical margin alert — CFO escalation required",
        context.workflowId
      );

      this.escalate(
        `Critically low margin ($${breakdown.netMarginHr.toFixed(2)}/hr) requires CFO override`,
        { submissionId, breakdown, suggestedBillRate, suggestedPayRate },
        context.workflowId
      );

      return this.buildResult(
        false,
        {
          approved: false,
          netMarginHr: breakdown.netMarginHr,
          grossMarginHr: breakdown.grossMarginHr,
          suggestedBillRate,
          suggestedPayRate,
          breakdown,
          hardBlock: true,
          requiresCFOOverride: true,
        },
        {
          reason: `Critically low margin: $${breakdown.netMarginHr.toFixed(2)}/hr — requires CFO override`,
          context: { submissionId, breakdown },
        }
      );
    }

    if (submissionId) {
      await this.callTool(
        "submission.block",
        {
          submissionId,
          reason: `Net margin $${breakdown.netMarginHr.toFixed(2)}/hr below $${MARGIN_SAFE_THRESHOLD} threshold`,
          breakdown,
          suggestedBillRate,
          suggestedPayRate,
        },
        `Blocking submission ${submissionId} — margin below threshold`,
        context.workflowId
      );
    }

    await this.callTool(
      "alert.create",
      {
        type: "margin_warning",
        severity: "warning",
        submissionId,
        message: `Low margin: $${breakdown.netMarginHr.toFixed(2)}/hr — suggest bill rate $${suggestedBillRate}/hr`,
        breakdown,
        suggestedBillRate,
        suggestedPayRate,
      },
      "Creating margin warning alert",
      context.workflowId
    );

    return this.buildResult(false, {
      approved: false,
      netMarginHr: breakdown.netMarginHr,
      grossMarginHr: breakdown.grossMarginHr,
      suggestedBillRate,
      suggestedPayRate,
      breakdown,
      hardBlock: false,
      requiresCFOOverride: false,
    });
  }

  private computeMarginBreakdown(input: MarginInput): MarginBreakdown {
    const grossMarginHr = input.billRate - input.payRate;
    const burdenCost = (input.payRate * input.burdenPct) / 100;
    const payrollTaxCost = (input.payRate * input.payrollTaxPct) / 100;
    const vendorCost = (input.billRate * input.vendorCutPct) / 100;
    const portalCost = (input.billRate * input.portalFeePct) / 100;
    const totalEffectiveCosts =
      burdenCost + payrollTaxCost + vendorCost + portalCost + input.otherFees;
    const netMarginHr = grossMarginHr - totalEffectiveCosts;
    const netMarginPct = input.billRate > 0 ? (netMarginHr / input.billRate) * 100 : 0;

    return {
      billRate: input.billRate,
      payRate: input.payRate,
      grossMarginHr,
      vendorCost,
      portalCost,
      burdenCost,
      payrollTaxCost,
      otherFees: input.otherFees,
      totalEffectiveCosts,
      netMarginHr,
      netMarginPct,
    };
  }

  private computeMinBillRate(
    payRate: number,
    vendorCutPct: number,
    burdenPct: number,
    payrollTaxPct: number,
    portalFeePct: number,
    otherFees: number,
    targetMargin: number
  ): number {
    const paySideCosts = payRate * (burdenPct + payrollTaxPct) / 100;
    const billPctCosts = (vendorCutPct + portalFeePct) / 100;
    // netMargin = billRate - payRate - paySideCosts - billRate * billPctCosts - otherFees >= targetMargin
    // billRate * (1 - billPctCosts) >= payRate + paySideCosts + otherFees + targetMargin
    const denominator = 1 - billPctCosts;
    if (denominator <= 0) return payRate + targetMargin + paySideCosts + otherFees;
    return Math.ceil((payRate + paySideCosts + otherFees + targetMargin) / denominator);
  }

  private computeMaxPayRate(
    billRate: number,
    vendorCutPct: number,
    burdenPct: number,
    payrollTaxPct: number,
    portalFeePct: number,
    otherFees: number,
    targetMargin: number
  ): number {
    const billSideCosts = billRate * (vendorCutPct + portalFeePct) / 100;
    const payPctCosts = (burdenPct + payrollTaxPct) / 100;
    // netMargin = billRate - payRate - payRate * payPctCosts - billSideCosts - otherFees >= targetMargin
    // payRate * (1 + payPctCosts) <= billRate - billSideCosts - otherFees - targetMargin
    const denominator = 1 + payPctCosts;
    return Math.floor((billRate - billSideCosts - otherFees - targetMargin) / denominator);
  }
}
