import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

type Pod = "SWE" | "CLOUD_DEVOPS" | "DATA" | "CYBER";

interface Scoreboard {
  date: string;
  qualifiedReqs: number;
  submissions: number;
  interviews: number;
  offers: number;
  closures: number;
  targetClosures: number;
  onTrack: boolean;
}

interface ActionItem {
  type: "increase_submissions" | "follow_up_interviews" | "quality_check" | "escalation";
  pod: Pod | "ALL";
  description: string;
  priority: "high" | "medium" | "low";
  quantity?: number;
}

interface ConversionRates {
  reqToSubmission: number;
  submissionToInterview: number;
  interviewToOffer: number;
  offerToClosure: number;
  overall: number;
}

const TARGET_CLOSURES_PER_DAY = 1;
const SYSTEMIC_ISSUE_THRESHOLD_DAYS = 3;
const ALL_PODS: Pod[] = ["SWE", "CLOUD_DEVOPS", "DATA", "CYBER"];

/**
 * AutopilotGM — Boss Agent that manages the daily scoreboard, tracks pipeline
 * against closure targets, generates action plans, and escalates systemic issues.
 */
export class AutopilotGMAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const today = new Date().toISOString().split("T")[0]!;

    const scoreboardResult = await this.callTool(
      "scoreboard.read",
      { date: today },
      `Reading today's scoreboard for ${today}`,
      context.workflowId
    );

    let scoreboard: Scoreboard;

    if (!scoreboardResult.success || !scoreboardResult.output["scoreboard"]) {
      const createResult = await this.callTool(
        "scoreboard.update",
        {
          date: today,
          qualifiedReqs: 0,
          submissions: 0,
          interviews: 0,
          offers: 0,
          closures: 0,
          targetClosures: TARGET_CLOSURES_PER_DAY,
        },
        `Creating new scoreboard for ${today}`,
        context.workflowId
      );

      scoreboard = {
        date: today,
        qualifiedReqs: 0,
        submissions: 0,
        interviews: 0,
        offers: 0,
        closures: 0,
        targetClosures: TARGET_CLOSURES_PER_DAY,
        onTrack: false,
      };
    } else {
      scoreboard = scoreboardResult.output["scoreboard"] as Scoreboard;
    }

    const metricsResult = await this.callTool(
      "job.query",
      { status: "active", qualified: true },
      "Querying actual metrics: qualified reqs",
      context.workflowId
    );

    const qualifiedReqs = metricsResult.success
      ? (metricsResult.output["totalCount"] as number) ?? 0
      : scoreboard.qualifiedReqs;

    const submissionsResult = await this.callTool(
      "submission.analytics",
      { date: today },
      "Querying today's submission count",
      context.workflowId
    );

    const submissions = submissionsResult.success
      ? (submissionsResult.output["totalSubmissions"] as number) ?? 0
      : scoreboard.submissions;
    const interviews = submissionsResult.success
      ? (submissionsResult.output["interviews"] as number) ?? 0
      : scoreboard.interviews;
    const offers = submissionsResult.success
      ? (submissionsResult.output["offers"] as number) ?? 0
      : scoreboard.offers;
    const closures = submissionsResult.success
      ? (submissionsResult.output["closures"] as number) ?? 0
      : scoreboard.closures;

    const conversionResult = await this.callTool(
      "submission.analytics",
      { period: "30d", metric: "conversion_rates" },
      "Computing conversion rates from last 30 days",
      context.workflowId
    );

    const conversionRates: ConversionRates = conversionResult.success
      ? {
          reqToSubmission: (conversionResult.output["reqToSubmission"] as number) ?? 0,
          submissionToInterview: (conversionResult.output["submissionToInterview"] as number) ?? 0,
          interviewToOffer: (conversionResult.output["interviewToOffer"] as number) ?? 0,
          offerToClosure: (conversionResult.output["offerToClosure"] as number) ?? 0,
          overall: (conversionResult.output["overall"] as number) ?? 0,
        }
      : {
          reqToSubmission: 0,
          submissionToInterview: 0,
          interviewToOffer: 0,
          offerToClosure: 0,
          overall: 0,
        };

    const onTrack = closures >= TARGET_CLOSURES_PER_DAY;

    const updatedScoreboard: Scoreboard = {
      date: today,
      qualifiedReqs,
      submissions,
      interviews,
      offers,
      closures,
      targetClosures: TARGET_CLOSURES_PER_DAY,
      onTrack,
    };

    await this.callTool(
      "scoreboard.update",
      updatedScoreboard as unknown as Record<string, unknown>,
      `Updating scoreboard for ${today}`,
      context.workflowId
    );

    const actionPlan: ActionItem[] = [];
    const alerts: Array<Record<string, unknown>> = [];

    if (!onTrack) {
      const neededClosures = TARGET_CLOSURES_PER_DAY - closures;
      const neededOffers =
        conversionRates.offerToClosure > 0
          ? Math.ceil(neededClosures / conversionRates.offerToClosure)
          : neededClosures * 2;
      const neededInterviews =
        conversionRates.interviewToOffer > 0
          ? Math.ceil(neededOffers / conversionRates.interviewToOffer)
          : neededOffers * 3;
      const neededSubmissions =
        conversionRates.submissionToInterview > 0
          ? Math.ceil(neededInterviews / conversionRates.submissionToInterview)
          : neededInterviews * 3;

      const submissionDeficit = Math.max(0, neededSubmissions - submissions);

      if (submissionDeficit > 0) {
        const marketResult = await this.callTool(
          "market.analyze",
          { pods: ALL_PODS, metric: "submission_volume" },
          "Analyzing which pods need more submissions",
          context.workflowId
        );

        const podVolumes = marketResult.success
          ? (marketResult.output["podVolumes"] as Record<string, number>) ?? {}
          : {};

        const lowestPod = ALL_PODS.reduce(
          (min, pod) => ((podVolumes[pod] ?? 0) < (podVolumes[min] ?? 0) ? pod : min),
          ALL_PODS[0]!
        );

        actionPlan.push({
          type: "increase_submissions",
          pod: lowestPod,
          description: `Need ${submissionDeficit} more submissions to ${lowestPod} pod`,
          priority: "high",
          quantity: submissionDeficit,
        });
      }

      if (interviews > 0 && offers === 0) {
        actionPlan.push({
          type: "follow_up_interviews",
          pod: "ALL",
          description: `Follow up on ${interviews} pending interviews with no offers yet`,
          priority: "high",
          quantity: interviews,
        });
      }

      if (conversionRates.submissionToInterview < 0.2) {
        actionPlan.push({
          type: "quality_check",
          pod: "ALL",
          description: "Low submission-to-interview rate — tighten verification before submitting",
          priority: "medium",
        });
      }
    }

    const podFocusResult = await this.callTool(
      "market.analyze",
      { pods: ALL_PODS, metric: "opportunity_score" },
      "Determining pod focus recommendation",
      context.workflowId
    );

    const podScores = podFocusResult.success
      ? (podFocusResult.output["podScores"] as Record<string, number>) ?? {}
      : {};

    const podFocusRecommendation = ALL_PODS.reduce(
      (best, pod) => ((podScores[pod] ?? 0) > (podScores[best] ?? 0) ? pod : best),
      ALL_PODS[0]!
    );

    const historyResult = await this.callTool(
      "scoreboard.read",
      { period: `${SYSTEMIC_ISSUE_THRESHOLD_DAYS}d` },
      `Reading last ${SYSTEMIC_ISSUE_THRESHOLD_DAYS} days of scoreboard data`,
      context.workflowId
    );

    const recentScoreboards = historyResult.success
      ? (historyResult.output["scoreboards"] as Scoreboard[]) ?? []
      : [];

    const daysBelowTarget = recentScoreboards.filter(
      (s) => s.closures < s.targetClosures
    ).length;

    if (daysBelowTarget >= SYSTEMIC_ISSUE_THRESHOLD_DAYS) {
      const alertResult = await this.callTool(
        "alert.create",
        {
          type: "systemic_underperformance",
          severity: "critical",
          message: `${daysBelowTarget} consecutive days below closure target`,
          data: { daysBelowTarget, recentScoreboards, conversionRates },
        },
        "Escalating systemic underperformance to management",
        context.workflowId
      );

      alerts.push({
        type: "systemic_underperformance",
        daysBelowTarget,
        alertId: alertResult.output["alertId"],
      });

      actionPlan.push({
        type: "escalation",
        pod: "ALL",
        description: `Systemic issue: ${daysBelowTarget}+ days below target — escalated to MANAGEMENT`,
        priority: "high",
      });

      this.escalate(
        `Systemic underperformance: ${daysBelowTarget} days below closure target`,
        { daysBelowTarget, conversionRates, recentScoreboards },
        context.workflowId
      );
    }

    return this.buildResult(
      true,
      {
        scoreboard: updatedScoreboard,
        conversionRates,
        actionPlan,
        alerts,
        podFocusRecommendation,
      },
      daysBelowTarget >= SYSTEMIC_ISSUE_THRESHOLD_DAYS
        ? {
            reason: `Systemic underperformance: ${daysBelowTarget} days below closure target`,
            context: { daysBelowTarget, conversionRates },
          }
        : undefined
    );
  }
}
