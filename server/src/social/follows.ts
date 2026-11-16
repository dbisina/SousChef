import type { FollowToggle, Page, Participant, UserProfile } from '@shared';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

/** Following, profiles and finding people. Blocking in either direction hides people from each other. */
export class FollowService {
  constructor(private readonly db: Db) {}

  private async blockedBetween(a: string, b: string): Promise<boolean> {
    const hit = await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } });
    return hit !== null;
  }

  /** A profile. Someone who blocked you looks like they do not exist. */
  async profile(id: string, viewer: Viewer | null): Promise<UserProfile> {
    const user = await this.db.user.findUnique({ where: { id }, select: { ...authorSelect, bio: true, bannerUrl: true, createdAt: true } });
    if (!user) throw errors.notFound('Person not found');
    const theirBlock = viewer ? await this.db.block.findUnique({ where: { blockerId_blockedId: { blockerId: id, blockedId: viewer.userId } } }) : null;
    if (theirBlock) throw errors.notFound('Person not found');

    const [followerCount, followingCount, recipeCount, postCount] = await Promise.all([
      this.db.follow.count({ where: { followingId: id } }),
      this.db.follow.count({ where: { followerId: id } }),
      this.db.recipe.count({ where: { authorId: id, status: 'PUBLISHED' } }),
      this.db.post.count({ where: { authorId: id, status: 'PUBLISHED' } }),
    ]);

    let relation: UserProfile['viewer'] = null;
    if (viewer && viewer.userId !== id) {
      const [following, followedBy, blocked] = await Promise.all([
        this.db.follow.findUnique({ where: { followerId_followingId: { followerId: viewer.userId, followingId: id } } }),
        this.db.follow.findUnique({ where: { followerId_followingId: { followerId: id, followingId: viewer.userId } } }),
        this.db.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.userId, blockedId: id } } }),
      ]);
      relation = { following: following !== null, followedBy: followedBy !== null, blocked: blocked !== null };
    }
    return { ...toAuthor(user), bio: user.bio, bannerUrl: user.bannerUrl, followerCount, followingCount, recipeCount, postCount, createdAt: user.createdAt.toISOString(), viewer: relation };
  }

  async setFollowing(userId: string, target: string, on: boolean): Promise<FollowToggle> {
    if (target === userId) throw errors.validation({ userId: 'You cannot follow yourself' });
    if (!(await this.db.user.findUnique({ where: { id: target }, select: { id: true } }))) throw errors.notFound('Person not found');
    if (on) {
      if (await this.blockedBetween(userId, target)) throw errors.forbidden('You cannot follow this person');
      await this.db.follow.createMany({ data: [{ followerId: userId, followingId: target }], skipDuplicates: true });
    } else {
      await this.db.follow.deleteMany({ where: { followerId: userId, followingId: target } });
    }
    return { following: on, followerCount: await this.db.follow.count({ where: { followingId: target } }) };
  }

  /** People who follow `id`, newest first. */
  async followers(id: string, limit: number, cursor?: string): Promise<Page<Participant>> {
    const rows = await this.db.follow.findMany({
      where: { followingId: id },
      include: { follower: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: cursor, followingId: id } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map((r) => toAuthor(r.follower)), nextCursor: hasMore ? (page.at(-1)?.followerId ?? null) : null };
  }

  /** People `id` follows, newest first. */
  async following(id: string, limit: number, cursor?: string): Promise<Page<Participant>> {
    const rows = await this.db.follow.findMany({
      where: { followerId: id },
      include: { following: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: id, followingId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map((r) => toAuthor(r.following)), nextCursor: hasMore ? (page.at(-1)?.followingId ?? null) : null };
  }

  /** Finds people by part of a name or handle. Anyone blocked either way, and yourself, are left out. */
  async search(q: string, viewer: Viewer | null, limit: number): Promise<Participant[]> {
    const needle = q.trim().replace(/^@/, '');
    if (needle.length < 2) return [];
    const rows = await this.db.user.findMany({
      where: {
        OR: [{ handle: { contains: needle.toLowerCase() } }, { displayName: { contains: needle, mode: 'insensitive' } }],
        ...(viewer ? { id: { not: viewer.userId }, NOT: { OR: [{ blocking: { some: { blockedId: viewer.userId } } }, { blockedBy: { some: { blockerId: viewer.userId } } }] } } : {}),
      },
      select: authorSelect,
      // People whose handle starts with the search come first.
      orderBy: [{ handle: 'asc' }],
      take: limit * 3,
    });
    const lower = needle.toLowerCase();
    return rows
      .sort((a, b) => Number(b.handle.startsWith(lower)) - Number(a.handle.startsWith(lower)) || a.handle.localeCompare(b.handle))
      .slice(0, limit)
      .map(toAuthor);
  }
}
