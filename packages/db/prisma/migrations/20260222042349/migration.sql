/*
  Warnings:

  - You are about to drop the column `searchVector` on the `MarketJob` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "MarketJob_searchVector_idx";

-- AlterTable
ALTER TABLE "MarketJob" DROP COLUMN "searchVector";
