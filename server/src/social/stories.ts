import type { CreateStoryRequest, Page, Story, StoryGroup, StoryViewer } from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';
import type { UploadService } from '../uploads/service';

const HOUR_MS = 3_600_000;
export const STORY_LIFETIME_MS = 24 * HOUR_MS;
/** Expired stories are kept this much longer, so a viewer who opened one just before it ended is not cut off. */
const SWEEP_GRACE_MS = HOUR_MS;
const MAX_STORIES_PER_DAY = 30;
const TRAY_LIMIT = 300;

const withAuthor = { author: { select: authorSelect } } satisfies Prisma.StoryInclude;
type StoryRow = Prisma.StoryGetPayload<{ include: typeof withAuthor }>;

export class StoryService {
  constructor(
    private readonly db: Db,
    private readonly uploads: UploadService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: string, input: CreateStoryRequest): Promise<Story> {
    const now = this.now();
    if ((await this.db.story.count({ where: { authorId: userId, createdAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) } } })) >= MAX_STORIES_PER_DAY) {
      throw errors.limitReached('You have shared a lot of stories today. Try again tomorrow');
    }
    const photoUrl = await this.uploads.urlFor(userId, input.photoUploadId, 'story');
    if (!photoUrl) throw errors.validation({ photoUploadId: 'Finish uploading the photo first' });
    if (input.recipeId) {
      const recipe = await this.db.recipe.findFirst({ where: { id: input.recipeId, OR: [{ status: 'PUBLISHED' }, { authorId: userId }] }, select: { id: true } });
      if (!recipe) throw errors.validation({ recipeId: 'That recipe does not exist' });
    }
    const row = await this.db.story.create({
      data: {
        authorId: userId,
        photoUrl,
        uploadId: input.photoUploadId,
        recipeId: input.recipeId ?? null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + STORY_LIFETIME_MS),
      },
      include: withAuthor,
    });
    return this.toStory(row, userId, true);
  }

  /** The row of circles: people you follow (and you) with a story up right now. Unseen first, then the most recent. */
  async tray(viewer: Viewer): Promise<StoryGroup[]> {
    const rows = await this.db.story.findMany({
      where: {
        expiresAt: { gt: this.now() },
        OR: [{ authorId: viewer.userId }, { author: { followers: { some: { followerId: viewer.userId } } } }],
        NOT: { author: { OR: [{ blocking: { some: { blockedId: viewer.userId } } }, { blockedBy: { some: { blockerId: viewer.userId } } }] } },
      },
      include: withAuthor,
      orderBy: { createdAt: 'asc' },
      take: TRAY_LIMIT,
    });
    return this.group(rows, viewer.userId);
  }

  /** One person's active stories. */
  async byUser(target: string, viewer: Viewer): Promise<StoryGroup | null> {
    if (viewer.userId !== target && (await this.blockedBetween(viewer.userId, target))) throw errors.notFound('Person not found');
    const rows = await this.db.story.findMany({ where: { authorId: target, expiresAt: { gt: this.now() } }, include: withAuthor, orderBy: { createdAt: 'asc' }, take: MAX_STORIES_PER_DAY });
    return (await this.group(rows, viewer.userId))[0] ?? null;
  }

  /** Marks a story as seen by this person. Seeing it again, or your own, changes nothing. */
  async view(id: string, viewer: Viewer): Promise<void> {
    const row = await this.active(id, viewer);
    if (row.authorId === viewer.userId) return;
    const { count } = await this.db.storyView.createMany({ data: [{ storyId: id, viewerId: viewer.userId }], skipDuplicates: true });
    if (count > 0) await this.db.story.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  /** Who has seen a story. Only its author can ask. */
  async viewers(id: string, viewer: Viewer, limit: number, cursor?: string): Promise<Page<StoryViewer>> {
    const story = await this.db.story.findUnique({ where: { id }, select: { authorId: true } });
    if (!story || story.authorId !== viewer.userId) throw errors.notFound('Story not found');
    const rows = await this.db.storyView.findMany({
      where: { storyId: id },
      include: { viewer: { select: authorSelect } },
      orderBy: [{ viewedAt: 'desc' }, { viewerId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { storyId_viewerId: { storyId: id, viewerId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map((r) => ({ user: toAuthor(r.viewer), at: r.viewedAt.toISOString() })), nextCursor: hasMore ? (page.at(-1)?.viewerId ?? null) : null };
  }

  async remove(id: string, viewer: Viewer): Promise<void> {
    const row = await this.db.story.findUnique({ where: { id }, select: { authorId: true, uploadId: true } });
    if (!row || (row.authorId !== viewer.userId && viewer.role !== 'admin')) throw errors.notFound('Story not found');
    await this.db.story.delete({ where: { id } });
    if (row.uploadId) await this.uploads.discardById(row.uploadId);
  }

  /** Deletes stories (and their photos) that ended more than an hour ago. Run by the job runner. Returns how many went. */
  async sweepExpired(): Promise<number> {
    const stale = await this.db.story.findMany({
      where: { expiresAt: { lt: new Date(this.now().getTime() - SWEEP_GRACE_MS) } },
      select: { id: true, uploadId: true },
      take: 500,
    });
    if (stale.length === 0) return 0;
    await this.db.story.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    for (const s of stale) if (s.uploadId) await this.uploads.discardById(s.uploadId);
    return stale.length;
  }

  /* ---- helpers ---- */

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    return (await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } })) !== null;
  }

  /** A story that is still up and that this person may see. */
  private async active(id: string, viewer: Viewer): Promise<StoryRow> {
    const row = await this.db.story.findUnique({ where: { id }, include: withAuthor });
    if (!row || row.expiresAt <= this.now()) throw errors.notFound('Story not found');
    if (row.authorId !== viewer.userId && (await this.blockedBetween(viewer.userId, row.authorId))) throw errors.notFound('Story not found');
    return row;
  }

  private async group(rows: StoryRow[], viewerId: string): Promise<StoryGroup[]> {
    if (rows.length === 0) return [];
    const seenIds = new Set(
      (await this.db.storyView.findMany({ where: { viewerId, storyId: { in: rows.map((r) => r.id) } }, select: { storyId: true } })).map((v) => v.storyId),
    );
    const byAuthor = new Map<string, StoryRow[]>();
    for (const r of rows) byAuthor.set(r.authorId, [...(byAuthor.get(r.authorId) ?? []), r]);
    const groups = [...byAuthor.values()].map((list): StoryGroup => {
      const stories = list.map((r) => this.toStory(r, viewerId, seenIds.has(r.id) || r.authorId === viewerId));
      return {
        author: toAuthor((list[0] as StoryRow).author),
        stories,
        hasUnseen: stories.some((s) => s.seen === false),
        latestAt: (list.at(-1) as StoryRow).createdAt.toISOString(),
      };
    });
    // Your own first, then people with something new, then the rest; most recent first within each.
    const rank = (g: StoryGroup) => (g.author.id === viewerId ? 0 : g.hasUnseen ? 1 : 2);
    return groups.sort((a, b) => rank(a) - rank(b) || b.latestAt.localeCompare(a.latestAt));
  }

  private toStory(r: StoryRow, viewerId: string, seen: boolean): Story {
    return {
      id: r.id,
      author: toAuthor(r.author),
      photoUrl: r.photoUrl,
      recipeId: r.recipeId,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      viewCount: r.authorId === viewerId ? r.viewCount : null,
      seen,
    };
  }
}
