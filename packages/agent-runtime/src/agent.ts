import { v4 as uuidv4 } from "uuid";
import { AuditLogger } from "./audit-logger.js";
import { PolicyEngine } from "./policy-engine.js";
import { RateLimiter } from "./rate-limiter.js";
import { ToolRouter } from "./tool-router.js";
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  AuditEntry,
  EscalationEvent,
  ToolResult,
} from "./types.js";

export abstract class BaseAgent {
  public readonly config: AgentConfig;
  protected policyEngine: PolicyEngine;
  protected toolRouter: ToolRouter;
  protected auditLogger: AuditLogger;
  protected rateLimiter: RateLimiter;
  protected escalations: EscalationEvent[] = [];
  protected toolCallLog: AuditEntry[] = [];

  constructor(
    config: AgentConfig,
    deps?: {
      policyEngine?: PolicyEngine;
      toolRouter?: ToolRouter;
      auditLogger?: AuditLogger;
      rateLimiter?: RateLimiter;
    }
  ) {
    this.config = config;
    this.policyEngine = deps?.policyEngine ?? new PolicyEngine();
    this.toolRouter = deps?.toolRouter ?? new ToolRouter();
    this.auditLogger = deps?.auditLogger ?? new AuditLogger();
    this.rateLimiter = deps?.rateLimiter ?? new RateLimiter();
    this.rateLimiter.configure(config.id, config.rateLimits);
  }

  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected async callTool(
    tool: string,
    input: Record<string, unknown>,
    reason: string,
    workflowId?: string
  ): Promise<ToolResult & { status: AuditEntry["status"] }> {
    const toolCall = {
      agentId: this.config.id,
      agentRole: this.config.role,
      tenantId: this.config.tenantId,
      tool,
      input,
      reason,
      workflowId,
    };

    const policyDecision = this.policyEngine.check(this.config, toolCall);

    if (!policyDecision.allowed) {
      const entry = this.buildAuditEntry(tool, input, reason, workflowId, {
        success: false,
        output: { error: policyDecision.reason },
        durationMs: 0,
      }, "denied");
      this.auditLogger.log(entry);
      this.toolCallLog.push(entry);
      return {
        success: false,
        output: { error: policyDecision.reason },
        durationMs: 0,
        status: "denied",
      };
    }

    if (policyDecision.requiresApproval) {
      const entry = this.buildAuditEntry(tool, input, reason, workflowId, {
        success: false,
        output: {
          pendingApproval: true,
          approverRoles: policyDecision.approverRoles,
        },
        durationMs: 0,
      }, "escalated");
      this.auditLogger.log(entry);
      this.toolCallLog.push(entry);

      this.escalations.push({
        agentId: this.config.id,
        agentRole: this.config.role,
        tenantId: this.config.tenantId,
        workflowId,
        reason: `Tool "${tool}" requires approval from: [${policyDecision.approverRoles?.join(", ")}]`,
        context: { tool, input, approverRoles: policyDecision.approverRoles },
        timestamp: new Date(),
      });

      return {
        success: false,
        output: {
          pendingApproval: true,
          approverRoles: policyDecision.approverRoles,
        },
        durationMs: 0,
        status: "escalated",
      };
    }

    const rateCheck = this.rateLimiter.check(this.config.id);
    if (!rateCheck.allowed) {
      const entry = this.buildAuditEntry(tool, input, reason, workflowId, {
        success: false,
        output: {
          error: "Rate limit exceeded",
          retryAfterMs: rateCheck.retryAfterMs,
        },
        durationMs: 0,
      }, "denied");
      this.auditLogger.log(entry);
      this.toolCallLog.push(entry);
      return {
        success: false,
        output: {
          error: "Rate limit exceeded",
          retryAfterMs: rateCheck.retryAfterMs,
        },
        durationMs: 0,
        status: "denied",
      };
    }

    this.rateLimiter.record(this.config.id);

    const result = await this.toolRouter.execute(toolCall);
    const status = result.success ? "success" : "failure";
    const entry = this.buildAuditEntry(
      tool, input, reason, workflowId, result, status
    );
    this.auditLogger.log(entry);
    this.toolCallLog.push(entry);

    return { ...result, status };
  }

  protected escalate(
    reason: string,
    context: Record<string, unknown>,
    workflowId?: string
  ): EscalationEvent {
    const event: EscalationEvent = {
      agentId: this.config.id,
      agentRole: this.config.role,
      tenantId: this.config.tenantId,
      workflowId,
      reason,
      context,
      timestamp: new Date(),
    };
    this.escalations.push(event);
    return event;
  }

  protected buildResult(
    success: boolean,
    output: Record<string, unknown>,
    escalation?: { reason: string; context: Record<string, unknown> }
  ): AgentResult {
    return {
      success,
      output,
      toolCalls: [...this.toolCallLog],
      escalation,
    };
  }

  protected resetCallLog(): void {
    this.toolCallLog = [];
  }

  private buildAuditEntry(
    tool: string,
    input: Record<string, unknown>,
    reason: string,
    workflowId: string | undefined,
    result: ToolResult,
    status: AuditEntry["status"]
  ): AuditEntry {
    return {
      id: uuidv4(),
      agentId: this.config.id,
      agentRole: this.config.role,
      tenantId: this.config.tenantId,
      tool,
      input,
      output: result.output,
      reason,
      workflowId,
      durationMs: result.durationMs,
      status,
      timestamp: new Date(),
    };
  }
}
