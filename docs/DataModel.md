# Data Model — AI-RUN SOS

## Multi-Tenancy

All business entities include `tenantId`. Postgres RLS policies enforce isolation.

---

## Enums

### Pod

```
SWE | CLOUD_DEVOPS_PLATFORM | DATA | CYBER
```

### JobStatus

```
NEW | QUALIFYING | ACTIVE | ON_HOLD | FILLED | CANCELLED
```

### ConsultantReadiness

```
NEW | DOCS_PENDING | VERIFIED | SUBMISSION_READY | ON_ASSIGNMENT | OFFBOARDED
```

### SubmissionStatus

```
DRAFT | CONSENT_PENDING | SUBMITTED | INTERVIEWING | OFFERED | ACCEPTED | CLOSED
```

### OfferStatus

```
EXTENDED | ACCEPTED | DECLINED | EXPIRED | WITHDRAWN
```

### AssignmentStatus

```
ONBOARDING | ACTIVE | ENDING | COMPLETED | TERMINATED
```

### TimesheetStatus

```
DRAFT | SUBMITTED | APPROVED | REJECTED | INVOICED
```

### InvoiceStatus

```
DRAFT | SENT | PAID | PARTIAL | OVERDUE | DISPUTED
```

---

## Core Entities

### Tenant

- id, name, domain, settings (JSON), plan, createdAt, updatedAt

### User

- id, tenantId, email, passwordHash, firstName, lastName, role (enum), isActive, lastLoginAt
- Relations: tenant, auditLogs, notifications

### ClientCompany

- id, tenantId, name, industry, billingAddress, paymentTerms
- Relations: vendors, jobs

### Vendor

- id, tenantId, clientCompanyId (optional)
- companyName, contactName, contactEmail, contactPhone
- paymentTerms (Net-30/60/90), msaStatus, w9Status, insuranceStatus
- trustScore, paySpeedDays, ghostRate, disputeFrequency, feedbackLatency
- Relations: jobs, invoices, payments, trustEvents, VendorContact

### VendorContact

- id, tenantId, vendorId, name, email, phone, role, isPrimary
- Relations: vendor

### Consultant

- id, tenantId, userId (optional — portal access)
- firstName, lastName, email, phone, skills (JSON array), resumeUrl
- readiness (ConsultantReadiness enum)
- visaStatus, workAuthExpiry, availableFrom, desiredRate, currentRate
- verificationStatus, verificationChecklist (JSON)
- consentPolicy (JSON — auto-approve rules)
- trustScore, performanceHistory (JSON)
- Relations: submissions, placements, timesheets, immigrationCases, ConsultantWorkAuth, ResumeVersion

### ConsultantWorkAuth

- id, tenantId, consultantId, authType (H1B, L1, GC, OPT, USC, etc.)
- expiryDate, documentUrl, verifiedAt, verifiedById
- Relations: consultant

### ResumeVersion

- id, tenantId, consultantId, version, fileUrl, hash, uploadedAt
- Relations: consultant

### Job

- id, tenantId, vendorId, pod (Pod enum)
- title, description, structuredRequirements (JSON)
- skills (JSON array), location, locationType (remote/hybrid/onsite)
- rateMin, rateMax, rateType (hourly/annual), startDate, duration
- status (JobStatus enum)
- closureLikelihood, interviewSpeed, rateHonesty
- Relations: vendor, submissions, interviews, JobReqSource

### JobReqSource

- id, tenantId, jobId, sourceType (email, portal, api), sourceRef
- receivedAt, parsedAt, freshnessScore
- Relations: job

### Submission

- id, tenantId, jobId, consultantId, submittedById (user or agent)
- submitterType (enum: user, agent), agentId (if agent)
- resumeVersionId, resumeHash, rtrDocUrl
- consentRecordId, status (SubmissionStatus enum)
- vendorFeedback, feedbackReceivedAt
- duplicateCheckResult (JSON)
- Relations: job, consultant, consentRecord, auditLog, Offer

### Offer

- id, tenantId, submissionId, billRate, payRate, margin
- status (OfferStatus enum), extendedAt, expiresAt
- acceptedAt, declinedAt, declineReason
- Relations: submission, Assignment

### Assignment

- id, tenantId, consultantId, jobId, vendorId, offerId
- startDate, endDate, billRate, payRate, margin
- status (AssignmentStatus enum)
- retentionDays30, retentionDays60, retentionDays90
- extensionCount, placementDna (JSON)
- Relations: consultant, job, vendor, offer, timesheets

### RateCard

- id, tenantId, vendorId, pod, skillLevel (junior/mid/senior)
- billRateMin, billRateMax, payRateMin, payRateMax
- effectiveFrom, effectiveTo
- Relations: vendor

### MarginEvent

- id, tenantId, entityType (submission, offer, assignment), entityId
- billRate, payRate, margin, marginPerHr
- costBreakdown (JSON), blocked (boolean), cfoOverride (boolean)
- createdAt
- Relations: (polymorphic entityType/entityId)

### ConsentRecord

- id, tenantId, consultantId, submissionId
- consentType (enum: explicit, auto_policy), consentGivenAt
- vendorName, jobTitle, rateSubmitted

### Interview

- id, tenantId, submissionId, scheduledAt, duration, interviewType
- status (enum: scheduled, completed, cancelled, no_show)
- interviewerFeedback, candidateFeedback, rating
- Relations: submission

### Timesheet

- id, tenantId, assignmentId, consultantId, weekEnding
- hoursRegular, hoursOvertime, status (TimesheetStatus enum)
- approvedById, approvedAt
- Relations: assignment, consultant, invoice

### Invoice

- id, tenantId, vendorId, invoiceNumber, periodStart, periodEnd
- totalAmount, status (InvoiceStatus enum)
- sentAt, dueDate, paidAt, paidAmount
- Relations: vendor, timesheets, payments

### Payment

- id, tenantId, invoiceId, amount, paymentDate, paymentMethod
- referenceNumber, status (enum: pending, completed, failed, reversed)
- Relations: invoice

### CommunicationEvent

- id, tenantId, entityType, entityId (submission, interview, etc.)
- channel (email, sms, in_app), direction (inbound, outbound)
- subject, bodyPreview, sentAt, agentId (if agent-sent)
- Relations: (polymorphic entityType/entityId)

### DailyScoreboard

- id, tenantId, date, pod
- submissionsCount, interviewsScheduled, offersExtended
- closuresCount, avgMargin, targetVsActual (JSON)
- generatedAt, generatedBy (AutopilotGM)
- Relations: tenant

### ImmigrationCase

- id, tenantId, consultantId, caseType (H1B, L1, GC, OPT, etc.)
- status (enum: initiated, filed, pending, approved, denied, expired)
- filingDate, expiryDate, milestones (JSON array)
- constraints (JSON — permitted locations, start constraints, doc requirements)
- Relations: consultant, documents

### ComplianceDocument

- id, tenantId, entityType (consultant/vendor), entityId
- documentType, fileUrl, uploadedAt, expiresAt, verifiedById, verifiedAt
- status (enum: pending, verified, expired, rejected)

### AgentAuditLog

- id, tenantId, agentRole, agentId, action, toolCalled
- input (JSON), output (JSON), reason, workflowId
- durationMs, status (enum: success, failure, escalated)
- createdAt

### TrustEvent

- id, tenantId, entityType (vendor/consultant/recruiter), entityId
- eventType, score, delta, reason, metadata (JSON)
- createdAt

### Notification

- id, tenantId, userId, channel (email/sms/in_app), subject, body
- status (enum: pending, sent, failed, read)
- sentAt, readAt

---

## Indexes

- All tables: (tenantId) for RLS
- Users: (tenantId, email) unique
- Jobs: (tenantId, status), (tenantId, vendorId), (tenantId, pod)
- Submissions: (tenantId, jobId, consultantId) unique, (tenantId, status)
- Timesheets: (tenantId, assignmentId, weekEnding) unique
- Invoices: (tenantId, invoiceNumber) unique
- DailyScoreboard: (tenantId, date), (tenantId, date, pod)
- AuditLogs: (tenantId, createdAt), (workflowId)
- MarginEvent: (tenantId, entityType, entityId)
