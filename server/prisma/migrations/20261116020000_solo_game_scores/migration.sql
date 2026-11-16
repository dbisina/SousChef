-- CreateTable
CREATE TABLE "SoloGameScore" (
    "userId" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "best" INTEGER NOT NULL DEFAULT 0,
    "last" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloGameScore_pkey" PRIMARY KEY ("userId","game")
);

-- CreateIndex
CREATE INDEX "SoloGameScore_game_best_idx" ON "SoloGameScore"("game", "best" DESC);

-- AddForeignKey
ALTER TABLE "SoloGameScore" ADD CONSTRAINT "SoloGameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
