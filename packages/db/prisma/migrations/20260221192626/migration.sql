-- CreateEnum
CREATE TYPE "Pod" AS ENUM ('SWE', 'CLOUD_DEVOPS', 'DATA', 'CYBER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGEMENT', 'CONSULTANT', 'RECRUITMENT', 'SALES', 'HR', 'IMMIGRATION', 'ACCOUNTS', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "MsaStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PARTIAL', 'VERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ConsultantReadiness" AS ENUM ('NEW', 'DOCS_PENDING', 'VERIFIED', 'SUBMISSION_READY', 'ON_ASSIGNMENT', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "WorkAuthType" AS ENUM ('USC', 'GC', 'H1B', 'L1', 'OPT', 'CPT', 'EAD', 'TN', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'QUALIFYING', 'ACTIVE', 'ON_HOLD', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('HOURLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReqSourceType" AS ENUM ('EMAIL', 'PORTAL', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'CONSENT_PENDING', 'SUBMITTED', 'INTERVIEWING', 'OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmitterType" AS ENUM ('USER', 'AGENT');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('EXPLICIT', 'AUTO_POLICY');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('EXTENDED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'TERMINATED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'ENDING', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MarginEventType" AS ENUM ('PLANNED', 'REALIZED', 'ADJUSTMENT', 'LEAKAGE');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'PORTAL', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "CommDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ImmigrationCaseStatus" AS ENUM ('INITIATED', 'FILED', 'PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'RFE');

-- CreateEnum
CREATE TYPE "ComplianceDocStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "msaStatus" "MsaStatus" NOT NULL DEFAULT 'PENDING',
    "w9Received" BOOLEAN NOT NULL DEFAULT false,
    "insuranceVerified" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" DOUBLE PRECISION,
    "paySpeedDays" DOUBLE PRECISION,
    "ghostRate" DOUBLE PRECISION,
    "disputeFrequency" DOUBLE PRECISION,
    "feedbackLatencyHrs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCompany" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "pods" "Pod"[],
    "resumeUrl" TEXT,
    "availableFrom" TIMESTAMP(3),
    "desiredRate" DOUBLE PRECISION,
    "currentRate" DOUBLE PRECISION,
    "readiness" "ConsultantReadiness" NOT NULL DEFAULT 'NEW',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationChecklist" JSONB NOT NULL DEFAULT '[]',
    "consentPolicy" JSONB NOT NULL DEFAULT '{}',
    "trustScore" DOUBLE PRECISION,
    "performanceHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultantWorkAuth" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "authType" "WorkAuthType" NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "employer" TEXT,
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultantWorkAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "watermark" TEXT,
    "source" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "structuredRequirements" JSONB NOT NULL DEFAULT '{}',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "pod" "Pod",
    "location" TEXT,
    "locationType" "LocationType" NOT NULL DEFAULT 'REMOTE',
    "rateMin" DOUBLE PRECISION,
    "rateMax" DOUBLE PRECISION,
    "rateType" "RateType" NOT NULL DEFAULT 'HOURLY',
    "startDate" TIMESTAMP(3),
    "durationMonths" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "freshnessScore" DOUBLE PRECISION,
    "closureLikelihood" DOUBLE PRECISION,
    "interviewSpeed" DOUBLE PRECISION,
    "rateHonesty" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobReqSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "source" "ReqSourceType" NOT NULL,
    "rawText" TEXT,
    "sourceRef" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobReqSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "submittedById" TEXT,
    "submitterType" "SubmitterType" NOT NULL DEFAULT 'USER',
    "agentId" TEXT,
    "resumeVersionId" TEXT,
    "resumeHash" TEXT,
    "rtrDocUrl" TEXT,
    "rateCardId" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "vendorFeedback" TEXT,
    "feedbackReceivedAt" TIMESTAMP(3),
    "duplicateCheckResult" JSONB,
    "marginApproved" BOOLEAN NOT NULL DEFAULT false,
    "marginOverrideBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "consentGivenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "rateSubmitted" DOUBLE PRECISION,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "interviewType" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "interviewerFeedback" TEXT,
    "candidateFeedback" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billRate" DOUBLE PRECISION NOT NULL,
    "payRate" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'EXTENDED',
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billRate" DOUBLE PRECISION NOT NULL,
    "payRate" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "retentionDays30" BOOLEAN,
    "retentionDays60" BOOLEAN,
    "retentionDays90" BOOLEAN,
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "placementDna" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "hoursRegular" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursOvertime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "clientCompanyId" TEXT,
    "placementId" TEXT,
    "rateCardId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "projectedEnd" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ONBOARDING',
    "onboardingChecklist" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billRate" DOUBLE PRECISION NOT NULL,
    "payRate" DOUBLE PRECISION NOT NULL,
    "vendorCutPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "burdenPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payrollTaxPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "portalFeePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherFees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossMarginHr" DOUBLE PRECISION,
    "netMarginHr" DOUBLE PRECISION,
    "marginSafe" BOOLEAN NOT NULL DEFAULT false,
    "minMarginTarget" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" "MarginEventType" NOT NULL,
    "plannedMargin" DOUBLE PRECISION,
    "realizedMargin" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "direction" "CommDirection" NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "threadId" TEXT,
    "sentByAgent" BOOLEAN NOT NULL DEFAULT false,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyScoreboard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
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
    "podFocus" "Pod",
    "podRotationReason" TEXT,
    "subToInterviewRate" DOUBLE PRECISION,
    "interviewToOfferRate" DOUBLE PRECISION,
    "offerToAcceptRate" DOUBLE PRECISION,
    "avgMarginHr" DOUBLE PRECISION,
    "marginSafeSubmissions" INTEGER NOT NULL DEFAULT 0,
    "marginOverrides" INTEGER NOT NULL DEFAULT 0,
    "actionPlan" JSONB NOT NULL DEFAULT '[]',
    "generatedByAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyScoreboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImmigrationCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "status" "ImmigrationCaseStatus" NOT NULL DEFAULT 'INITIATED',
    "filingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImmigrationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "ComplianceDocStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "toolCalled" TEXT NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT,
    "workflowId" TEXT,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "Submission_tenantId_jobId_consultantId_key" ON "Submission"("tenantId", "jobId", "consultantId");

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

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCompany" ADD CONSTRAINT "ClientCompany_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultant" ADD CONSTRAINT "Consultant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantWorkAuth" ADD CONSTRAINT "ConsultantWorkAuth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantWorkAuth" ADD CONSTRAINT "ConsultantWorkAuth_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReqSource" ADD CONSTRAINT "JobReqSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobReqSource" ADD CONSTRAINT "JobReqSource_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "ClientCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginEvent" ADD CONSTRAINT "MarginEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyScoreboard" ADD CONSTRAINT "DailyScoreboard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmigrationCase" ADD CONSTRAINT "ImmigrationCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmigrationCase" ADD CONSTRAINT "ImmigrationCase_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditLog" ADD CONSTRAINT "AgentAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustEvent" ADD CONSTRAINT "TrustEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
