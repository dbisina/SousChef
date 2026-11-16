-- CreateTable
CREATE TABLE "DailyPuzzle" (
    "position" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "aliases" TEXT[],
    "clues" TEXT[],
    "photoUrl" TEXT,

    CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("position")
);

-- CreateTable
CREATE TABLE "DailyDishGame" (
    "userId" UUID NOT NULL,
    "dateKey" TEXT NOT NULL,
    "cluesShown" INTEGER NOT NULL DEFAULT 1,
    "guesses" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'playing',
    "score" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DailyDishGame_pkey" PRIMARY KEY ("userId","dateKey")
);

-- CreateTable
CREATE TABLE "DailyDishStreak" (
    "userId" UUID NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "best" INTEGER NOT NULL DEFAULT 0,
    "lastSolvedDate" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "DailyDishStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "DailyDishGame_dateKey_status_score_idx" ON "DailyDishGame"("dateKey", "status", "score" DESC);

-- AddForeignKey
ALTER TABLE "DailyDishGame" ADD CONSTRAINT "DailyDishGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyDishStreak" ADD CONSTRAINT "DailyDishStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
