-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "reductionPct" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RecycleClaim" ADD COLUMN     "confirmedPieces" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "usedById" TEXT;

-- CreateIndex
CREATE INDEX "RecycleClaim_userId_idx" ON "RecycleClaim"("userId");

-- AddForeignKey
ALTER TABLE "RecycleClaim" ADD CONSTRAINT "RecycleClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
