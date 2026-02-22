import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

type Pod = "SWE" | "CLOUD_DEVOPS" | "DATA" | "CYBER";

interface PodMetrics {
  pod: Pod;
  reqCount: number;
  avgFreshness: number;
  avgVendorTrust: number;
  recentConversionRate: number;
  combinedScore: number;
}

interface RateBand {
  pod: Pod;
  targetBillRate: number;
  walkAwayRate: number;
  marginSafePayRate: number;
}

interface VendorPriority {
  vendorId: string;
  vendorName: string;
  trustScore: number;
  responseRate: number;
  priorityScore: number;
}

const ALL_PODS: Pod[] = ["SWE", "CLOUD_DEVOPS", "DATA", "CYBER"];
const MIN_MARGIN_PER_HOUR = 10;

/**
 * MarketPulse — Sales Strategist agent that analyzes active jobs across pods,
 * determines daily focus, computes rate bands, and ranks vendors by priority.
 */
export class MarketPulseAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const jobsResult = await this.callTool(
      "job.query",
      { status: "active", groupBy: "pod" },
      "Querying all active jobs grouped by pod",
      context.workflowId
    );

    if (!jobsResult.success) {
      return this.buildResult(false, {
        error: "Failed to query active jobs",
        details: jobsResult.output,
      });
    }

    const jobsByPod = (jobsResult.output["jobsByPod"] as Record<string, Array<Record<string, unknown>>>) ?? {};

    const podMetrics: PodMetrics[] = [];

    for (const pod of ALL_PODS) {
      const jobs = jobsByPod[pod] ?? [];
      const reqCount = jobs.length;

      if (reqCount === 0) {
        podMetrics.push({
          pod,
          reqCount: 0,
          avgFreshness: 0,
          avgVendorTrust: 0,
          recentConversionRate: 0,
          combinedScore: 0,
        });
        continue;
      }

      const avgFreshness =
        jobs.reduce((sum, j) => sum + ((j["freshnessScore"] as number) ?? 0), 0) / reqCount;

      const vendorResult = await this.callTool(
        "vendor.query",
        { pod },
        `Querying vendors for pod ${pod}`,
        context.workflowId
      );

      const vendors = vendorResult.success
        ? (vendorResult.output["vendors"] as Array<Record<string, unknown>>) ?? []
        : [];
      const avgVendorTrust =
        vendors.length > 0
          ? vendors.reduce((sum, v) => sum + ((v["trustScore"] as number) ?? 0), 0) / vendors.length
          : 0;

      const trustResult = await this.callTool(
        "trust.read",
        { entityType: "pod", entityId: pod },
        `Reading trust metrics for pod ${pod}`,
        context.workflowId
      );

      const podTrust = trustResult.success
        ? (trustResult.output["currentScore"] as number) ?? 0
        : avgVendorTrust;

      const analyticsResult = await this.callTool(
        "submission.analytics",
        { pod, period: "30d" },
        `Getting submission analytics for pod ${pod}`,
        context.workflowId
      );

      const recentConversionRate = analyticsResult.success
        ? (analyticsResult.output["conversionRate"] as number) ?? 0
        : 0;

      const combinedScore = reqCount * avgFreshness * podTrust * recentConversionRate;

      podMetrics.push({
        pod,
        reqCount,
        avgFreshness,
        avgVendorTrust,
        recentConversionRate,
        combinedScore,
      });
    }

    const sortedPods = [...podMetrics].sort((a, b) => b.combinedScore - a.combinedScore);
    const podFocus = sortedPods[0]!;

    const marketResult = await this.callTool(
      "market.analyze",
      { pods: ALL_PODS },
      "Analyzing market rates across all pods",
      context.workflowId
    );

    const marketRates = marketResult.success
      ? (marketResult.output["ratesByPod"] as Record<string, Record<string, number>>) ?? {}
      : {};

    const rateBands: RateBand[] = ALL_PODS.map((pod) => {
      const rates = marketRates[pod] ?? {};
      const avgBillRate = (rates["avgBillRate"] as number) ?? 100;
      const targetBillRate = Math.round(avgBillRate * 1.05);
      const walkAwayRate = Math.round(avgBillRate * 0.85);
      const marginSafePayRate = targetBillRate - MIN_MARGIN_PER_HOUR;

      return { pod, targetBillRate, walkAwayRate, marginSafePayRate };
    });

    const allVendors = await this.callTool(
      "vendor.query",
      { status: "active" },
      "Querying all active vendors for priority ranking",
      context.workflowId
    );

    const vendorList = allVendors.success
      ? (allVendors.output["vendors"] as Array<Record<string, unknown>>) ?? []
      : [];

    const vendorPriority: VendorPriority[] = vendorList
      .map((v) => {
        const trustScore = (v["trustScore"] as number) ?? 0;
        const responseRate = (v["responseRate"] as number) ?? 0;
        return {
          vendorId: (v["id"] as string) ?? "",
          vendorName: (v["name"] as string) ?? "",
          trustScore,
          responseRate,
          priorityScore: trustScore * responseRate,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const marketSummary = {
      totalActiveReqs: podMetrics.reduce((sum, p) => sum + p.reqCount, 0),
      podBreakdown: podMetrics.map((p) => ({
        pod: p.pod,
        reqs: p.reqCount,
        conversionRate: p.recentConversionRate,
      })),
      topPod: podFocus.pod,
      topPodScore: podFocus.combinedScore,
      vendorsRanked: vendorPriority.length,
    };

    return this.buildResult(true, {
      podFocus: {
        pod: podFocus.pod,
        combinedScore: podFocus.combinedScore,
        reqCount: podFocus.reqCount,
        avgFreshness: podFocus.avgFreshness,
        avgVendorTrust: podFocus.avgVendorTrust,
        conversionRate: podFocus.recentConversionRate,
      },
      rateBands,
      vendorPriority,
      marketSummary,
    });
  }
}
