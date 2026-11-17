-- What the feed has learned about each person's taste.
CREATE TABLE "TasteProfile" (
    "userId" UUID NOT NULL,
    "vector" JSONB NOT NULL,
    "signals" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TasteProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "TasteProfile" ADD CONSTRAINT "TasteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
