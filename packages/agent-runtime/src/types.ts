import { z } from "zod";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const RateLimitsSchema = z.object({
  perMinute: z.number().int().positive(),
  perHour: z.number().int().positive(),
  daily: z.number().int().positive(),
});

export const AgentConfigSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  name: z.string().min(1),
  allowedTools: z.array(z.string()),
  approvalRequired: z.record(z.array(z.string())),
  rateLimits: RateLimitsSchema,
  tenantId: z.string().min(1),
});

export const ToolCallSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  tenantId: z.string(),
  tool: z.string(),
  input: z.record(z.unknown()),
  reason: z.string(),
  workflowId: z.string().optional(),
});

export const ToolResultSchema = z.object({
  success: z.boolean(),
  output: z.record(z.unknown()),
  durationMs: z.number(),
});

export const AuditEntrySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  agentRole: z.string(),
  tenantId: z.string(),
  tool: z.string(),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  reason: z.string(),
  workflowId: z.string().optional(),
  durationMs: z.number(),
  status: z.enum(["success", "failure", "escalated", "denied"]),
  timestamp: z.date(),
});

export const PolicyDecisionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  requiresApproval: z.boolean().optional(),
  approverRoles: z.array(z.string()).optional(),
});

// ── TypeScript interfaces (derived from schemas) ─────────────────────────────

export type RateLimits = z.infer<typeof RateLimitsSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

// ── Additional runtime types ─────────────────────────────────────────────────

export interface AgentContext {
  workflowId: string;
  tenantId: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output: Record<string, unknown>;
  toolCalls: AuditEntry[];
  escalation?: {
    reason: string;
    context: Record<string, unknown>;
  };
}

export interface EscalationEvent {
  agentId: string;
  agentRole: string;
  tenantId: string;
  workflowId?: string;
  reason: string;
  context: Record<string, unknown>;
  timestamp: Date;
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;
