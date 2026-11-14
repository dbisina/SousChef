-- CreateEnum
CREATE TYPE "WantToCookStatus" AS ENUM ('SAVED', 'PLANNED', 'SHOPPING', 'COOKED');

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WantToCookItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recipeId" UUID,
    "imported" JSONB,
    "status" "WantToCookStatus" NOT NULL DEFAULT 'SAVED',
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedFor" TIMESTAMP(3),
    "cookedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WantToCookItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "recipeId" UUID,
    "recipeTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryItem_userId_createdAt_idx" ON "PantryItem"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PantryItem_userId_expiresAt_idx" ON "PantryItem"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "WantToCookItem_userId_savedAt_idx" ON "WantToCookItem"("userId", "savedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WantToCookItem_userId_recipeId_key" ON "WantToCookItem"("userId", "recipeId");

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_createdAt_idx" ON "ShoppingItem"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantToCookItem" ADD CONSTRAINT "WantToCookItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantToCookItem" ADD CONSTRAINT "WantToCookItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A want-to-cook item is either one of our recipes or an imported one, never both and never neither.
ALTER TABLE "WantToCookItem"
  ADD CONSTRAINT "WantToCookItem_recipe_xor_imported" CHECK (("recipeId" IS NULL) <> ("imported" IS NULL));
