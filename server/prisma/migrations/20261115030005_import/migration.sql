-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('DONE', 'NEEDS_FRAMES');

-- CreateTable
CREATE TABLE "ImportCache" (
    "key" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "recipe" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "recipe" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportCache_lastUsedAt_idx" ON "ImportCache"("lastUsedAt");

-- CreateIndex
CREATE INDEX "Import_userId_createdAt_idx" ON "Import"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
