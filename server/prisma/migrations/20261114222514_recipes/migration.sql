-- Typo-tolerant title search (trigram index below).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "RecipeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FLAGGED');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL,
    "youtubeUrl" TEXT,
    "status" "RecipeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isExclusive" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "cuisine" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "prepTime" INTEGER NOT NULL,
    "cookTime" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "ingredients" JSONB NOT NULL,
    "ingredientNames" TEXT[],
    "instructions" JSONB NOT NULL,
    "nutrition" JSONB NOT NULL,
    "caloriesPerServing" INTEGER NOT NULL,
    "tags" TEXT[],
    "dietaryFlags" TEXT[],
    "allergens" TEXT[],
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLike" (
    "userId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeLike_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateTable
CREATE TABLE "RecipeSave" (
    "userId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSave_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateTable
CREATE TABLE "RecipeRating" (
    "userId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeRating_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateTable
CREATE TABLE "RecipeComment" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeMadePost" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeMadePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeFlag" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipe_status_createdAt_id_idx" ON "Recipe"("status", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Recipe_status_likeCount_id_idx" ON "Recipe"("status", "likeCount" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Recipe_authorId_createdAt_idx" ON "Recipe"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Recipe_ingredientNames_idx" ON "Recipe" USING GIN ("ingredientNames");

-- CreateIndex
CREATE INDEX "Recipe_title_trgm_idx" ON "Recipe" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "RecipeLike_recipeId_idx" ON "RecipeLike"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeSave_userId_createdAt_idx" ON "RecipeSave"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RecipeSave_recipeId_idx" ON "RecipeSave"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeRating_recipeId_idx" ON "RecipeRating"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeComment_recipeId_createdAt_idx" ON "RecipeComment"("recipeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RecipeComment_authorId_idx" ON "RecipeComment"("authorId");

-- CreateIndex
CREATE INDEX "RecipeMadePost_recipeId_createdAt_idx" ON "RecipeMadePost"("recipeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "RecipeMadePost_authorId_idx" ON "RecipeMadePost"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeFlag_recipeId_reporterId_key" ON "RecipeFlag"("recipeId", "reporterId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLike" ADD CONSTRAINT "RecipeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLike" ADD CONSTRAINT "RecipeLike_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSave" ADD CONSTRAINT "RecipeSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSave" ADD CONSTRAINT "RecipeSave_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMadePost" ADD CONSTRAINT "RecipeMadePost_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMadePost" ADD CONSTRAINT "RecipeMadePost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFlag" ADD CONSTRAINT "RecipeFlag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeFlag" ADD CONSTRAINT "RecipeFlag_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Whole-word search over title and description ('simple' = no stemming, so local dish names are not mangled).
-- Prisma cannot express an expression index, so it lives here.
CREATE INDEX "Recipe_search_fts_idx" ON "Recipe"
  USING GIN (to_tsvector('simple', "title" || ' ' || "description"));
