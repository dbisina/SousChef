-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "moderatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "reporterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ChefVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,

    CONSTRAINT "ChefVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChefVerification_userId_submittedAt_idx" ON "ChefVerification"("userId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "ChefVerification_status_submittedAt_idx" ON "ChefVerification"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Post_status_moderatedAt_idx" ON "Post"("status", "moderatedAt");

-- AddForeignKey
ALTER TABLE "ChefVerification" ADD CONSTRAINT "ChefVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
