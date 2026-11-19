-- What people do with the feed (the taste profile learns from it), and the switch that turns that off.
ALTER TABLE "User" ADD COLUMN "feedPersonalised" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "FeedEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "postId" UUID,
    "recipeId" UUID,
    "authorId" UUID,
    "dwellMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedEvent_userId_createdAt_idx" ON "FeedEvent"("userId", "createdAt" DESC);
CREATE INDEX "FeedEvent_userId_kind_postId_idx" ON "FeedEvent"("userId", "kind", "postId");
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");

ALTER TABLE "FeedEvent" ADD CONSTRAINT "FeedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
