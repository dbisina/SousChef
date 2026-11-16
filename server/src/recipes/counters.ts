import type { Db } from '../db';

/**
 * Recounts the like, save, comment and rating totals of the given recipes from the rows themselves.
 * Used after something removes rows without going through the normal path (deleting an account).
 */
export async function recomputeRecipeCounters(db: Db, recipeIds: string[]): Promise<void> {
  if (recipeIds.length === 0) return;
  await db.$executeRaw`
    UPDATE "Recipe" r SET
      "likeCount" = (SELECT count(*) FROM "RecipeLike" x WHERE x."recipeId" = r."id"),
      "saveCount" = (SELECT count(*) FROM "RecipeSave" x WHERE x."recipeId" = r."id"),
      "commentCount" = (SELECT count(*) FROM "RecipeComment" x WHERE x."recipeId" = r."id"),
      "ratingCount" = (SELECT count(*) FROM "RecipeRating" x WHERE x."recipeId" = r."id"),
      "ratingSum" = (SELECT COALESCE(sum(x."rating"), 0) FROM "RecipeRating" x WHERE x."recipeId" = r."id")
    WHERE r."id" = ANY(${recipeIds}::uuid[])`;
}

/** Every recipe (not the person's own) that this person liked, saved, commented on or rated. */
export async function recipesTouchedBy(db: Db, userId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT "recipeId" AS id FROM (
      SELECT "recipeId" FROM "RecipeLike" WHERE "userId" = ${userId}::uuid
      UNION ALL SELECT "recipeId" FROM "RecipeSave" WHERE "userId" = ${userId}::uuid
      UNION ALL SELECT "recipeId" FROM "RecipeComment" WHERE "authorId" = ${userId}::uuid
      UNION ALL SELECT "recipeId" FROM "RecipeRating" WHERE "userId" = ${userId}::uuid
    ) t
    WHERE "recipeId" NOT IN (SELECT "id" FROM "Recipe" WHERE "authorId" = ${userId}::uuid)`;
  return rows.map((r) => r.id);
}
