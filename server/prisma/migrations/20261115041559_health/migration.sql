-- CreateTable
CREATE TABLE "HealthReading" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "mealId" UUID,
    "payload" BYTEA NOT NULL,

    CONSTRAINT "HealthReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthMeal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "payload" BYTEA NOT NULL,

    CONSTRAINT "HealthMeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthReading_userId_at_idx" ON "HealthReading"("userId", "at" DESC);

-- CreateIndex
CREATE INDEX "HealthReading_mealId_idx" ON "HealthReading"("mealId");

-- CreateIndex
CREATE INDEX "HealthMeal_userId_at_idx" ON "HealthMeal"("userId", "at" DESC);

-- AddForeignKey
ALTER TABLE "HealthReading" ADD CONSTRAINT "HealthReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthReading" ADD CONSTRAINT "HealthReading_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "HealthMeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthMeal" ADD CONSTRAINT "HealthMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
