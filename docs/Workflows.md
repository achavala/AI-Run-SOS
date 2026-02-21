# Workflow Definitions — AI-RUN SOS

All workflows are deterministic state machines. Each transition is logged.

## 1. Job Intake Workflow

```
[Received] → [Parsing] → [Clarification Needed?]
                              ├─ Yes → [Awaiting Clarification] → [Parsing]
                              └─ No  → [Qualified] → [Open]
[Open] → [On Hold] | [Filled] | [Cancelled]
```

**Agents involved:** JobIntakeAgent
**Human gates:** None (but Management can override status)
**Triggers:** Email/API with JD text

## 2. Submission Workflow

```
[Draft] → [Pending Consent]
              ├─ Auto-consent policy matches → [Submitted]
              └─ Needs explicit consent → [Awaiting Consent]
                    ├─ Approved → [Submitted]
                    └─ Denied → [Withdrawn]
[Submitted] → [Shortlisted] | [Rejected] | [Withdrawn]
[Shortlisted] → [Interview Scheduled]
```

**Agents involved:** SubmissionAgent, TalentSourcingAgent
**Human gates:** Consultant consent (explicit or auto-policy)
**Validation:** Duplicate check, resume hash verification, RTR document

## 3. Interview Workflow

```
[Scheduled] → [Reminder Sent] → [Completed] | [Cancelled] | [No Show]
[Completed] → [Feedback Requested] → [Feedback Captured]
```

**Agents involved:** InterviewCoordinatorAgent
**Human gates:** None

## 4. Offer → Placement Workflow

```
[Offer Extended] → [Offer Accepted] | [Offer Declined] | [Offer Expired]
[Offer Accepted] → [Onboarding] → [Compliance Check]
                                        ├─ Pass → [Active Placement]
                                        └─ Fail → [Blocked - Missing Docs]
[Active Placement] → [Extended] | [Completed] | [Terminated]
```

**Agents involved:** ComplianceAgent
**Human gates:** Compliance override requires Management approval

## 5. Timesheet Workflow

```
[Draft] → [Submitted] → [Approved] | [Rejected]
[Approved] → [Invoiced]
[Rejected] → [Draft] (with feedback)
```

**Agents involved:** TimesheetAndInvoicingAgent
**Human gates:** Timesheet approval (consultant's manager or accounts)

## 6. Invoice → Payment Workflow

```
[Draft] → [Sent] → [Overdue] | [Paid] | [Partial] | [Disputed]
[Overdue] → [Reminder Sent] → [Escalated]
[Disputed] → [Under Review] → [Resolved] | [Written Off]
```

**Agents involved:** TimesheetAndInvoicingAgent
**Human gates:** Write-off requires Management approval

## 7. Immigration Case Workflow

```
[Initiated] → [Documents Requested] → [Documents Received]
→ [Filed] → [Pending] → [Approved] | [Denied] | [RFE]
[RFE] → [Response Filed] → [Pending]
[Approved] → [Active] → [Expiring Soon] → [Renewal Initiated]
```

**Agents involved:** ImmigrationOpsAgent
**Human gates:** Filing and submission require Management sign-off
**Auto-alerts:** 90/60/30 day expiry warnings

## 8. Vendor Onboarding Workflow

```
[Initiated] → [Info Requested] → [Info Received]
→ [Review] → [Approved] | [Rejected] | [Needs Revision]
[Approved] → [Active]
```

**Agents involved:** VendorOnboardingAgent
**Human gates:** High-risk term flags require Management review
**Collected:** W-9, MSA, insurance certs, payment terms

## Workflow Engine

All workflows run on Temporal (or equivalent durable execution engine).
Benefits:
- Automatic retries with backoff
- Workflow state is persisted and queryable
- Long-running workflows (immigration cases can span months/years)
- Built-in visibility and debugging
