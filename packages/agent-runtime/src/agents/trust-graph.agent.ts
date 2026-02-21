import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * TrustGraphAgent — computes trust scores from operational events,
 * reads historical trust data, and updates entity scores.
 */
export class TrustGraphAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const entityId = (context.input["entityId"] as string) ?? "";
    const entityType = (context.input["entityType"] as string) ?? "vendor";
    const events = (context.input["events"] as Array<Record<string, unknown>>) ?? [];
    const action = (context.input["action"] as string) ?? "compute";

    if (!entityId) {
      return this.buildResult(false, {
        error: "entityId is required for trust computation",
      });
    }

    if (action === "read") {
      return this.readTrustScore(entityId, entityType, context.workflowId);
    }

    // Step 1: Read current trust score
    const currentResult = await this.callTool(
      "trust.read",
      { entityId, entityType },
      `Reading current trust score for ${entityType} ${entityId}`,
      context.workflowId
    );

    const currentScore = currentResult.success
      ? (currentResult.output["currentScore"] as number) ?? 0
      : 0;
    const trend = currentResult.success
      ? (currentResult.output["trend"] as string) ?? "unknown"
      : "unknown";

    // Step 2: Compute updated trust score incorporating new events
    const eventImpact = this.computeEventImpact(events);

    const computeResult = await this.callTool(
      "trust.compute",
      {
        entityId,
        entityType,
        events,
        previousScore: currentScore,
        eventImpact,
      },
      `Computing updated trust score for ${entityType} ${entityId} with ${events.length} new events`,
      context.workflowId
    );

    if (!computeResult.success) {
      return this.buildResult(false, {
        error: "Trust computation failed",
        details: computeResult.output,
      });
    }

    const newScore = (computeResult.output["trustScore"] as number) ?? 0;
    const components = computeResult.output["components"] as Record<string, number> | undefined;
    const scoreDelta = newScore - currentScore;

    const alert =
      newScore < 0.5
        ? "critical"
        : newScore < 0.7
          ? "warning"
          : null;

    if (alert === "critical") {
      this.escalate(
        `Critical trust score for ${entityType} ${entityId}: ${newScore.toFixed(2)}`,
        {
          entityId,
          entityType,
          score: newScore,
          previousScore: currentScore,
          components,
          events,
        },
        context.workflowId
      );
    }

    return this.buildResult(true, {
      entityId,
      entityType,
      previousScore: currentScore,
      newScore,
      scoreDelta,
      trend: scoreDelta > 0.02 ? "improving" : scoreDelta < -0.02 ? "declining" : "stable",
      previousTrend: trend,
      components: components ?? {},
      eventImpact,
      eventsProcessed: events.length,
      alert,
    }, alert === "critical" ? {
      reason: `Trust score critically low: ${newScore.toFixed(2)}`,
      context: { entityId, entityType, score: newScore },
    } : undefined);
  }

  private async readTrustScore(
    entityId: string,
    entityType: string,
    workflowId?: string
  ): Promise<AgentResult> {
    const result = await this.callTool(
      "trust.read",
      { entityId, entityType },
      `Reading trust score for ${entityType} ${entityId}`,
      workflowId
    );

    if (!result.success) {
      return this.buildResult(false, {
        error: "Failed to read trust score",
        details: result.output,
      });
    }

    return this.buildResult(true, {
      entityId,
      entityType,
      currentScore: result.output["currentScore"],
      trend: result.output["trend"],
      history: result.output["history"],
      lastUpdated: result.output["lastUpdated"],
    });
  }

  private computeEventImpact(
    events: Array<Record<string, unknown>>
  ): Record<string, number> {
    const weights: Record<string, number> = {
      submission_accepted: 0.05,
      submission_rejected: -0.03,
      placement_completed: 0.08,
      placement_terminated_early: -0.1,
      document_submitted_on_time: 0.02,
      document_submitted_late: -0.04,
      compliance_violation: -0.15,
      positive_feedback: 0.03,
      negative_feedback: -0.05,
    };

    const impact: Record<string, number> = {};
    for (const event of events) {
      const type = (event["type"] as string) ?? "unknown";
      impact[type] = (impact[type] ?? 0) + (weights[type] ?? 0);
    }

    return impact;
  }
}
