/*
  Warnings:

  - You are about to drop the column `isActive` on the `MarketJob` table. All the data in the column will be lost.
  - You are about to drop the column `rateType` on the `MarketJob` table. All the data in the column will be lost.
  - You are about to drop the column `salaryMax` on the `MarketJob` table. All the data in the column will be lost.
  - You are about to drop the column `salaryMin` on the `MarketJob` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CompPeriod" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MarketJobStatus" AS ENUM ('ACTIVE', 'STALE', 'EXPIRED', 'CONVERTED');

-- DropIndex
DROP INDEX "MarketJob_employmentType_idx";

-- DropIndex
DROP INDEX "MarketJob_isActive_postedAt_idx";

-- AlterTable
ALTER TABLE "MarketJob" DROP COLUMN "isActive",
DROP COLUMN "rateType",
DROP COLUMN "salaryMax",
DROP COLUMN "salaryMin",
ADD COLUMN     "canonicalId" TEXT,
ADD COLUMN     "classificationConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "compPeriod" "CompPeriod" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedToJobId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "hourlyRateMax" DOUBLE PRECISION,
ADD COLUMN     "hourlyRateMin" DOUBLE PRECISION,
ADD COLUMN     "negativeSignals" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "rateText" TEXT,
ADD COLUMN     "status" "MarketJobStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "MarketJobCanonical" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bestTitle" TEXT NOT NULL,
    "bestCompany" TEXT NOT NULL,
    "bestLocation" TEXT,
    "jobCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketJobCanonical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketQueryPlan" (
    "id" TEXT NOT NULL,
    "provider" "MarketJobSource" NOT NULL,
    "query" TEXT NOT NULL,
    "location" TEXT,
    "maxPages" INTEGER NOT NULL DEFAULT 2,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "callsToday" INTEGER NOT NULL DEFAULT 0,
    "callsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "maxCallsPerDay" INTEGER NOT NULL DEFAULT 50,
    "maxCallsPerMonth" INTEGER NOT NULL DEFAULT 2000,
    "lastResetDate" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketQueryPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketJobCanonical_fingerprint_key" ON "MarketJobCanonical"("fingerprint");

-- CreateIndex
CREATE INDEX "MarketQueryPlan_provider_isEnabled_idx" ON "MarketQueryPlan"("provider", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "MarketQueryPlan_provider_query_key" ON "MarketQueryPlan"("provider", "query");

-- CreateIndex
CREATE INDEX "MarketJob_fingerprint_idx" ON "MarketJob"("fingerprint");

-- CreateIndex
CREATE INDEX "MarketJob_canonicalId_idx" ON "MarketJob"("canonicalId");

-- CreateIndex
CREATE INDEX "MarketJob_status_postedAt_idx" ON "MarketJob"("status", "postedAt");

-- CreateIndex
CREATE INDEX "MarketJob_status_employmentType_idx" ON "MarketJob"("status", "employmentType");

-- CreateIndex
CREATE INDEX "MarketJob_status_locationType_idx" ON "MarketJob"("status", "locationType");

-- CreateIndex
CREATE INDEX "MarketJob_hourlyRateMin_idx" ON "MarketJob"("hourlyRateMin");

-- CreateIndex
CREATE INDEX "MarketJob_hourlyRateMax_idx" ON "MarketJob"("hourlyRateMax");

-- CreateIndex
CREATE INDEX "MarketJob_convertedToJobId_idx" ON "MarketJob"("convertedToJobId");

-- AddForeignKey
ALTER TABLE "MarketJob" ADD CONSTRAINT "MarketJob_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "MarketJobCanonical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
