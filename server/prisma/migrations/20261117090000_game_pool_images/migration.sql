-- A photo for a game question: the picture, the article it came from, and whether one has been looked for yet.
ALTER TABLE "GamePoolItem" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "photoTitle" TEXT,
ADD COLUMN "photoTried" BOOLEAN NOT NULL DEFAULT false;
