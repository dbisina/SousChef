-- Mystery Kitchen: cooking steps (never naming the dish) and a photo of the intended dish, for the pool and for each game.
ALTER TABLE "GamePoolItem" ADD COLUMN "steps" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GameRoom" ADD COLUMN "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "dishPhotoUrl" TEXT;
