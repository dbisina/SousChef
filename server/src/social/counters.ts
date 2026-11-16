import type { Db } from '../db';

export interface Touched {
  postIds: string[];
  commentIds: string[];
  /** Communities the person belonged to (or asked to join). */
  communityIds: string[];
}

/** Posts, comments and communities whose totals will change when this person's account goes. */
export async function socialTouchedBy(db: Db, userId: string): Promise<Touched> {
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
  const communities = await db.communityMember.findMany({ where: { userId }, select: { communityId: true } });
  return { postIds: posts.map((p) => p.id), commentIds: comments.map((c) => c.id), communityIds: communities.map((c) => c.communityId) };
}

/**
 * Recounts likes, saves, comments and replies from the rows themselves, and tidies the communities the person left
 * behind: members recounted, a new owner chosen if the owner went (an admin first, else the longest-standing member),
 * and a community with nobody left removed together with its chat room.
 */
export async function recomputeSocialCounters(db: Db, touched: Touched): Promise<void> {
  if (touched.communityIds.length > 0) {
    await db.$executeRaw`
      UPDATE "Community" c SET "memberCount" = (SELECT count(*) FROM "CommunityMember" x WHERE x."communityId" = c."id" AND x."status" = 'MEMBER')
      WHERE c."id" = ANY(${touched.communityIds}::uuid[])`;
    await db.$executeRaw`
      UPDATE "CommunityMember" m SET "role" = 'owner'
      WHERE (m."communityId", m."userId") IN (
        SELECT DISTINCT ON (cm."communityId") cm."communityId", cm."userId" FROM "CommunityMember" cm
        WHERE cm."communityId" = ANY(${touched.communityIds}::uuid[]) AND cm."status" = 'MEMBER'
          AND NOT EXISTS (SELECT 1 FROM "CommunityMember" o WHERE o."communityId" = cm."communityId" AND o."role" = 'owner')
        ORDER BY cm."communityId", (cm."role" = 'admin') DESC, cm."joinedAt" ASC)`;
    await db.$executeRaw`
      DELETE FROM "Conversation" WHERE "id" IN (
        SELECT "conversationId" FROM "Community" WHERE "id" = ANY(${touched.communityIds}::uuid[]) AND "memberCount" = 0 AND "conversationId" IS NOT NULL)`;
    await db.$executeRaw`DELETE FROM "Community" WHERE "id" = ANY(${touched.communityIds}::uuid[]) AND "memberCount" = 0`;
  }
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
