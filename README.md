# AI-RUN SOS — Staffing Operating System

An AI-run staffing operating system where agents handle 90-95% of operational work. Humans approve exceptions and set strategy. The platform is the **truth layer** for staffing.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 3: Agent Runtime                │
│  RecruiterAgent · JobIntakeAgent · SubmissionAgent       │
│  ComplianceAgent · TrustGraphAgent · ...                 │
├─────────────────────────────────────────────────────────┤
│                    Layer 2: Workflow Engine               │
│  Job Intake → Sourcing → Submission → Interview →        │
│  Offer → Onboarding → Billing → Payroll                  │
├─────────────────────────────────────────────────────────┤
│                    Layer 1: System of Record              │
│  Postgres (RLS) · Prisma · Audit Logs · Trust Graph      │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 1. Clone and install

```bash
npm install
```

### 2. Start infrastructure

```bash
cd infra
docker-compose up -d
```

### 3. Set up environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work with docker-compose)
```

### 4. Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

### 5. Seed the database

```bash
npm run db:seed
```

### 6. Start development

```bash
npm run dev
```

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001/api

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Management | md@apex-staffing.com | Password123! |
| Recruitment | recruiter@apex-staffing.com | Password123! |
| Sales | sales@apex-staffing.com | Password123! |
| HR | hr@apex-staffing.com | Password123! |
| Immigration | immigration@apex-staffing.com | Password123! |
| Accounts | accounts@apex-staffing.com | Password123! |

## Project Structure

```
/apps
  /web              Next.js 14 — Role-based UI with Tailwind
  /api              NestJS — REST API with JWT auth + RBAC
/packages
  /db               Prisma schema + migrations + seed
  /contracts        Shared Zod schemas + TypeScript types
  /agent-runtime    Agent framework (policy engine, tool router, audit)
/infra
  docker-compose.yml   Postgres 16 + Redis 7
  init-db.sql          Row-Level Security policies
/docs
  PRD.md               Product requirements
  RBAC.md              Role permissions matrix
  DataModel.md         Entity relationship documentation
  Workflows.md         State machine definitions
  AgentPolicies.md     Agent security + tool policies
```

## Role-Based Portals

| Role | Portal | Key Features |
|------|--------|-------------|
| Management | Command Center | Revenue pipeline, margin health, vendor trust scores, risk heatmap |
| Consultant | Trust Wallet | Submission ledger, consent controls, pay calendar, immigration timeline |
| Recruitment | Sourcing Cockpit | Candidate matching, submission builder, follow-up automation |
| Sales | Vendor Intelligence | Vendor reliability scores, rate benchmarks, deal predictions |
| HR | Onboarding Hub | Digital checklists, compliance tracking, engagement scores |
| Immigration | Case Manager | Visa tracker, constraint generator, auto-reminders |
| Accounts | Billing Truth | Timesheet workflow, invoicing, AR aging, margin leakage detection |

## AI Agents

| Agent | Role | What It Does |
|-------|------|-------------|
| JobIntakeAgent | job_ops | Parses JDs into structured requirements, scores closure likelihood |
| TalentSourcingAgent | sourcing | Searches candidates, builds ranked shortlists |
| SubmissionAgent | submissions | Handles consent, deduplication, submission creation |
| VendorOnboardingAgent | vendor_ops | Collects docs, flags high-risk terms |
| ComplianceAgent | compliance | Blocks onboarding if docs incomplete |
| TrustGraphAgent | analytics | Computes trust scores from behavioral events |

All agents are policy-bound, rate-limited, and fully audited. Every action is logged with input, output, reason, and workflow context.

## Security Model

- **Multi-tenant isolation**: Postgres Row-Level Security on all tables
- **Agent sandboxing**: Tool allow-lists, rate limits, approval gates
- **Immutable audit trail**: Every agent action and API call is logged
- **Human oversight gates**: Immigration, payroll, contracts require sign-off
- **AI disclosure**: All agent communications identify as AI assistants

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Zustand, HeadlessUI
- **Backend**: NestJS, TypeScript, Passport JWT, class-validator
- **Database**: PostgreSQL 16 with Row-Level Security
- **ORM**: Prisma 6
- **Cache**: Redis 7
- **Agent Runtime**: Custom TypeScript framework (policy engine + tool router + audit logger)
- **Infrastructure**: Docker Compose (dev), Terraform (prod)
# AI-Run-SOS
