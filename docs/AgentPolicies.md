# Agent Policies — AI-RUN SOS

## Principles

1. **Disclosure**: All agents MUST identify as AI assistants in any external communication
2. **Least Privilege**: Agents only access tools required for their role
3. **Audit Trail**: Every action is logged with input, output, reason, and workflow context
4. **Human Gates**: Sensitive actions require human approval before execution
5. **Rate Limits**: Agents have per-minute and per-hour action limits
6. **Sandboxing**: Agents run in isolated contexts with no cross-tenant access

## Agent Registry

### Front-Office Agents

| Agent | Role | Allowed Tools | Approval Required |
|-------|------|---------------|-------------------|
| VendorOnboardingAgent | `vendor_ops` | vendor.create, vendor.update, document.request, email.send | High-risk terms → Management |
| JobIntakeAgent | `job_ops` | job.create, job.update, vendor.query, email.send | None |
| SalesNegotiationAgent | `sales_assist` | rate.benchmark, email.draft, vendor.query | Rate proposals → Management |

### Recruiting Agents

| Agent | Role | Allowed Tools | Approval Required |
|-------|------|---------------|-------------------|
| TalentSourcingAgent | `sourcing` | consultant.search, consultant.shortlist | None |
| ResumeForensicsAgent | `verification` | consultant.read, verification.flag | None (flags only, never accuses) |
| SubmissionAgent | `submissions` | submission.create, consent.check, duplicate.check, email.send | Consent required from consultant |
| InterviewCoordinatorAgent | `scheduling` | interview.schedule, email.send, calendar.query | None |

### Back-Office Agents

| Agent | Role | Allowed Tools | Approval Required |
|-------|------|---------------|-------------------|
| ImmigrationOpsAgent | `immigration` | case.track, document.request, alert.create | Filing → Management |
| TimesheetAndInvoicingAgent | `billing` | timesheet.chase, invoice.generate, payment.remind | Write-off → Management |
| ComplianceAgent | `compliance` | compliance.check, onboarding.block, document.verify | Override → Management |

### Meta Agents

| Agent | Role | Allowed Tools | Approval Required |
|-------|------|---------------|-------------------|
| TrustGraphAgent | `analytics` | trust.compute, event.read | None (read-only computation) |
| QualityPlacementsAgent | `analytics` | placement.analyze, match.rank | None (advisory only) |

## Tool Security Model

```
Agent → Policy Check → Tool Router → Rate Limiter → Tool Execution → Audit Logger
                ↓                                           ↓
        [Denied → Escalate]                     [Log: input, output, reason, workflow_id]
```

### Tool Call Schema (every invocation)

```json
{
  "agentId": "string",
  "agentRole": "string",
  "tenantId": "string",
  "tool": "string",
  "input": {},
  "reason": "string",
  "workflowId": "string (optional)",
  "timestamp": "ISO8601"
}
```

### Audit Log Schema (every result)

```json
{
  "agentId": "string",
  "tool": "string",
  "input": {},
  "output": {},
  "reason": "string",
  "workflowId": "string",
  "durationMs": "number",
  "status": "success | failure | escalated",
  "timestamp": "ISO8601"
}
```

## Rate Limits

| Agent Type | Per Minute | Per Hour | Daily |
|------------|-----------|----------|-------|
| Front-office | 30 | 500 | 5000 |
| Recruiting | 60 | 1000 | 10000 |
| Back-office | 20 | 300 | 3000 |
| Meta (analytics) | 10 | 100 | 1000 |

## Communication Policies

### Email Signature (required for all outbound)
```
---
[Agent Name] — AI Assistant
[Company Name] | Powered by AI-RUN SOS
This message was composed by an AI assistant. For human assistance, reply with "HUMAN" or contact [fallback email].
```

### Tone Controls
- Professional, concise, never aggressive
- Payment reminders: escalating formality (friendly → firm → formal → escalation notice)
- Never threaten legal action (escalate to human)
- Never make promises about timelines without checking workflow state

## Escalation Rules

1. Agent cannot complete action → create task for human with full context
2. Agent encounters ambiguous input → ask clarifying question (max 2 rounds, then escalate)
3. Agent hits rate limit → queue action, notify management
4. Agent policy violation attempt → block, log, alert management
5. External party requests human → immediately route to assigned human
