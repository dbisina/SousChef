import type {
  CreatePostCommentRequest,
  CreatePostRequest,
  Page,
  Post,
  PostComment,
  PostKind,
  ToggleResponse,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';
import type { WriteGuard } from '../moderation/service';
import type { UploadService } from '../uploads/service';
import { AFFINITY, decodeCursor, encodeCursor, FOR_YOU_CANDIDATES, FOR_YOU_WINDOW_MS, rank, spreadAuthors } from './forYou';

const MAX_POSTS_PER_DAY = 20;
const DAY_MS = 86_400_000;

const withAuthor = {
  author: { select: authorSelect },
  recipe: { select: { id: true, title: true, imageUrl: true, authorId: true, author: { select: authorSelect } } },
} satisfies Prisma.PostInclude;

/** Told when someone shares a post about another person's recipe, so that person can be notified. */
export type CookedNotice = (n: { recipeAuthorId: string; cookName: string; recipeTitle: string; postId: string; recipeId: string }) => void;
type PostRow = Prisma.PostGetPayload<{ include: typeof withAuthor }>;
type CommentRow = Prisma.PostCommentGetPayload<{ include: { author: { select: typeof authorSelect } } }>;
const commentInclude = { author: { select: authorSelect } } satisfies Prisma.PostCommentInclude;

/** Hides authors who blocked the viewer or whom the viewer blocked. */
const notBlocked = (viewerId: string): Prisma.PostWhereInput => ({
  NOT: { author: { OR: [{ blocking: { some: { blockedId: viewerId } } }, { blockedBy: { some: { blockerId: viewerId } } }] } },
});

export class PostService {
  constructor(
    private readonly db: Db,
    private readonly uploads: UploadService,
    private readonly now: () => Date = () => new Date(),
    private readonly guard: WriteGuard | null = null,
    private readonly onCooked: CookedNotice | null = null,
  ) {}

  /* ------------------------------------------------------------------ posts */

  async create(userId: string, input: CreatePostRequest): Promise<Post> {
    await this.guard?.check(userId, [input.title, input.caption]);
    const since = new Date(this.now().getTime() - DAY_MS);
    if ((await this.db.post.count({ where: { authorId: userId, createdAt: { gte: since } } })) >= MAX_POSTS_PER_DAY) {
      throw errors.limitReached('You have posted a lot today. Try again tomorrow');
    }
    if (input.kind === 'recipe' && !input.recipeId) throw errors.validation({ recipeId: 'Choose the recipe to share' });
    if (input.kind === 'video' && !input.videoUploadId) throw errors.validation({ videoUploadId: 'Add the video' });
    if (input.kind !== 'video' && input.videoUploadId) throw errors.validation({ videoUploadId: 'Only video posts have a video' });

    if (input.recipeId) {
      const recipe = await this.db.recipe.findFirst({ where: { id: input.recipeId, OR: [{ status: 'PUBLISHED' }, { authorId: userId }] }, select: { id: true } });
      if (!recipe) throw errors.validation({ recipeId: 'That recipe does not exist' });
    }
    if (input.challengeId && !input.communityId) throw errors.validation({ challengeId: 'A challenge belongs to a community' });
    if (input.communityId) {
      const member = await this.db.communityMember.findFirst({ where: { communityId: input.communityId, userId, status: 'MEMBER' }, select: { userId: true } });
      if (!member) throw errors.forbidden('Join the community to post in it');
    }
    if (input.challengeId) {
      const challenge = await this.db.challenge.findFirst({ where: { id: input.challengeId, communityId: input.communityId as string }, select: { endsAt: true } });
      if (!challenge) throw errors.validation({ challengeId: 'That challenge is not in this community' });
      if (challenge.endsAt <= this.now()) throw errors.validation({ challengeId: 'That challenge has ended' });
    }
    const photoUrl = await this.uploads.urlFor(userId, input.photoUploadId, 'made_post');
    if (!photoUrl) throw errors.validation({ photoUploadId: 'Finish uploading the photo first' });
    let videoUrl: string | null = null;
    if (input.videoUploadId) {
      videoUrl = await this.uploads.urlFor(userId, input.videoUploadId, 'post_video');
      if (!videoUrl) throw errors.validation({ videoUploadId: 'Finish uploading the video first' });
    }

    const row = await this.db.post.create({
      data: {
        authorId: userId,
        kind: input.kind,
        title: input.title,
        caption: input.caption ?? '',
        meta: input.meta ?? null,
        photoUrl,
        videoUrl,
        recipeId: input.recipeId ?? null,
        communityId: input.communityId ?? null,
        challengeId: input.challengeId ?? null,
        createdAt: this.now(),
      },
      include: withAuthor,
    });
    const made = this.toPost(row, { liked: false, saved: false });
    // Tell the recipe's writer someone cooked it (not when they cooked their own).
    if (this.onCooked && row.recipe && row.recipe.authorId !== userId) {
      this.onCooked({ recipeAuthorId: row.recipe.authorId, cookName: row.author.displayName, recipeTitle: row.recipe.title, postId: row.id, recipeId: row.recipe.id });
    }
    return made;
  }

  async get(id: string, viewer: Viewer | null): Promise<Post> {
    const row = await this.visible(id, viewer);
    return (await this.decorate([row], viewer?.userId ?? null))[0] as Post;
  }

  async remove(id: string, viewer: Viewer): Promise<void> {
    const row = await this.db.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!row || (row.authorId !== viewer.userId && viewer.role !== 'admin')) throw errors.notFound('Post not found');
    await this.db.post.delete({ where: { id } });
  }

  /** Counts a view of a post (a video watched, a post opened). */
  async view(id: string, viewer: Viewer | null): Promise<void> {
    await this.visible(id, viewer);
    await this.db.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  /** One person's posts. Their hidden ones show only to them and to staff. */
  async byUser(target: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    if (viewer && viewer.userId !== target && (await this.blockedBetween(viewer.userId, target))) throw errors.notFound('Person not found');
    const own = viewer !== null && (viewer.userId === target || viewer.role === 'admin');
    return this.page({ authorId: target, ...(own ? {} : { status: 'PUBLISHED' }) }, viewer, limit, cursor);
  }

  /** What people cooked with a recipe: the public posts that carry it, newest first (not from people the viewer has blocked). */
  async byRecipe(recipeId: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    return this.page({ recipeId, status: 'PUBLISHED', communityId: null, ...(viewer ? notBlocked(viewer.userId) : {}) }, viewer, limit, cursor);
  }

  /** Posts from people you follow, and your own, newest first. */
  async followingFeed(viewer: Viewer, limit: number, cursor?: string): Promise<Page<Post>> {
    return this.page(
      {
        status: 'PUBLISHED',
        OR: [{ authorId: viewer.userId }, { author: { followers: { some: { followerId: viewer.userId } } } }],
        ...notBlocked(viewer.userId),
      },
      viewer,
      limit,
      cursor,
    );
  }

  /**
   * "For you": the last week's public posts, ordered by the Rust ranker (engagement, freshness, who you follow or have
   * liked, and no author filling the page). Works signed out too, with no personal lift. The cursor remembers the moment
   * the candidates were fixed at, so new posts arriving do not shuffle pages already seen.
   */
  async forYou(viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    const state = cursor ? decodeCursor(cursor) : null;
    if (cursor && !state) throw errors.validation({ cursor: 'Not a valid cursor' });
    const asOf = state ? new Date(state.asOf) : this.now();
    const offset = state?.offset ?? 0;

    // Posts this person marked "not interested" stay out of their feed.
    const hidden = viewer ? (await this.db.feedEvent.findMany({ where: { userId: viewer.userId, kind: 'hide', postId: { not: null } }, select: { postId: true } })).map((h) => h.postId as string) : [];
    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED',
      createdAt: { gte: new Date(asOf.getTime() - FOR_YOU_WINDOW_MS), lte: asOf },
      ...(hidden.length > 0 ? { id: { notIn: hidden } } : {}),
      ...(viewer ? notBlocked(viewer.userId) : {}),
    };
    const rows = await this.db.post.findMany({
      where: viewer?.role === 'admin' ? where : { AND: [where, this.communityGate(viewer?.userId ?? null)] },
      include: withAuthor,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: FOR_YOU_CANDIDATES,
    });
    if (rows.length === 0) return { items: [], nextCursor: null };

    const authors = [...new Set(rows.map((r) => r.authorId))];
    const [followed, engaged] = viewer
      ? await Promise.all([
          this.db.follow.findMany({ where: { followerId: viewer.userId, followingId: { in: authors } }, select: { followingId: true } }),
          this.db.post.findMany({
            where: {
              authorId: { in: authors },
              OR: [
                { likes: { some: { userId: viewer.userId, createdAt: { gte: new Date(asOf.getTime() - 30 * 24 * 3_600_000) } } } },
                { saves: { some: { userId: viewer.userId, createdAt: { gte: new Date(asOf.getTime() - 30 * 24 * 3_600_000) } } } },
              ],
            },
            select: { authorId: true },
            distinct: ['authorId'],
          }),
        ])
      : [[], []];
    const followedIds = new Set(followed.map((f) => f.followingId));
    const engagedIds = new Set(engaged.map((p) => p.authorId));
    const affinity = (authorId: string): number =>
      viewer && authorId === viewer.userId ? AFFINITY.self : followedIds.has(authorId) ? AFFINITY.followed : engagedIds.has(authorId) ? AFFINITY.engaged : AFFINITY.stranger;

    const ranked = rank(
      rows.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        ageHours: (asOf.getTime() - r.createdAt.getTime()) / 3_600_000,
        likes: r.likeCount,
        comments: r.commentCount,
        saves: r.saveCount,
        views: r.viewCount,
        authorAffinity: affinity(r.authorId),
        hasRecipe: r.recipeId !== null,
      })),
      offset + limit,
    );
    const authorOf = new Map(rows.map((r) => [r.id, r.authorId]));
    const pageIds = spreadAuthors(ranked, (id) => authorOf.get(id) ?? id).slice(offset, offset + limit);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = await this.decorate(pageIds.map((id) => byId.get(id) as PostRow), viewer?.userId ?? null);
    // More to show when the candidates run past this page.
    const more = rows.length > offset + limit && ranked.length === offset + limit;
    return { items, nextCursor: more ? encodeCursor({ asOf: asOf.toISOString(), offset: offset + limit }) : null };
  }

  /** Everyone's recent public posts. */
  async discoverFeed(viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    return this.page({ status: 'PUBLISHED', ...(viewer ? notBlocked(viewer.userId) : {}) }, viewer, limit, cursor);
  }

  async listSaved(viewer: Viewer, limit: number, cursor?: string): Promise<Page<Post>> {
    const rows = await this.db.postSave.findMany({
      where: { userId: viewer.userId, post: { AND: [{ status: 'PUBLISHED' }, this.communityGate(viewer.userId)] } },
      include: { post: { include: withAuthor } },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { userId_postId: { userId: viewer.userId, postId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: await this.decorate(page.map((r) => r.post), viewer.userId), nextCursor: hasMore ? (page.at(-1)?.postId ?? null) : null };
  }

  /* ------------------------------------------------------------------ likes and saves (repeating either changes nothing) */

  async setLiked(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    await this.visible(id, viewer);
    return this.db.$transaction(async (tx) => {
      const changed = on
        ? (await tx.postLike.createMany({ data: [{ userId: viewer.userId, postId: id }], skipDuplicates: true })).count
        : (await tx.postLike.deleteMany({ where: { userId: viewer.userId, postId: id } })).count;
      const row = changed
        ? await tx.post.update({ where: { id }, data: { likeCount: on ? { increment: 1 } : { decrement: 1 } }, select: { likeCount: true } })
        : await tx.post.findUniqueOrThrow({ where: { id }, select: { likeCount: true } });
      return { active: on, count: row.likeCount };
    });
  }

  async setSaved(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    await this.visible(id, viewer);
    return this.db.$transaction(async (tx) => {
      const changed = on
        ? (await tx.postSave.createMany({ data: [{ userId: viewer.userId, postId: id }], skipDuplicates: true })).count
        : (await tx.postSave.deleteMany({ where: { userId: viewer.userId, postId: id } })).count;
      const row = changed
        ? await tx.post.update({ where: { id }, data: { saveCount: on ? { increment: 1 } : { decrement: 1 } }, select: { saveCount: true } })
        : await tx.post.findUniqueOrThrow({ where: { id }, select: { saveCount: true } });
      return { active: on, count: row.saveCount };
    });
  }

  /* ------------------------------------------------------------------ comments */

  /** Top-level comments, newest first. Deleted ones stay as a stub only while they have replies. */
  async comments(postId: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<PostComment>> {
    await this.visible(postId, viewer);
    return this.commentPage({ postId, parentId: null, OR: [{ deletedAt: null }, { replyCount: { gt: 0 } }] }, 'desc', viewer, limit, cursor);
  }

  /** Replies to one comment, oldest first. */
  async replies(postId: string, commentId: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<PostComment>> {
    await this.visible(postId, viewer);
    return this.commentPage({ postId, parentId: commentId, deletedAt: null }, 'asc', viewer, limit, cursor);
  }

  async addComment(postId: string, viewer: Viewer, input: CreatePostCommentRequest): Promise<PostComment> {
    await this.visible(postId, viewer);
    const text = input.text?.trim() ?? '';
    if (!text && !input.voice) throw errors.validation({ text: 'Write something or record a voice note' });
    await this.guard?.check(viewer.userId, [text]);
    let voice: { url: string; durationSec: number } | null = null;
    if (input.voice) {
      const url = await this.uploads.urlFor(viewer.userId, input.voice.uploadId, 'voice');
      if (!url) throw errors.validation({ voice: 'Finish uploading the voice note first' });
      voice = { url, durationSec: input.voice.durationSec };
    }
    if (input.parentId) {
      const parent = await this.db.postComment.findFirst({ where: { id: input.parentId, postId, parentId: null, deletedAt: null }, select: { id: true } });
      if (!parent) throw errors.validation({ parentId: 'You can reply to a comment on this post' });
    }
    return this.db.$transaction(async (tx) => {
      const row = await tx.postComment.create({
        data: { postId, authorId: viewer.userId, parentId: input.parentId ?? null, text, voiceUrl: voice?.url ?? null, voiceDurationSec: voice?.durationSec ?? null, createdAt: this.now() },
        include: commentInclude,
      });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      if (input.parentId) await tx.postComment.update({ where: { id: input.parentId }, data: { replyCount: { increment: 1 } } });
      return this.toComment(row, { liked: false });
    });
  }

  /** The commenter, the post's author and staff can remove a comment. Its place stays if it has replies. */
  async deleteComment(postId: string, commentId: string, viewer: Viewer): Promise<void> {
    const row = await this.db.postComment.findFirst({ where: { id: commentId, postId }, select: { authorId: true, parentId: true, deletedAt: true, post: { select: { authorId: true } } } });
    const allowed = row && (row.authorId === viewer.userId || row.post.authorId === viewer.userId || viewer.role === 'admin');
    if (!row || !allowed) throw errors.notFound('Comment not found');
    if (row.deletedAt) return;
    await this.db.$transaction(async (tx) => {
      await tx.postComment.update({ where: { id: commentId }, data: { deletedAt: this.now(), text: '', voiceUrl: null, voiceDurationSec: null } });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } });
      if (row.parentId) await tx.postComment.update({ where: { id: row.parentId }, data: { replyCount: { decrement: 1 } } });
    });
  }

  async setCommentLiked(postId: string, commentId: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    await this.visible(postId, viewer);
    const exists = await this.db.postComment.findFirst({ where: { id: commentId, postId, deletedAt: null }, select: { id: true } });
    if (!exists) throw errors.notFound('Comment not found');
    return this.db.$transaction(async (tx) => {
      const changed = on
        ? (await tx.postCommentLike.createMany({ data: [{ userId: viewer.userId, commentId }], skipDuplicates: true })).count
        : (await tx.postCommentLike.deleteMany({ where: { userId: viewer.userId, commentId } })).count;
      const row = changed
        ? await tx.postComment.update({ where: { id: commentId }, data: { likeCount: on ? { increment: 1 } : { decrement: 1 } }, select: { likeCount: true } })
        : await tx.postComment.findUniqueOrThrow({ where: { id: commentId }, select: { likeCount: true } });
      return { active: on, count: row.likeCount };
    });
  }

  /* ------------------------------------------------------------------ helpers */

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    return (await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } })) !== null;
  }

  /** The post if this person may see it; otherwise "not found". Hidden posts show to their author and staff only. */
  private async visible(id: string, viewer: Viewer | null): Promise<PostRow> {
    const row = await this.db.post.findUnique({ where: { id }, include: withAuthor });
    const mine = viewer !== null && (row?.authorId === viewer.userId || viewer.role === 'admin');
    if (!row || (row.status !== 'PUBLISHED' && !mine)) throw errors.notFound('Post not found');
    if (viewer && viewer.userId !== row.authorId && (await this.blockedBetween(viewer.userId, row.authorId))) throw errors.notFound('Post not found');
    if (row.communityId && viewer?.role !== 'admin') {
      // A post inside a private community is for its members.
      const inside = await this.db.post.count({ where: { id, ...this.communityGate(viewer?.userId ?? null) } });
      if (inside === 0) throw errors.notFound('Post not found');
    }
    return row;
  }

  /** Posts outside any community, in public ones, or in private ones the viewer belongs to. */
  private communityGate(viewerId: string | null): Prisma.PostWhereInput {
    return {
      OR: [
        { communityId: null },
        { community: { visibility: 'PUBLIC' } },
        ...(viewerId ? [{ community: { members: { some: { userId: viewerId, status: 'MEMBER' as const } } } }] : []),
      ],
    };
  }

  /** A community's posts. Everyone sees a public community's; only members see a private one's. */
  async byCommunity(communityId: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    const community = await this.db.community.findUnique({ where: { id: communityId }, select: { visibility: true } });
    if (!community) throw errors.notFound('Community not found');
    if (community.visibility === 'PRIVATE' && viewer?.role !== 'admin') {
      const member = viewer ? await this.db.communityMember.findFirst({ where: { communityId, userId: viewer.userId, status: 'MEMBER' }, select: { userId: true } }) : null;
      if (!member) throw errors.notFound('Community not found');
    }
    return this.page({ communityId, status: 'PUBLISHED', ...(viewer ? notBlocked(viewer.userId) : {}) }, viewer, limit, cursor);
  }

  private async page(where: Prisma.PostWhereInput, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<Post>> {
    const rows = await this.db.post.findMany({
      where: viewer?.role === 'admin' ? where : { AND: [where, this.communityGate(viewer?.userId ?? null)] },
      include: withAuthor,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items: await this.decorate(items, viewer?.userId ?? null), nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  /** Adds what the viewer has done with each post, in two queries however many posts there are. */
  private async decorate(rows: PostRow[], viewerId: string | null): Promise<Post[]> {
    if (!viewerId) return rows.map((r) => this.toPost(r, null));
    const ids = rows.map((r) => r.id);
    const [likes, saves] = await Promise.all([
      this.db.postLike.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
      this.db.postSave.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
    ]);
    const liked = new Set(likes.map((l) => l.postId));
    const saved = new Set(saves.map((s) => s.postId));
    return rows.map((r) => this.toPost(r, { liked: liked.has(r.id), saved: saved.has(r.id) }));
  }

  private async commentPage(where: Prisma.PostCommentWhereInput, order: 'asc' | 'desc', viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<PostComment>> {
    const rows = await this.db.postComment.findMany({
      where,
      include: commentInclude,
      orderBy: [{ createdAt: order }, { id: order }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const liked = viewer
      ? new Set((await this.db.postCommentLike.findMany({ where: { userId: viewer.userId, commentId: { in: page.map((r) => r.id) } }, select: { commentId: true } })).map((l) => l.commentId))
      : null;
    return { items: page.map((r) => this.toComment(r, liked ? { liked: liked.has(r.id) } : null)), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  private toPost(r: PostRow, viewer: Post['viewer']): Post {
    return {
      id: r.id,
      author: toAuthor(r.author),
      kind: r.kind as PostKind,
      title: r.title,
      caption: r.caption,
      meta: r.meta,
      photoUrl: r.photoUrl,
      videoUrl: r.videoUrl,
      recipeId: r.recipeId,
      recipe: r.recipe ? { id: r.recipe.id, title: r.recipe.title, imageUrl: r.recipe.imageUrl || null, author: toAuthor(r.recipe.author) } : null,
      communityId: r.communityId,
      challengeId: r.challengeId,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      saveCount: r.saveCount,
      viewCount: r.viewCount,
      createdAt: r.createdAt.toISOString(),
      viewer,
    };
  }

  private toComment(r: CommentRow, viewer: PostComment['viewer']): PostComment {
    const deleted = r.deletedAt !== null;
    return {
      id: r.id,
      postId: r.postId,
      author: toAuthor(r.author),
      parentId: r.parentId,
      text: deleted ? '' : r.text,
      voice: !deleted && r.voiceUrl ? { url: r.voiceUrl, durationSec: r.voiceDurationSec ?? 0 } : null,
      likeCount: r.likeCount,
      replyCount: r.replyCount,
      createdAt: r.createdAt.toISOString(),
      deleted,
      viewer,
    };
  }
}
