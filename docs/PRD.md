# Product Requirements Document — AI-RUN SOS (Staffing Operating System)

## Vision

An AI-run staffing operating system where agents handle 90–95% of operational work.
Humans approve exceptions and set strategy. The platform is the **truth layer** for staffing.

## Core Value Propositions

1. **Trust + Proof** — Every entity (vendor, consultant, job, placement) has a verifiable truth score
2. **Consent + Transparency** — Candidates see where their resume goes and control submissions
3. **Quality over Volume** — System optimizes for placement quality, not submission spam
4. **Cash Visibility** — Real-time margin, AR aging, and leakage detection

## Target Market (Wedge)

US IT staffing firms doing C2C/W2 with 10–200 consultants who suffer from:
- Vendor chaos + resume abuse
- AR leakage and margin erosion
- Immigration compliance risk
- Manual chaos in operations

## Platform Layers

### Layer 1 — System of Record (SoR)
Source of truth for: People, Jobs, Submissions, Interviews, Offers, Assignments,
Timesheets, Invoices, Payments, Payroll, Immigration Cases, Contracts, Communication Logs.

### Layer 2 — Workflow Engine
Every staffing process is a deterministic, auditable state machine:
Job Intake → Qualification → Sourcing → Submission → Interview → Offer →
Onboarding → Billing → Payroll → Offboarding.

### Layer 3 — Agent Runtime
AI agents are role-based, tool-based, policy-bound, and fully audited.

## Non-Negotiables

- AI agents MUST disclose they are AI assistants (never impersonate humans)
- Immigration + payroll actions require human sign-off
- Every agent action is logged with input, output, reason, and workflow ID
- Tool allow-lists + sandboxed execution for all agents
- Secrets must be vaulted, never in plaintext config

## Phase 1 MVP Scope

1. Multi-tenant auth + RBAC (7 roles)
2. Vendor/Client + Job Intake (structured JD)
3. Consultant profile + consent ledger
4. Submission workflow + audit log
5. Interview scheduling + feedback capture
6. Timesheets → Invoicing → Payment status
7. Basic Trust Scores (vendor pay behavior + feedback latency)

## Success Metrics

- **Placement Quality Score (PQS)**: 30/60/90-day retention, extension rate, margin realized vs planned
- **Recruiter Score**: interview/offer conversion rate, rework rate
- **Vendor Score**: pay speed, ghost rate, rate honesty, dispute frequency
