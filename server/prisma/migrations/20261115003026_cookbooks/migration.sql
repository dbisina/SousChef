-- CreateTable
CREATE TABLE "Cookbook" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT NOT NULL,
    "category" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cookbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookbookRecipe" (
    "cookbookId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CookbookRecipe_pkey" PRIMARY KEY ("cookbookId","recipeId")
);

-- CreateTable
CREATE TABLE "CookbookLike" (
    "userId" UUID NOT NULL,
    "cookbookId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookbookLike_pkey" PRIMARY KEY ("userId","cookbookId")
);

-- CreateTable
CREATE TABLE "CookbookSave" (
    "userId" UUID NOT NULL,
    "cookbookId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookbookSave_pkey" PRIMARY KEY ("userId","cookbookId")
);

-- CreateIndex
CREATE INDEX "Cookbook_published_createdAt_id_idx" ON "Cookbook"("published", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "CookbookRecipe_cookbookId_position_idx" ON "CookbookRecipe"("cookbookId", "position");

-- CreateIndex
CREATE INDEX "CookbookRecipe_recipeId_idx" ON "CookbookRecipe"("recipeId");

-- CreateIndex
CREATE INDEX "CookbookLike_cookbookId_idx" ON "CookbookLike"("cookbookId");

-- CreateIndex
CREATE INDEX "CookbookSave_userId_createdAt_idx" ON "CookbookSave"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CookbookSave_cookbookId_idx" ON "CookbookSave"("cookbookId");

-- AddForeignKey
ALTER TABLE "CookbookRecipe" ADD CONSTRAINT "CookbookRecipe_cookbookId_fkey" FOREIGN KEY ("cookbookId") REFERENCES "Cookbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookRecipe" ADD CONSTRAINT "CookbookRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookLike" ADD CONSTRAINT "CookbookLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookLike" ADD CONSTRAINT "CookbookLike_cookbookId_fkey" FOREIGN KEY ("cookbookId") REFERENCES "Cookbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookSave" ADD CONSTRAINT "CookbookSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookbookSave" ADD CONSTRAINT "CookbookSave_cookbookId_fkey" FOREIGN KEY ("cookbookId") REFERENCES "Cookbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
