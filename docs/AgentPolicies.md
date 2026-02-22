# Agent Policies — AI-RUN SOS

## Principles

1. **Disclosure**: All agents MUST identify as AI assistants in any external communication
2. **Least Privilege**: Agents only access tools required for their role
3. **Audit Trail**: Every action is logged with input, output, reason, and workflow context
4. **Human Gates**: Sensitive actions require human approval before execution
5. **Rate Limits**: Agents have per-minute and per-hour action limits
6. **Sandboxing**: Agents run in isolated contexts with no cross-tenant access

---

## 7 Core Agents

### Strategic Agents

#### 1. MarketPulse (Sales Strategist)

| Attribute | Value |
|-----------|-------|
| Role | `sales_strategist` |
| Purpose | Daily pod focus, rate bands, vendor priority |
| Tools | job.query, vendor.query, rate.benchmark, email.draft, report.generate |
| Approval gates | Rate proposals → President |
| Rate limits | 20/min, 300/hr |

---

#### 2. SupplyRadar (Recruiting Strategist)

| Attribute | Value |
|-----------|-------|
| Role | `recruiting_strategist` |
| Purpose | Hot bench, skill gaps, nurture sequences |
| Tools | consultant.search, consultant.query, job.query, skill.gap.analyze, sequence.trigger |
| Approval gates | None |
| Rate limits | 30/min, 500/hr |

---

#### 3. ReqCollector Swarm

| Attribute | Value |
|-----------|-------|
| Role | `req_intake` |
| Purpose | Email intake, portal watch, dedup, freshness scoring |
| Tools | job.create, job.update, email.parse, portal.watch, duplicate.check, freshness.score |
| Approval gates | None |
| Rate limits | 60/min, 1000/hr |

---

#### 4. AutopilotGM (High-Level Strategist)

| Attribute | Value |
|-----------|-------|
| Role | `boss_agent` |
| Purpose | Boss agent, daily scoreboard, pod rotation, escalation |
| Tools | scoreboard.generate, pod.rotate, escalation.create, report.generate, agent.orchestrate |
| Approval gates | Escalations → President/MD/CFO |
| Rate limits | 10/min, 100/hr |

---

### Operational Agents

#### 5. MarginGuard (Deal Desk)

| Attribute | Value |
|-----------|-------|
| Role | `deal_desk` |
| Purpose | Compute margin after all costs, block sub < $10/hr unless CFO, suggest counter-offers |
| Tools | margin.compute, submission.block, counter_offer.suggest, rate.query |
| Approval gates | Sub < $10/hr margin → CFO only |
| Rate limits | 40/min, 600/hr |

---

#### 6. TrustVerification

| Attribute | Value |
|-----------|-------|
| Role | `verification` |
| Purpose | Resume forensics, verification badges, skill assessment |
| Tools | consultant.read, resume.forensics, verification.badge, skill.assess, document.verify |
| Approval gates | Compliance override → MD |
| Rate limits | 25/min, 400/hr |

---

#### 7. FollowUpScheduler

| Attribute | Value |
|-----------|-------|
| Role | `followup` |
| Purpose | Followup sequences, interview scheduling, feedback capture |
| Tools | sequence.trigger, interview.schedule, email.send, calendar.query, feedback.capture |
| Approval gates | None |
| Rate limits | 50/min, 800/hr |

---

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

---

## Rate Limits Summary

| Agent | Per Min | Per Hour |
|-------|---------|----------|
| MarketPulse | 20 | 300 |
| SupplyRadar | 30 | 500 |
| ReqCollector Swarm | 60 | 1000 |
| AutopilotGM | 10 | 100 |
| MarginGuard | 40 | 600 |
| TrustVerification | 25 | 400 |
| FollowUpScheduler | 50 | 800 |

---

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

---

## Escalation Rules

1. Agent cannot complete action → create task for human with full context
2. Agent encounters ambiguous input → ask clarifying question (max 2 rounds, then escalate)
3. Agent hits rate limit → queue action, notify management
4. Agent policy violation attempt → block, log, alert management
5. External party requests human → immediately route to assigned human
6. MarginGuard blocks submission → CFO must approve or reject
