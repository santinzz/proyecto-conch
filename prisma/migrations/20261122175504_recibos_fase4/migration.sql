/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Bill` table. All the data in the column will be lost.
  - The `status` column on the `Bill` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "fileUrl",
ADD COLUMN     "detailedReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocrPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "ocrPeriodStart" TIMESTAMP(3),
ADD COLUMN     "ocrServiceNumber" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "serviceNumber" DROP NOT NULL,
ALTER COLUMN "periodStart" DROP NOT NULL,
ALTER COLUMN "periodEnd" DROP NOT NULL,
ALTER COLUMN "consumption" DROP NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "BillStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "BillFile" (
    "billId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "BillFile_pkey" PRIMARY KEY ("billId")
);

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_userId_idx" ON "Bill"("userId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillFile" ADD CONSTRAINT "BillFile_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
