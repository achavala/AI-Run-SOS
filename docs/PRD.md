# Product Requirements Document — AI-RUN SOS (Staffing Operating System)

## Vision

Self-driving IT staffing company. Agents do 95% of operational work. 3 humans approve exceptions and set strategy.

## Target

- **1 closure/day** with ≥ **$10/hr margin**
- Quality over volume: 20–25 quality submissions per closure (not 60–100 spam)

## 4 Pods

| Pod | Focus |
|-----|-------|
| **SWE** | Cloud Backend, Fullstack |
| **Cloud/DevOps/Platform** | DevOps, SRE, Platform Engineering |
| **Data** | Data Engineering, Data Platform |
| **Cyber** | Security, IAM |

## Closure Math

- **20–25** quality submissions → 1 closure
- Conversion targets:
  - **20%** sub → interview
  - **30%** interview → offer
  - **80%** offer → accept

## Phase 1 MVP Scope

Same 7 modules, with pod focus + MarginGuard + scoreboard:

1. Multi-tenant auth + RBAC (7 roles)
2. Vendor/Client + Job Intake (structured JD, pod assignment)
3. Consultant profile + consent ledger (readiness tracking)
4. Submission workflow + audit log
5. Interview scheduling + feedback capture
6. Timesheets → Invoicing → Payment status
7. **MarginGuard** (margin calc, $10/hr floor, CFO exceptions)
8. **Daily Scoreboard** (AutopilotGM targets by pod)

## 3 Human Roles

| Role | Responsibility |
|------|----------------|
| **President** | Vendor strategy, rate bands, priority vendors |
| **MD** | Compliance gates, immigration gates, doc verification |
| **CFO** | Rate exceptions (< $10/hr), AR, cashflow, write-offs |

## Success Metrics

- **PQS** (Placement Quality Score): 30/60/90-day retention, extension rate, margin realized vs planned
- **Recruiter Score**: interview/offer conversion rate, rework rate
- **Vendor Score**: pay speed, ghost rate, rate honesty, dispute frequency
- **Daily Scoreboard targets**: submissions by pod, interviews scheduled, offers extended, closures, margin

## Non-Negotiables

- AI agents MUST disclose they are AI assistants (never impersonate humans)
- Immigration + payroll actions require human sign-off
- Every agent action is logged with input, output, reason, workflow ID
- Tool allow-lists + sandboxed execution for all agents
- Secrets must be vaulted, never in plaintext config
