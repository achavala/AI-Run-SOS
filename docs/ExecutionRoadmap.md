# Execution Roadmap — Path to 1 Closure/Day

## Current State

The intelligence brain is real:
- 35M+ vendor req signals extracted from email
- 31K vendor contacts, 17K consultants, 7.1K vendor companies
- Trust scoring, margin guard, submission workflows with consent + dedup
- Market job aggregation from 12 sources
- Command Center with autopilot plan
- 12 AI agents for strategic analysis

**What's missing:** The "execution limbs" — outbound email, follow-up enforcement, response detection, and auto-submit queue.

---

## Epic 1 — Graph Outbound + Threading (CRITICAL PATH)

**Goal:** When a submission is "sent," it is *actually sent* via Microsoft Graph, and the system stores message/thread IDs for follow-up threading.

### Tasks

- [x] Create `EmailSenderService` in `apps/api/src/email/`
  - Microsoft Graph `sendMail` via client credentials
  - Rate-limit + retry with exponential backoff (Graph throttling)
  - Attachment support (resume PDF)
- [x] Add DB fields to `Submission` model:
  - `sentEmailId` — Graph message ID
  - `sentConversationId` — Conversation thread ID
  - `sentAt` — When email was actually sent
  - `sentTo` — Recipient email
  - `sentSubject` — Subject line sent
- [x] Update `SubmissionsService.send()`:
  - Call EmailSenderService (not just draft)
  - Store sent evidence in submission record
  - Log `submission_event` with email metadata
- [x] Add `submission_email_thread` table for tracking all emails in a submission thread

### KPIs Unlocked
- Actual send rate (submissions/day)
- Time-to-submit (req received → email sent)

---

## Epic 2 — Follow-up Worker (sending, not just scheduling)

**Goal:** Follow-ups are actually sent in-thread at T+4h, T+24h, T+48h.

### Tasks

- [ ] Create `FollowupDispatcherService`
  - Fetch due follow-ups (already have `getDueFollowups()`)
  - Load original submission email thread
  - Send follow-up as reply-in-thread via Graph
  - Mark `sent_at` on `submission_followup`
- [ ] Escalation rules:
  - HIGH trust vendor + silent after follow-up #2 → escalate to human
  - Strong rate + high match score → priority flag
- [ ] Cancel follow-ups on terminal statuses (already wired)
- [ ] Cron job: runs every 15 minutes

### KPIs Unlocked
- Follow-up compliance % (target: 100%)
- Response latency by vendor

---

## Epic 3 — Response Detection (closes the trust loop)

**Goal:** Classify inbound vendor emails and auto-update submission status + trust scores.

### Tasks

- [ ] Parse inbound mail from `raw_email_message` / Graph delta sync
- [ ] Match to submissions via `sentConversationId` or subject/contact
- [ ] Classify response type:
  - "Received / acknowledged"
  - "Need RTR / docs"
  - "Rate too high"
  - "Not a match"
  - "Interview request" → auto-transition to INTERVIEWING
  - "Client submitted" → track
  - "No third party / no C2C" → flag + trust event
  - "Position closed" → auto-close
- [ ] Auto-update submission status
- [ ] Emit `TrustEvent` (ghosting is now measurable)
- [ ] "Next best action" queue generation

### KPIs Unlocked
- Vendor response rate (by trust tier)
- Ghost rate (submissions with zero response)
- Auto-detected interviews

---

## Epic 4 — Auto-Submit Queue (human-gated)

**Goal:** Convert premium req signals into revenue with 1-click approval.

### Tasks

- [x] Create `AutoSubmitQueueItem` table with full schema
- [x] Matching engine: skill overlap scoring, vendor trust bonus, source bonus, rate fit
- [x] Generate top 50/day queued items from trusted vendors + JSearch + CorpToCorp
- [x] Daily cron (7 AM weekdays) + hourly expiry sweep
- [x] Batch approve/reject API with auth + RBAC
- [x] On approve: auto-creates submission → sends via Graph → schedules follow-ups
- [x] Full frontend page: stats cards, batch select, expand/collapse, skill comparison
- [x] Sidebar navigation: Auto-Submit added for MANAGEMENT, SUPERADMIN, RECRUITMENT

### KPIs Unlocked
- Submissions per recruiter per day
- Queue approval rate
- Auto-submit → interview conversion

---

## Epic 5 — Resume Auto-Formatter

**Goal:** Eliminate the formatting tax that slows speed-to-submit.

### Tasks

- [x] Standard templates per pod (SWE, Cloud/DevOps, Data, Cyber, Default)
- [x] Pipeline generates 3 versions:
  - Clean (no personal address)
  - Vendor branded ("Presented by Cloud Resources Inc.")
  - Watermarked (unique tracking code)
- [x] Store versions in `ResumeVersion` table with hash, version tracking, isCurrent flag
- [x] Address/phone stripping with regex
- [x] HTML resume generation with pod-specific color coding
- [x] REST API: format, get versions, get current by type

### KPIs Unlocked
- Speed-to-submit improvement
- Resume formatting time eliminated

---

## Priority Order

```
Epic 1 (Graph Outbound)     ← MUST DO FIRST — nothing works without sending
  ↓
Epic 2 (Follow-up Worker)   ← Compounds immediately on Epic 1
  ↓
Epic 3 (Response Detection) ← Closes the loop, grounds trust scores
  ↓
Epic 4 (Auto-Submit Queue)  ← The automation multiplier
  ↓
Epic 5 (Resume Formatter)   ← Speed optimizer
```

## Target: 1 Closure/Day Math

- 20-25 quality submissions → 1 closure
- 20% sub → interview (need 4-5 interviews)
- 30% interview → offer (need 1.5 offers)
- 80% offer → accept (need 1 closure)
- At $10+/hr margin × 2000 hrs/yr = $20K+ gross margin per placement
- 250 working days × $20K = **$5M/year gross margin** from the system

## Security Pre-Requisites (before multi-tenant sale)

- [ ] RLS policy review for all new tables
- [ ] Audit trail completeness verification
- [ ] Data retention + delete policy
- [ ] SOC2-ready practices documentation
- [ ] Move confidential strategy docs to private data room
