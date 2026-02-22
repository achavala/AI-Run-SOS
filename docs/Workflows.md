# Workflow Definitions — AI-RUN SOS

All workflows are deterministic state machines. Each transition is logged.

## 1. Job Workflow

```
NEW → QUALIFYING → ACTIVE → ON_HOLD | FILLED | CANCELLED
```

| State | Description |
|-------|-------------|
| NEW | Raw intake, not yet qualified |
| QUALIFYING | Parsing, clarification, pod assignment |
| ACTIVE | Open for submissions |
| ON_HOLD | Paused (client pause, rate renegotiation) |
| FILLED | Position closed |
| CANCELLED | Job no longer valid |

**Agents:** ReqCollector Swarm, MarketPulse  
**Human gates:** None (Management can override)

---

## 2. Consultant Readiness Workflow

```
NEW → DOCS_PENDING → VERIFIED → SUBMISSION_READY → ON_ASSIGNMENT | OFFBOARDED
```

| State | Description |
|-------|-------------|
| NEW | Profile created, not yet vetted |
| DOCS_PENDING | Awaiting resume, work auth, verification docs |
| VERIFIED | TrustVerification passed, docs complete |
| SUBMISSION_READY | Can be submitted to jobs |
| ON_ASSIGNMENT | Currently placed |
| OFFBOARDED | Assignment ended, may return to SUBMISSION_READY |

**Agents:** TrustVerification, SupplyRadar  
**Human gates:** MD for compliance/immigration overrides

---

## 3. Submission Workflow

```
DRAFT → CONSENT_PENDING → SUBMITTED → INTERVIEWING → OFFERED → ACCEPTED → CLOSED
```

| State | Description |
|-------|-------------|
| DRAFT | Being prepared, not yet sent |
| CONSENT_PENDING | Awaiting consultant consent |
| SUBMITTED | Sent to vendor |
| INTERVIEWING | Interview scheduled or in progress |
| OFFERED | Offer extended to consultant |
| ACCEPTED | Consultant accepted offer |
| CLOSED | Rejected, withdrawn, or converted to placement |

**Agents:** FollowUpScheduler, MarginGuard (pre-submit margin check)  
**Human gates:** Consultant consent; CFO for sub < $10/hr margin

---

## 4. Offer Workflow

```
EXTENDED → ACCEPTED | DECLINED | EXPIRED | WITHDRAWN
```

| State | Description |
|-------|-------------|
| EXTENDED | Offer sent to consultant |
| ACCEPTED | Consultant accepted |
| DECLINED | Consultant declined |
| EXPIRED | Offer deadline passed |
| WITHDRAWN | Client/vendor withdrew |

**Agents:** FollowUpScheduler  
**Human gates:** None

---

## 5. Assignment Workflow

```
ONBOARDING → ACTIVE → ENDING → COMPLETED | TERMINATED
```

| State | Description |
|-------|-------------|
| ONBOARDING | Compliance check, docs, start prep |
| ACTIVE | Consultant working |
| ENDING | Notice given, winding down |
| COMPLETED | Normal end |
| TERMINATED | Early termination |

**Agents:** TrustVerification (compliance), FollowUpScheduler  
**Human gates:** MD for compliance override

---

## 6. Timesheet Workflow

```
DRAFT → SUBMITTED → APPROVED | REJECTED → INVOICED
```

| State | Description |
|-------|-------------|
| DRAFT | Consultant editing |
| SUBMITTED | Sent for approval |
| APPROVED | Approved by vendor/manager |
| REJECTED | Sent back to DRAFT with feedback |
| INVOICED | Rolled into invoice |

**Agents:** TimesheetAndInvoicingAgent (or equivalent)  
**Human gates:** Approval by vendor/manager

---

## 7. Invoice Workflow

```
DRAFT → SENT → PAID | PARTIAL | OVERDUE | DISPUTED
```

| State | Description |
|-------|-------------|
| DRAFT | Being prepared |
| SENT | Sent to vendor |
| PAID | Fully paid |
| PARTIAL | Partial payment received |
| OVERDUE | Past due date |
| DISPUTED | Vendor disputes |

**Agents:** TimesheetAndInvoicingAgent  
**Human gates:** CFO for write-offs

---

## 8. Daily AutopilotGM Scoreboard Workflow

```
[Daily Trigger] → [Aggregate Pod Metrics] → [Compute Targets vs Actual] → [Generate Scoreboard] → [Notify/Display]
```

**Metrics per pod:**
- Submissions (target: quality count toward 20–25/closure)
- Interviews scheduled (target: 20% sub→interview)
- Offers extended (target: 30% interview→offer)
- Closures (target: 1/day)
- Margin (target: ≥ $10/hr)

**Agent:** AutopilotGM  
**Output:** Daily scoreboard for President, MD, CFO

---

## Workflow Engine

All workflows run on Temporal (or equivalent durable execution engine).

- Automatic retries with backoff
- Workflow state persisted and queryable
- Long-running workflows supported
- Built-in visibility and debugging
