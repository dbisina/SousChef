-- CreateTable
CREATE TABLE "RecipeScaleNote" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "servings" INTEGER NOT NULL,
    "amounts" JSONB NOT NULL,
    "tip" TEXT NOT NULL DEFAULT '',
    "cookTimeMin" INTEGER,
    "panNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeScaleNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeScaleNote_recipeId_servings_idx" ON "RecipeScaleNote"("recipeId", "servings");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeScaleNote_recipeId_authorId_servings_key" ON "RecipeScaleNote"("recipeId", "authorId", "servings");

-- AddForeignKey
ALTER TABLE "RecipeScaleNote" ADD CONSTRAINT "RecipeScaleNote_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeScaleNote" ADD CONSTRAINT "RecipeScaleNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
