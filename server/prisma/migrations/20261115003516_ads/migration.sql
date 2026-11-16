-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('ACTIVE', 'PAUSED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "AdInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'ACTIVE', 'DECLINED');

-- CreateTable
CREATE TABLE "Ad" (
    "id" UUID NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "advertiserLogoUrl" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "ctaText" TEXT NOT NULL,
    "ctaUrl" TEXT NOT NULL,
    "placements" TEXT[],
    "format" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "cpmCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "accentColor" TEXT,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdDay" (
    "adId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDay_pkey" PRIMARY KEY ("adId","day")
);

-- CreateTable
CREATE TABLE "AdInquiry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "website" TEXT,
    "budget" TEXT NOT NULL,
    "placements" TEXT[],
    "startDate" DATE,
    "message" TEXT NOT NULL,
    "status" "AdInquiryStatus" NOT NULL DEFAULT 'NEW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_status_startsAt_idx" ON "Ad"("status", "startsAt" DESC);

-- CreateIndex
CREATE INDEX "AdInquiry_status_submittedAt_idx" ON "AdInquiry"("status", "submittedAt" DESC);

-- AddForeignKey
ALTER TABLE "AdDay" ADD CONSTRAINT "AdDay_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
