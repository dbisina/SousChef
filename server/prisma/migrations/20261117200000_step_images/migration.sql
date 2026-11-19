-- Ingredient photos, step pictures, and the per-person daily count of step pictures.
CREATE TABLE "IngredientPhoto" (
    "name" TEXT NOT NULL,
    "url" TEXT,
    "triedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngredientPhoto_pkey" PRIMARY KEY ("name")
);

CREATE TABLE "StepImage" (
    "hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StepImage_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE "StepImageUse" (
    "userId" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StepImageUse_pkey" PRIMARY KEY ("userId","day")
);
