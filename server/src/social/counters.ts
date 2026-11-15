import type { Db } from '../db';

/** Posts and comments (not the person's own) whose totals will change when this person's account goes. */
export async function socialTouchedBy(db: Db, userId: string): Promise<{ postIds: string[]; commentIds: string[] }> {
  const posts = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT "postId" AS id FROM (
      SELECT "postId" FROM "PostLike" WHERE "userId" = ${userId}::uuid
      UNION ALL SELECT "postId" FROM "PostSave" WHERE "userId" = ${userId}::uuid
      UNION ALL SELECT "postId" FROM "PostComment" WHERE "authorId" = ${userId}::uuid
    ) t
    WHERE "postId" NOT IN (SELECT "id" FROM "Post" WHERE "authorId" = ${userId}::uuid)`;
  const comments = await db.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT "commentId" AS id FROM (
      SELECT "commentId" FROM "PostCommentLike" WHERE "userId" = ${userId}::uuid
      UNION ALL SELECT "parentId" AS "commentId" FROM "PostComment" WHERE "authorId" = ${userId}::uuid AND "parentId" IS NOT NULL
    ) t
    WHERE "commentId" NOT IN (SELECT "id" FROM "PostComment" WHERE "authorId" = ${userId}::uuid)`;
  return { postIds: posts.map((p) => p.id), commentIds: comments.map((c) => c.id) };
}

/** Recounts likes, saves, comments and replies from the rows themselves. */
export async function recomputeSocialCounters(db: Db, touched: { postIds: string[]; commentIds: string[] }): Promise<void> {
  if (touched.postIds.length > 0) {
    await db.$executeRaw`
      UPDATE "Post" p SET
        "likeCount" = (SELECT count(*) FROM "PostLike" x WHERE x."postId" = p."id"),
        "saveCount" = (SELECT count(*) FROM "PostSave" x WHERE x."postId" = p."id"),
        "commentCount" = (SELECT count(*) FROM "PostComment" x WHERE x."postId" = p."id" AND x."deletedAt" IS NULL)
      WHERE p."id" = ANY(${touched.postIds}::uuid[])`;
  }
  if (touched.commentIds.length > 0) {
    await db.$executeRaw`
      UPDATE "PostComment" c SET
        "likeCount" = (SELECT count(*) FROM "PostCommentLike" x WHERE x."commentId" = c."id"),
        "replyCount" = (SELECT count(*) FROM "PostComment" x WHERE x."parentId" = c."id" AND x."deletedAt" IS NULL)
      WHERE c."id" = ANY(${touched.commentIds}::uuid[])`;
  }
}
