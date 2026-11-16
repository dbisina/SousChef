-- CreateTable
CREATE TABLE "GameRoom" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "hostId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'lobby',
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "totalSec" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "dish" TEXT,
    "basket" TEXT[],
    "twist" TEXT,
    "hints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "GameSubmission" (
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "photoUrl" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "judgeScore" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT NOT NULL DEFAULT '',
    "judgedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSubmission_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateIndex
CREATE INDEX "GameRoom_code_phase_idx" ON "GameRoom"("code", "phase");

-- CreateIndex
CREATE INDEX "GameRoom_createdAt_idx" ON "GameRoom"("createdAt");

-- CreateIndex
CREATE INDEX "GamePlayer_userId_idx" ON "GamePlayer"("userId");

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSubmission" ADD CONSTRAINT "GameSubmission_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSubmission" ADD CONSTRAINT "GameSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
