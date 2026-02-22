-- CreateEnum
CREATE TYPE "MarketJobSource" AS ENUM ('JSEARCH', 'JOOBLE', 'ADZUNA', 'ARBEITNOW', 'DICE', 'LINKEDIN', 'INDEED', 'ZIPRECRUITER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('C2C', 'W2', 'W2_1099', 'FULLTIME', 'PARTTIME', 'CONTRACT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "MarketJob" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" "MarketJobSource" NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "locationType" "LocationType" NOT NULL DEFAULT 'REMOTE',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'UNKNOWN',
    "rateMin" DOUBLE PRECISION,
    "rateMax" DOUBLE PRECISION,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "rateType" "RateType" NOT NULL DEFAULT 'HOURLY',
    "skills" JSONB NOT NULL DEFAULT '[]',
    "applyUrl" TEXT,
    "sourceUrl" TEXT,
    "recruiterName" TEXT,
    "recruiterEmail" TEXT,
    "recruiterPhone" TEXT,
    "recruiterLinkedIn" TEXT,
    "postedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketJob_employmentType_idx" ON "MarketJob"("employmentType");

-- CreateIndex
CREATE INDEX "MarketJob_isActive_postedAt_idx" ON "MarketJob"("isActive", "postedAt");

-- CreateIndex
CREATE INDEX "MarketJob_source_idx" ON "MarketJob"("source");

-- CreateIndex
CREATE INDEX "MarketJob_company_idx" ON "MarketJob"("company");

-- CreateIndex
CREATE UNIQUE INDEX "MarketJob_source_externalId_key" ON "MarketJob"("source", "externalId");
