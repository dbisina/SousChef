-- CreateTable
CREATE TABLE "GamePoolItem" (
    "id" UUID NOT NULL,
    "game" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "wrong" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePoolItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePoolSeen" (
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePoolSeen_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePoolItem_hash_key" ON "GamePoolItem"("hash");

-- CreateIndex
CREATE INDEX "GamePoolItem_game_createdAt_idx" ON "GamePoolItem"("game", "createdAt");

-- CreateIndex
CREATE INDEX "GamePoolSeen_userId_at_idx" ON "GamePoolSeen"("userId", "at");

-- AddForeignKey
ALTER TABLE "GamePoolSeen" ADD CONSTRAINT "GamePoolSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePoolSeen" ADD CONSTRAINT "GamePoolSeen_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GamePoolItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
