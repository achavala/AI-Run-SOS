import type { AgentConfig, PolicyDecision, ToolCall } from "./types.js";

export class PolicyEngine {
  check(agentConfig: AgentConfig, toolCall: ToolCall): PolicyDecision {
    if (!agentConfig.allowedTools.includes(toolCall.tool)) {
      return {
        allowed: false,
        reason: `Agent "${agentConfig.name}" (role: ${agentConfig.role}) is not permitted to use tool "${toolCall.tool}". Allowed tools: [${agentConfig.allowedTools.join(", ")}]`,
      };
    }

    if (agentConfig.tenantId !== toolCall.tenantId) {
      return {
        allowed: false,
        reason: `Tenant mismatch: agent belongs to "${agentConfig.tenantId}" but tool call targets "${toolCall.tenantId}"`,
      };
    }

    const approverRoles = agentConfig.approvalRequired[toolCall.tool];
    if (approverRoles && approverRoles.length > 0) {
      return {
        allowed: true,
        reason: `Tool "${toolCall.tool}" requires approval from: [${approverRoles.join(", ")}]`,
        requiresApproval: true,
        approverRoles,
      };
    }

    return {
      allowed: true,
      reason: "Tool call permitted by policy",
    };
  }
}
