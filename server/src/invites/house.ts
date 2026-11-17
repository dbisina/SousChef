import type { CreateHouseAccountRequest, CreateHousePostRequest, HouseAccount, HouseSwitchResult, Post } from '@shared';
import type { Db } from '../db';
import { isUniqueViolation } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

const MAX_HOUSE_ACCOUNTS = 60;
const handleOf = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);

/**
 * enplace's own labeled accounts, run by staff to keep the app lively before there are many people. They always show
 * as official (`kind: house`), cannot sign in (no email, password or provider), and one switch takes all their posts
 * out of sight at once and puts them back.
 */
export class HouseService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateHouseAccountRequest): Promise<HouseAccount> {
    if ((await this.db.user.count({ where: { kind: 'HOUSE' } })) >= MAX_HOUSE_ACCOUNTS) {
      throw errors.limitReached(`There can be ${MAX_HOUSE_ACCOUNTS} house accounts`);
    }
    const handle = input.handle ?? handleOf(input.displayName);
    if (handle.length < 3) throw errors.validation({ handle: 'Use a handle of at least 3 letters or numbers' });
    try {
      const row = await this.db.user.create({
        data: { displayName: input.displayName, handle, bio: input.bio ?? '', photoUrl: input.photoUrl ?? null, kind: 'HOUSE', createdAt: this.now() },
        select: { ...authorSelect, bio: true, createdAt: true },
      });
      return { user: toAuthor(row), bio: row.bio, postCount: 0, createdAt: row.createdAt.toISOString() };
    } catch (e) {
      if (isUniqueViolation(e, 'handle')) throw errors.handleTaken();
      throw e;
    }
  }

  async list(): Promise<HouseAccount[]> {
    const rows = await this.db.user.findMany({ where: { kind: 'HOUSE' }, select: { ...authorSelect, bio: true, createdAt: true, _count: { select: { posts: true } } }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => ({ user: toAuthor(r), bio: r.bio, postCount: r._count.posts, createdAt: r.createdAt.toISOString() }));
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.db.user.deleteMany({ where: { id, kind: 'HOUSE' } });
    if (count === 0) throw errors.notFound('House account not found');
  }

  /** Posts as a house account. The photo is a web address staff supply (there is no phone to upload from). */
  async post(accountId: string, input: CreateHousePostRequest): Promise<Pick<Post, 'id' | 'title' | 'kind' | 'photoUrl'>> {
    const account = await this.db.user.findFirst({ where: { id: accountId, kind: 'HOUSE' }, select: { id: true } });
    if (!account) throw errors.notFound('House account not found');
    if (input.kind === 'recipe' && !input.recipeId) throw errors.validation({ recipeId: 'Choose the recipe to share' });
    if (input.recipeId && !(await this.db.recipe.findFirst({ where: { id: input.recipeId, status: 'PUBLISHED' }, select: { id: true } }))) {
      throw errors.validation({ recipeId: 'That recipe does not exist' });
    }
    const row = await this.db.post.create({
      data: {
        authorId: accountId,
        kind: input.kind,
        title: input.title,
        caption: input.caption ?? '',
        meta: input.meta ?? null,
        photoUrl: input.photoUrl,
        videoUrl: input.videoUrl ?? null,
        recipeId: input.recipeId ?? null,
        createdAt: this.now(),
      },
      select: { id: true, title: true, kind: true, photoUrl: true },
    });
    return { id: row.id, title: row.title, kind: row.kind as Post['kind'], photoUrl: row.photoUrl };
  }

  /** The kill switch: every house post out of sight (`off`), or back (`on`). Posts hidden for other reasons stay hidden. */
  async setVisible(on: boolean): Promise<HouseSwitchResult> {
    const { count } = await this.db.post.updateMany({
      where: { author: { kind: 'HOUSE' }, status: on ? 'PAUSED' : 'PUBLISHED' },
      data: { status: on ? 'PUBLISHED' : 'PAUSED' },
    });
    return { posts: count };
  }
}
