# Data Model — AI-RUN SOS

## Multi-Tenancy

All business entities include `tenantId`. Postgres RLS policies enforce isolation.

## Core Entities

### Tenant
- id, name, domain, settings (JSON), plan, createdAt, updatedAt

### User
- id, tenantId, email, passwordHash, firstName, lastName, role (enum), isActive, lastLoginAt
- Relations: tenant, auditLogs, notifications

### Vendor (Client/Prime Vendor)
- id, tenantId, companyName, contactName, contactEmail, contactPhone
- paymentTerms (Net-30/60/90), msaStatus, w9Status, insuranceStatus
- trustScore, paySpeedDays, ghostRate, disputeFrequency, feedbackLatency
- Relations: jobs, invoices, payments, trustEvents

### Consultant
- id, tenantId, userId (optional — if they have portal access)
- firstName, lastName, email, phone, skills (JSON array), resumeUrl
- visaStatus, workAuthExpiry, availableFrom, desiredRate, currentRate
- verificationStatus, verificationChecklist (JSON)
- consentPolicy (JSON — auto-approve rules)
- trustScore, performanceHistory (JSON)
- Relations: submissions, placements, timesheets, immigrationCases

### Job
- id, tenantId, vendorId, title, description, structuredRequirements (JSON)
- skills (JSON array), location, locationType (remote/hybrid/onsite)
- rateMin, rateMax, rateType (hourly/annual), startDate, duration
- status (enum: draft, open, on_hold, filled, cancelled)
- closureLikelihood, interviewSpeed, rateHonesty
- Relations: vendor, submissions, interviews

### Submission
- id, tenantId, jobId, consultantId, submittedById (user or agent)
- submitterType (enum: user, agent), agentId (if agent)
- resumeVersion, resumeHash, rtrDocUrl
- consentRecordId, status (enum: draft, pending_consent, submitted, shortlisted, rejected, withdrawn)
- vendorFeedback, feedbackReceivedAt
- duplicateCheckResult (JSON)
- Relations: job, consultant, consentRecord, auditLog

### ConsentRecord
- id, tenantId, consultantId, submissionId
- consentType (enum: explicit, auto_policy), consentGivenAt
- vendorName, jobTitle, rateSubmitted

### Interview
- id, tenantId, submissionId, scheduledAt, duration, interviewType
- status (enum: scheduled, completed, cancelled, no_show)
- interviewerFeedback, candidateFeedback, rating
- Relations: submission

### Placement
- id, tenantId, consultantId, jobId, vendorId
- startDate, endDate, billRate, payRate, margin
- status (enum: active, completed, terminated, extended)
- retentionDays30, retentionDays60, retentionDays90
- extensionCount, placementDna (JSON)
- Relations: consultant, job, vendor, timesheets

### Timesheet
- id, tenantId, placementId, consultantId, weekEnding
- hoursRegular, hoursOvertime, status (enum: draft, submitted, approved, rejected, invoiced)
- approvedById, approvedAt
- Relations: placement, consultant, invoice

### Invoice
- id, tenantId, vendorId, invoiceNumber, periodStart, periodEnd
- totalAmount, status (enum: draft, sent, paid, partial, overdue, disputed)
- sentAt, dueDate, paidAt, paidAmount
- Relations: vendor, timesheets, payments

### Payment
- id, tenantId, invoiceId, amount, paymentDate, paymentMethod
- referenceNumber, status (enum: pending, completed, failed, reversed)
- Relations: invoice

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

## Indexes

- All tables: (tenantId) for RLS
- Users: (tenantId, email) unique
- Jobs: (tenantId, status), (tenantId, vendorId)
- Submissions: (tenantId, jobId, consultantId) unique
- Timesheets: (tenantId, placementId, weekEnding) unique
- Invoices: (tenantId, invoiceNumber) unique
- AuditLogs: (tenantId, createdAt), (workflowId)
