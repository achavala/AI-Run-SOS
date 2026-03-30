-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "domain" TEXT,
    "website" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "msaStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "w9Received" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" REAL,
    "paySpeedDays" REAL,
    "ghostRate" REAL,
    "disputeFrequency" REAL,
    "feedbackLatencyHrs" REAL,
    "tier" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
    "isMspVms" BOOLEAN NOT NULL DEFAULT false,
    "onboardingUrl" TEXT,
    "preferredPods" TEXT NOT NULL DEFAULT '[]',
    "avgBillRateMin" REAL,
    "avgBillRateMax" REAL,
    "avgPaymentDays" REAL,
    "responseRate" REAL,
    "interviewGrantRate" REAL,
    "placementCount" INTEGER NOT NULL DEFAULT 0,
    "relationshipOwner" TEXT,
    "vendorNotes" TEXT,
    "lastActivityAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientCompany_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consultant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "pods" TEXT NOT NULL DEFAULT '[]',
    "resumeUrl" TEXT,
    "availableFrom" DATETIME,
    "desiredRate" REAL,
    "currentRate" REAL,
    "readiness" TEXT NOT NULL DEFAULT 'NEW',
    "benchStatus" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verificationChecklist" TEXT NOT NULL DEFAULT '[]',
    "consentPolicy" TEXT NOT NULL DEFAULT '{}',
    "trustScore" REAL,
    "performanceHistory" TEXT NOT NULL DEFAULT '[]',
    "qualityScore" REAL,
    "readinessScore" REAL,
    "resumeFreshnessAt" DATETIME,
    "rateRealism" REAL,
    "interviewCount" INTEGER NOT NULL DEFAULT 0,
    "offerCount" INTEGER NOT NULL DEFAULT 0,
    "placementCount" INTEGER NOT NULL DEFAULT 0,
    "availabilityConfidence" REAL,
    "premiumSkillFamilies" TEXT NOT NULL DEFAULT '[]',
    "sourcingLane" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Consultant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultantWorkAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "expiryDate" DATETIME,
    "employer" TEXT,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsultantWorkAuth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConsultantWorkAuth_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "watermark" TEXT,
    "source" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResumeVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumeVersion_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "structuredRequirements" TEXT NOT NULL DEFAULT '{}',
    "skills" TEXT NOT NULL DEFAULT '[]',
    "pod" TEXT,
    "location" TEXT,
    "locationType" TEXT NOT NULL DEFAULT 'REMOTE',
    "rateMin" REAL,
    "rateMax" REAL,
    "rateType" TEXT NOT NULL DEFAULT 'HOURLY',
    "startDate" DATETIME,
    "durationMonths" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "freshnessScore" REAL,
    "closureLikelihood" REAL,
    "interviewSpeed" REAL,
    "rateHonesty" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Job_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobReqSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rawText" TEXT,
    "sourceRef" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobReqSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JobReqSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "submittedById" TEXT,
    "submitterType" TEXT NOT NULL DEFAULT 'USER',
    "agentId" TEXT,
    "resumeVersionId" TEXT,
    "resumeHash" TEXT,
    "rtrDocUrl" TEXT,
    "rateCardId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorFeedback" TEXT,
    "feedbackReceivedAt" DATETIME,
    "duplicateCheckResult" TEXT,
    "marginApproved" BOOLEAN NOT NULL DEFAULT false,
    "marginOverrideBy" TEXT,
    "notes" TEXT,
    "sentEmailId" TEXT,
    "sentConversationId" TEXT,
    "sentInternetMsgId" TEXT,
    "sentAt" DATETIME,
    "sentTo" TEXT,
    "sentFrom" TEXT,
    "sentSubject" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Submission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionEmailThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "graphMessageId" TEXT,
    "conversationId" TEXT,
    "internetMsgId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmails" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "sentAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubmissionEmailThread_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoSubmitQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "reqSignalId" TEXT,
    "marketJobId" TEXT,
    "consultantId" TEXT NOT NULL,
    "reqTitle" TEXT NOT NULL,
    "reqLocation" TEXT,
    "reqRate" TEXT,
    "reqSkills" TEXT NOT NULL DEFAULT '[]',
    "reqSource" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorDomain" TEXT,
    "vendorTrustScore" REAL,
    "contactEmail" TEXT,
    "contactName" TEXT,
    "consultantName" TEXT NOT NULL,
    "consultantSkills" TEXT NOT NULL DEFAULT '[]',
    "matchScore" REAL NOT NULL DEFAULT 0,
    "matchReasons" TEXT NOT NULL DEFAULT '[]',
    "marginEstimate" REAL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "submissionId" TEXT,
    "sentAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcingLane" TEXT,
    "premiumSkillBonus" REAL,
    "supplyFitScore" REAL,
    "opportunityPriority" REAL,
    "vendorTier" TEXT,
    CONSTRAINT "AutoSubmitQueueItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AutoSubmitQueueItem_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "submission_followup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submission_id" TEXT NOT NULL,
    "followup_number" INTEGER NOT NULL,
    "scheduled_at" DATETIME NOT NULL,
    "sent_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "graphMessageId" TEXT,
    CONSTRAINT "submission_followup_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "submission_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submission_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "details" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "submission_event_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "Submission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vendor_feedback_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendor_domain" TEXT NOT NULL,
    "feedback_type" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "consentGivenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "rateSubmitted" REAL,
    CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConsentRecord_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConsentRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "interviewType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "interviewerFeedback" TEXT,
    "candidateFeedback" TEXT,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Interview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billRate" REAL NOT NULL,
    "payRate" REAL NOT NULL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EXTENDED',
    "expiresAt" DATETIME,
    "notes" TEXT,
    "approvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "billRate" REAL NOT NULL,
    "payRate" REAL NOT NULL,
    "margin" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "retentionDays30" BOOLEAN,
    "retentionDays60" BOOLEAN,
    "retentionDays90" BOOLEAN,
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "placementDna" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Placement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Placement_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Placement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Placement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "weekEnding" DATETIME NOT NULL,
    "hoursRegular" REAL NOT NULL DEFAULT 0,
    "hoursOvertime" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" DATETIME,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "paidAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentDate" DATETIME,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "placementId" TEXT,
    "rateCardId" TEXT,
    "startDate" DATETIME NOT NULL,
    "projectedEnd" DATETIME,
    "actualEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "onboardingChecklist" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assignment_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "billRate" REAL NOT NULL,
    "payRate" REAL NOT NULL,
    "vendorCutPct" REAL NOT NULL DEFAULT 0,
    "burdenPct" REAL NOT NULL DEFAULT 0,
    "payrollTaxPct" REAL NOT NULL DEFAULT 0,
    "portalFeePct" REAL NOT NULL DEFAULT 0,
    "otherFees" REAL NOT NULL DEFAULT 0,
    "grossMarginHr" REAL,
    "netMarginHr" REAL,
    "marginSafe" BOOLEAN NOT NULL DEFAULT false,
    "minMarginTarget" REAL NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RateCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarginEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "plannedMargin" REAL,
    "realizedMargin" REAL,
    "delta" REAL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarginEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "threadId" TEXT,
    "sentByAgent" BOOLEAN NOT NULL DEFAULT false,
    "agentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyScoreboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "targetQualifiedReqs" INTEGER NOT NULL DEFAULT 30,
    "targetHighConfReqs" INTEGER NOT NULL DEFAULT 10,
    "targetSubmissions" INTEGER NOT NULL DEFAULT 25,
    "targetInterviews" INTEGER NOT NULL DEFAULT 4,
    "targetActiveOffers" INTEGER NOT NULL DEFAULT 2,
    "targetClosures" INTEGER NOT NULL DEFAULT 1,
    "actualQualifiedReqs" INTEGER NOT NULL DEFAULT 0,
    "actualHighConfReqs" INTEGER NOT NULL DEFAULT 0,
    "actualSubmissions" INTEGER NOT NULL DEFAULT 0,
    "actualInterviews" INTEGER NOT NULL DEFAULT 0,
    "actualActiveOffers" INTEGER NOT NULL DEFAULT 0,
    "actualClosures" INTEGER NOT NULL DEFAULT 0,
    "podFocus" TEXT,
    "podRotationReason" TEXT,
    "subToInterviewRate" REAL,
    "interviewToOfferRate" REAL,
    "offerToAcceptRate" REAL,
    "avgMarginHr" REAL,
    "marginSafeSubmissions" INTEGER NOT NULL DEFAULT 0,
    "marginOverrides" INTEGER NOT NULL DEFAULT 0,
    "actionPlan" TEXT NOT NULL DEFAULT '[]',
    "generatedByAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyScoreboard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImmigrationCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "filingDate" DATETIME,
    "expiryDate" DATETIME,
    "milestones" TEXT NOT NULL DEFAULT '[]',
    "constraints" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImmigrationCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ImmigrationCase_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ComplianceDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "toolCalled" TEXT NOT NULL,
    "input" TEXT NOT NULL DEFAULT '{}',
    "output" TEXT NOT NULL DEFAULT '{}',
    "reason" TEXT,
    "workflowId" TEXT,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "score" REAL,
    "delta" REAL,
    "reason" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "locationType" TEXT NOT NULL DEFAULT 'REMOTE',
    "employmentType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "classificationConfidence" REAL NOT NULL DEFAULT 0,
    "negativeSignals" TEXT NOT NULL DEFAULT '[]',
    "rateText" TEXT,
    "rateMin" REAL,
    "rateMax" REAL,
    "compPeriod" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "hourlyRateMin" REAL,
    "hourlyRateMax" REAL,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "applyUrl" TEXT,
    "sourceUrl" TEXT,
    "recruiterName" TEXT,
    "recruiterEmail" TEXT,
    "recruiterPhone" TEXT,
    "recruiterLinkedIn" TEXT,
    "fingerprint" TEXT,
    "canonicalId" TEXT,
    "postedAt" DATETIME,
    "sourcePostedAt" DATETIME,
    "expiresAt" DATETIME,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "urlStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "urlVerifiedAt" DATETIME,
    "realnessScore" INTEGER,
    "realnessReasons" TEXT NOT NULL DEFAULT '[]',
    "actionabilityScore" INTEGER,
    "actionabilityReasons" TEXT NOT NULL DEFAULT '[]',
    "matchedVendorId" TEXT,
    "companyDomain" TEXT,
    "convertedToJobId" TEXT,
    "convertedAt" DATETIME,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketJob_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "MarketJobCanonical" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketJobCanonical" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "bestTitle" TEXT NOT NULL,
    "bestCompany" TEXT NOT NULL,
    "bestLocation" TEXT,
    "jobCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketQueryPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "location" TEXT,
    "pod" TEXT,
    "hourSlots" TEXT NOT NULL DEFAULT '[]',
    "maxPages" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "callsToday" INTEGER NOT NULL DEFAULT 0,
    "callsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "maxCallsPerDay" INTEGER NOT NULL DEFAULT 50,
    "maxCallsPerMonth" INTEGER NOT NULL DEFAULT 2000,
    "lastResetDate" DATETIME,
    "lastRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VendorReq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT,
    "vendorContactId" TEXT,
    "messageId" TEXT,
    "threadId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "location" TEXT,
    "locationType" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "rateText" TEXT,
    "hourlyRateMin" REAL,
    "hourlyRateMax" REAL,
    "duration" TEXT,
    "clientHint" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "negativeSignals" TEXT NOT NULL DEFAULT '[]',
    "realnessScore" INTEGER,
    "actionabilityScore" INTEGER,
    "extractionMethod" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "extractionEvidence" TEXT NOT NULL DEFAULT '{}',
    "matchedByDomain" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "convertedToJobId" TEXT,
    "convertedAt" DATETIME,
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "rawBody" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QaSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketJobId" TEXT NOT NULL,
    "sampledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "urlAlive" BOOLEAN,
    "typeCorrect" BOOLEAN,
    "isDuplicate" BOOLEAN,
    "isBogus" BOOLEAN,
    "hasContact" BOOLEAN,
    "freshnessOk" BOOLEAN,
    "verdict" TEXT NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "realnessScore" INTEGER,
    "actionabilityScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SpendGuard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "requestsMade" INTEGER NOT NULL DEFAULT 0,
    "newJobsIngested" INTEGER NOT NULL DEFAULT 0,
    "maxRequestsDay" INTEGER NOT NULL DEFAULT 100,
    "maxNewJobsDay" INTEGER NOT NULL DEFAULT 500,
    "alertFired" BOOLEAN NOT NULL DEFAULT false,
    "alertMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailSyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'Inbox',
    "deltaToken" TEXT,
    "lastSyncAt" DATETIME,
    "messagesTotal" INTEGER NOT NULL DEFAULT 0,
    "messagesNew" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RawEmailMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pstBatch" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "messageId" TEXT,
    "threadHint" TEXT,
    "conversation_id" TEXT,
    "internet_message_id" TEXT,
    "category" TEXT,
    "subject" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "toEmails" TEXT NOT NULL DEFAULT '[]',
    "ccEmails" TEXT NOT NULL DEFAULT '[]',
    "sentAt" DATETIME,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "responseProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RawEmailAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawEmailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "RawEmailMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedVendorCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "domain" TEXT NOT NULL,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" DATETIME,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtractedVendorContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorCompanyId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "linkedIn" TEXT,
    "emailCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" DATETIME,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExtractedVendorContact_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "ExtractedVendorCompany" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedConsultant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "primarySkills" TEXT NOT NULL DEFAULT '[]',
    "lastSeenAt" DATETIME,
    "sourceType" TEXT NOT NULL DEFAULT 'EMAIL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtractedResumeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultantId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "filename" TEXT,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedResumeVersion_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "ExtractedConsultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorReqSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorCompanyId" TEXT,
    "vendorContactId" TEXT,
    "rawEmailId" TEXT,
    "title" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "rateText" TEXT,
    "skills" TEXT NOT NULL DEFAULT '[]',
    "clientHint" TEXT,
    "actionabilityScore" INTEGER,
    "engagementModel" TEXT,
    "employmentNature" TEXT,
    "premiumSkillFamily" TEXT,
    "premiumSkillBonus" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VendorReqSignal_vendorCompanyId_fkey" FOREIGN KEY ("vendorCompanyId") REFERENCES "ExtractedVendorCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorReqSignal_vendorContactId_fkey" FOREIGN KEY ("vendorContactId") REFERENCES "ExtractedVendorContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptEmployerProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "website" TEXT,
    "atsSource" TEXT,
    "visaFriendliness" INTEGER NOT NULL DEFAULT 50,
    "juniorFitScore" INTEGER NOT NULL DEFAULT 50,
    "compensationTier" TEXT,
    "roleFamilies" TEXT NOT NULL DEFAULT '[]',
    "degreeAlignment" TEXT NOT NULL DEFAULT '[]',
    "h1bSponsored" BOOLEAN NOT NULL DEFAULT false,
    "optStemEligible" BOOLEAN NOT NULL DEFAULT false,
    "avgStartingSalary" REAL,
    "placementHistory" INTEGER NOT NULL DEFAULT 0,
    "lastPlacedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TechTierConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rank" INTEGER NOT NULL,
    "technologyFamily" TEXT NOT NULL,
    "premiumSkillFamily" TEXT,
    "pod" TEXT,
    "c2cBillRateMin" REAL,
    "c2cBillRateMax" REAL,
    "fteSalaryMin" REAL,
    "fteSalaryMax" REAL,
    "demandGrowthPct" REAL,
    "competitionLevel" TEXT,
    "grossProfitPerPlacement" REAL,
    "portfolioAllocationPct" REAL,
    "keySkills" TEXT NOT NULL DEFAULT '[]',
    "targetVendorTiers" TEXT NOT NULL DEFAULT '[]',
    "sourcingStrategy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExtractionFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "sourceEmailId" TEXT,
    "sourceAttachmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JobMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT,
    "marketJobId" TEXT,
    "consultantId" TEXT NOT NULL,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "scoreBreakdown" TEXT NOT NULL DEFAULT '{}',
    "matchReasons" TEXT NOT NULL DEFAULT '[]',
    "gaps" TEXT NOT NULL DEFAULT '[]',
    "visaEligible" BOOLEAN NOT NULL DEFAULT true,
    "visaNote" TEXT,
    "empTypeMatch" BOOLEAN NOT NULL DEFAULT true,
    "billRateEstimate" REAL,
    "status" TEXT NOT NULL DEFAULT 'computed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResumeArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "consultantName" TEXT NOT NULL,
    "primaryTech" TEXT NOT NULL,
    "jobId" TEXT,
    "marketJobId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobSource" TEXT,
    "vendorOrClient" TEXT,
    "matchScore" REAL NOT NULL DEFAULT 0,
    "resumeType" TEXT NOT NULL DEFAULT 'tailored',
    "htmlContent" TEXT,
    "htmlPath" TEXT,
    "pdfPath" TEXT,
    "metadataPath" TEXT,
    "fileChecksum" TEXT,
    "resumeJson" TEXT NOT NULL DEFAULT '{}',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSubmissionReady" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SubmissionApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "jobId" TEXT,
    "marketJobId" TEXT,
    "vendorOrClient" TEXT NOT NULL,
    "previousSubmissionId" TEXT,
    "previousSubmissionDate" DATETIME,
    "jobTitle" TEXT NOT NULL,
    "approvalToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "consultantEmail" TEXT NOT NULL,
    "requestReason" TEXT,
    "responseNote" TEXT,
    "resumeArtifactId" TEXT
);

-- CreateTable
CREATE TABLE "EmailAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT,
    "graphMessageId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ConsultantAiRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "currentStep" TEXT,
    "stepsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 8,
    "readinessScore" REAL,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsultantAiRun_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultantAiOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "input" TEXT NOT NULL DEFAULT '{}',
    "output" TEXT NOT NULL DEFAULT '{}',
    "htmlContent" TEXT,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsultantAiOutput_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ConsultantAiRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultantDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsultantDocument_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultantActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsultantActivity_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_domain_key" ON "Tenant"("domain");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_tier_idx" ON "Vendor"("tenantId", "tier");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_trustScore_idx" ON "Vendor"("tenantId", "trustScore");

-- CreateIndex
CREATE INDEX "VendorContact_tenantId_idx" ON "VendorContact"("tenantId");

-- CreateIndex
CREATE INDEX "VendorContact_tenantId_vendorId_idx" ON "VendorContact"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "ClientCompany_tenantId_idx" ON "ClientCompany"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultant_userId_key" ON "Consultant"("userId");

-- CreateIndex
CREATE INDEX "Consultant_tenantId_idx" ON "Consultant"("tenantId");

-- CreateIndex
CREATE INDEX "Consultant_tenantId_email_idx" ON "Consultant"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Consultant_tenantId_readiness_idx" ON "Consultant"("tenantId", "readiness");

-- CreateIndex
CREATE INDEX "Consultant_tenantId_qualityScore_idx" ON "Consultant"("tenantId", "qualityScore");

-- CreateIndex
CREATE INDEX "ConsultantWorkAuth_tenantId_idx" ON "ConsultantWorkAuth"("tenantId");

-- CreateIndex
CREATE INDEX "ConsultantWorkAuth_tenantId_consultantId_idx" ON "ConsultantWorkAuth"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ResumeVersion_tenantId_idx" ON "ResumeVersion"("tenantId");

-- CreateIndex
CREATE INDEX "ResumeVersion_tenantId_consultantId_idx" ON "ResumeVersion"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "Job_tenantId_idx" ON "Job"("tenantId");

-- CreateIndex
CREATE INDEX "Job_tenantId_status_idx" ON "Job"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Job_tenantId_vendorId_idx" ON "Job"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "Job_tenantId_pod_idx" ON "Job"("tenantId", "pod");

-- CreateIndex
CREATE INDEX "JobReqSource_tenantId_idx" ON "JobReqSource"("tenantId");

-- CreateIndex
CREATE INDEX "JobReqSource_tenantId_jobId_idx" ON "JobReqSource"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "Submission_tenantId_idx" ON "Submission"("tenantId");

-- CreateIndex
CREATE INDEX "Submission_tenantId_status_idx" ON "Submission"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Submission_sentConversationId_idx" ON "Submission"("sentConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_tenantId_jobId_consultantId_key" ON "Submission"("tenantId", "jobId", "consultantId");

-- CreateIndex
CREATE INDEX "SubmissionEmailThread_submissionId_idx" ON "SubmissionEmailThread"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionEmailThread_conversationId_idx" ON "SubmissionEmailThread"("conversationId");

-- CreateIndex
CREATE INDEX "AutoSubmitQueueItem_tenantId_status_idx" ON "AutoSubmitQueueItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AutoSubmitQueueItem_tenantId_createdAt_idx" ON "AutoSubmitQueueItem"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoSubmitQueueItem_consultantId_idx" ON "AutoSubmitQueueItem"("consultantId");

-- CreateIndex
CREATE INDEX "AutoSubmitQueueItem_status_expiresAt_idx" ON "AutoSubmitQueueItem"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AutoSubmitQueueItem_tenantId_sourcingLane_idx" ON "AutoSubmitQueueItem"("tenantId", "sourcingLane");

-- CreateIndex
CREATE INDEX "submission_followup_status_scheduled_at_idx" ON "submission_followup"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "submission_followup_submission_id_idx" ON "submission_followup"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_followup_submission_id_followup_number_key" ON "submission_followup"("submission_id", "followup_number");

-- CreateIndex
CREATE INDEX "submission_event_submission_id_idx" ON "submission_event"("submission_id");

-- CreateIndex
CREATE INDEX "submission_event_event_type_idx" ON "submission_event"("event_type");

-- CreateIndex
CREATE INDEX "vendor_feedback_event_vendor_domain_idx" ON "vendor_feedback_event"("vendor_domain");

-- CreateIndex
CREATE INDEX "vendor_feedback_event_feedback_type_idx" ON "vendor_feedback_event"("feedback_type");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_submissionId_key" ON "ConsentRecord"("submissionId");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_idx" ON "ConsentRecord"("tenantId");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_consultantId_idx" ON "ConsentRecord"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "Interview_tenantId_idx" ON "Interview"("tenantId");

-- CreateIndex
CREATE INDEX "Offer_tenantId_idx" ON "Offer"("tenantId");

-- CreateIndex
CREATE INDEX "Offer_tenantId_status_idx" ON "Offer"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Placement_tenantId_idx" ON "Placement"("tenantId");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_idx" ON "Timesheet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_tenantId_placementId_weekEnding_key" ON "Timesheet"("tenantId", "placementId", "weekEnding");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_idx" ON "Assignment"("tenantId");

-- CreateIndex
CREATE INDEX "Assignment_tenantId_status_idx" ON "Assignment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RateCard_tenantId_idx" ON "RateCard"("tenantId");

-- CreateIndex
CREATE INDEX "MarginEvent_tenantId_idx" ON "MarginEvent"("tenantId");

-- CreateIndex
CREATE INDEX "MarginEvent_tenantId_entityType_entityId_idx" ON "MarginEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunicationEvent_tenantId_idx" ON "CommunicationEvent"("tenantId");

-- CreateIndex
CREATE INDEX "CommunicationEvent_tenantId_entityType_entityId_idx" ON "CommunicationEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunicationEvent_threadId_idx" ON "CommunicationEvent"("threadId");

-- CreateIndex
CREATE INDEX "DailyScoreboard_tenantId_idx" ON "DailyScoreboard"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyScoreboard_tenantId_date_key" ON "DailyScoreboard"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ImmigrationCase_tenantId_idx" ON "ImmigrationCase"("tenantId");

-- CreateIndex
CREATE INDEX "ImmigrationCase_tenantId_consultantId_idx" ON "ImmigrationCase"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ComplianceDocument_tenantId_idx" ON "ComplianceDocument"("tenantId");

-- CreateIndex
CREATE INDEX "ComplianceDocument_tenantId_entityType_entityId_idx" ON "ComplianceDocument"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AgentAuditLog_tenantId_createdAt_idx" ON "AgentAuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAuditLog_workflowId_idx" ON "AgentAuditLog"("workflowId");

-- CreateIndex
CREATE INDEX "TrustEvent_tenantId_entityType_entityId_idx" ON "TrustEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "TrustEvent_tenantId_createdAt_idx" ON "TrustEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_idx" ON "Notification"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "MarketJob_fingerprint_idx" ON "MarketJob"("fingerprint");

-- CreateIndex
CREATE INDEX "MarketJob_canonicalId_idx" ON "MarketJob"("canonicalId");

-- CreateIndex
CREATE INDEX "MarketJob_status_postedAt_idx" ON "MarketJob"("status", "postedAt");

-- CreateIndex
CREATE INDEX "MarketJob_status_sourcePostedAt_idx" ON "MarketJob"("status", "sourcePostedAt");

-- CreateIndex
CREATE INDEX "MarketJob_status_employmentType_idx" ON "MarketJob"("status", "employmentType");

-- CreateIndex
CREATE INDEX "MarketJob_status_locationType_idx" ON "MarketJob"("status", "locationType");

-- CreateIndex
CREATE INDEX "MarketJob_source_idx" ON "MarketJob"("source");

-- CreateIndex
CREATE INDEX "MarketJob_company_idx" ON "MarketJob"("company");

-- CreateIndex
CREATE INDEX "MarketJob_hourlyRateMin_idx" ON "MarketJob"("hourlyRateMin");

-- CreateIndex
CREATE INDEX "MarketJob_hourlyRateMax_idx" ON "MarketJob"("hourlyRateMax");

-- CreateIndex
CREATE INDEX "MarketJob_realnessScore_idx" ON "MarketJob"("realnessScore");

-- CreateIndex
CREATE INDEX "MarketJob_urlStatus_idx" ON "MarketJob"("urlStatus");

-- CreateIndex
CREATE INDEX "MarketJob_convertedToJobId_idx" ON "MarketJob"("convertedToJobId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketJob_source_externalId_key" ON "MarketJob"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketJobCanonical_fingerprint_key" ON "MarketJobCanonical"("fingerprint");

-- CreateIndex
CREATE INDEX "MarketQueryPlan_provider_isEnabled_idx" ON "MarketQueryPlan"("provider", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "MarketQueryPlan_provider_query_location_key" ON "MarketQueryPlan"("provider", "query", "location");

-- CreateIndex
CREATE INDEX "VendorReq_tenantId_idx" ON "VendorReq"("tenantId");

-- CreateIndex
CREATE INDEX "VendorReq_tenantId_vendorId_idx" ON "VendorReq"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorReq_tenantId_status_idx" ON "VendorReq"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VendorReq_fromEmail_idx" ON "VendorReq"("fromEmail");

-- CreateIndex
CREATE INDEX "VendorReq_messageId_idx" ON "VendorReq"("messageId");

-- CreateIndex
CREATE INDEX "QaSample_sampledAt_idx" ON "QaSample"("sampledAt");

-- CreateIndex
CREATE INDEX "QaSample_verdict_idx" ON "QaSample"("verdict");

-- CreateIndex
CREATE INDEX "SpendGuard_provider_date_idx" ON "SpendGuard"("provider", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpendGuard_provider_date_key" ON "SpendGuard"("provider", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSyncState_tenantId_mailbox_folder_key" ON "EmailSyncState"("tenantId", "mailbox", "folder");

-- CreateIndex
CREATE INDEX "RawEmailMessage_fromEmail_idx" ON "RawEmailMessage"("fromEmail");

-- CreateIndex
CREATE INDEX "RawEmailMessage_sentAt_idx" ON "RawEmailMessage"("sentAt");

-- CreateIndex
CREATE INDEX "RawEmailMessage_pstBatch_idx" ON "RawEmailMessage"("pstBatch");

-- CreateIndex
CREATE INDEX "RawEmailMessage_processed_idx" ON "RawEmailMessage"("processed");

-- CreateIndex
CREATE INDEX "RawEmailMessage_conversation_id_idx" ON "RawEmailMessage"("conversation_id");

-- CreateIndex
CREATE INDEX "RawEmailMessage_responseProcessed_idx" ON "RawEmailMessage"("responseProcessed");

-- CreateIndex
CREATE INDEX "RawEmailAttachment_sha256_idx" ON "RawEmailAttachment"("sha256");

-- CreateIndex
CREATE INDEX "RawEmailAttachment_emailId_idx" ON "RawEmailAttachment"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedVendorCompany_domain_key" ON "ExtractedVendorCompany"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedVendorContact_email_key" ON "ExtractedVendorContact"("email");

-- CreateIndex
CREATE INDEX "ExtractedVendorContact_vendorCompanyId_idx" ON "ExtractedVendorContact"("vendorCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedConsultant_email_key" ON "ExtractedConsultant"("email");

-- CreateIndex
CREATE INDEX "ExtractedResumeVersion_sha256_idx" ON "ExtractedResumeVersion"("sha256");

-- CreateIndex
CREATE INDEX "ExtractedResumeVersion_consultantId_idx" ON "ExtractedResumeVersion"("consultantId");

-- CreateIndex
CREATE INDEX "VendorReqSignal_vendorCompanyId_idx" ON "VendorReqSignal"("vendorCompanyId");

-- CreateIndex
CREATE INDEX "VendorReqSignal_vendorContactId_idx" ON "VendorReqSignal"("vendorContactId");

-- CreateIndex
CREATE INDEX "VendorReqSignal_actionabilityScore_idx" ON "VendorReqSignal"("actionabilityScore");

-- CreateIndex
CREATE INDEX "VendorReqSignal_createdAt_idx" ON "VendorReqSignal"("createdAt");

-- CreateIndex
CREATE INDEX "OptEmployerProfile_visaFriendliness_idx" ON "OptEmployerProfile"("visaFriendliness");

-- CreateIndex
CREATE INDEX "OptEmployerProfile_juniorFitScore_idx" ON "OptEmployerProfile"("juniorFitScore");

-- CreateIndex
CREATE UNIQUE INDEX "OptEmployerProfile_companyName_key" ON "OptEmployerProfile"("companyName");

-- CreateIndex
CREATE UNIQUE INDEX "TechTierConfig_technologyFamily_key" ON "TechTierConfig"("technologyFamily");

-- CreateIndex
CREATE INDEX "TechTierConfig_rank_idx" ON "TechTierConfig"("rank");

-- CreateIndex
CREATE INDEX "TechTierConfig_isActive_idx" ON "TechTierConfig"("isActive");

-- CreateIndex
CREATE INDEX "ExtractionFact_entityType_entityId_idx" ON "ExtractionFact"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExtractionFact_sourceEmailId_idx" ON "ExtractionFact"("sourceEmailId");

-- CreateIndex
CREATE INDEX "JobMatch_tenantId_jobId_idx" ON "JobMatch"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "JobMatch_tenantId_marketJobId_idx" ON "JobMatch"("tenantId", "marketJobId");

-- CreateIndex
CREATE INDEX "JobMatch_tenantId_consultantId_idx" ON "JobMatch"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "JobMatch_tenantId_overallScore_idx" ON "JobMatch"("tenantId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "JobMatch_tenantId_jobId_consultantId_key" ON "JobMatch"("tenantId", "jobId", "consultantId");

-- CreateIndex
CREATE INDEX "ResumeArtifact_tenantId_consultantId_idx" ON "ResumeArtifact"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ResumeArtifact_tenantId_jobId_idx" ON "ResumeArtifact"("tenantId", "jobId");

-- CreateIndex
CREATE INDEX "ResumeArtifact_tenantId_marketJobId_idx" ON "ResumeArtifact"("tenantId", "marketJobId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionApproval_approvalToken_key" ON "SubmissionApproval"("approvalToken");

-- CreateIndex
CREATE INDEX "SubmissionApproval_tenantId_consultantId_idx" ON "SubmissionApproval"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "SubmissionApproval_approvalToken_idx" ON "SubmissionApproval"("approvalToken");

-- CreateIndex
CREATE INDEX "SubmissionApproval_tenantId_status_idx" ON "SubmissionApproval"("tenantId", "status");

-- CreateIndex
CREATE INDEX "EmailAudit_tenantId_idx" ON "EmailAudit"("tenantId");

-- CreateIndex
CREATE INDEX "EmailAudit_tenantId_toEmail_idx" ON "EmailAudit"("tenantId", "toEmail");

-- CreateIndex
CREATE INDEX "EmailAudit_relatedEntityType_relatedEntityId_idx" ON "EmailAudit"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "ConsultantAiRun_tenantId_consultantId_idx" ON "ConsultantAiRun"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ConsultantAiRun_tenantId_status_idx" ON "ConsultantAiRun"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ConsultantAiOutput_runId_idx" ON "ConsultantAiOutput"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultantAiOutput_runId_step_key" ON "ConsultantAiOutput"("runId", "step");

-- CreateIndex
CREATE INDEX "ConsultantDocument_tenantId_consultantId_idx" ON "ConsultantDocument"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ConsultantDocument_tenantId_consultantId_docType_idx" ON "ConsultantDocument"("tenantId", "consultantId", "docType");

-- CreateIndex
CREATE INDEX "ConsultantActivity_tenantId_consultantId_idx" ON "ConsultantActivity"("tenantId", "consultantId");

-- CreateIndex
CREATE INDEX "ConsultantActivity_tenantId_createdAt_idx" ON "ConsultantActivity"("tenantId", "createdAt");
