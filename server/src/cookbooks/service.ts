import type { Cookbook, CookbookSummary, CreateCookbookRequest, Page, RecipeSummary, ToggleResponse, UpdateCookbookRequest } from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import { errors } from '../errors';
import { toSummary, withAuthor } from '../recipes/mappers';

const countRecipes = { _count: { select: { recipes: true } } } satisfies Prisma.CookbookInclude;
type CookbookRow = Prisma.CookbookGetPayload<{ include: typeof countRecipes }>;

const toSummaryOut = (r: CookbookRow): CookbookSummary => ({
  id: r.id,
  title: r.title,
  description: r.description,
  coverImageUrl: r.coverImageUrl,
  category: r.category,
  recipeCount: r._count.recipes,
  likeCount: r.likeCount,
  saveCount: r.saveCount,
  createdAt: r.createdAt.toISOString(),
});

const toCookbook = (r: CookbookRow, viewer: Cookbook['viewer']): Cookbook => ({
  ...toSummaryOut(r),
  published: r.published,
  updatedAt: r.updatedAt.toISOString(),
  viewer,
});

export class CookbookService {
  constructor(private readonly db: Db) {}

  /* ---- reading ---- */

  async list(opts: { category?: string | undefined; limit: number; cursor?: string | undefined }): Promise<Page<CookbookSummary>> {
    const rows = await this.db.cookbook.findMany({
      where: { published: true, ...(opts.category ? { category: opts.category } : {}) },
      include: countRecipes,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    return { items: page.map(toSummaryOut), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  async get(id: string, viewer: Viewer | null): Promise<Cookbook> {
    const row = await this.visible(id, viewer);
    if (!viewer) return toCookbook(row, null);
    const [like, save] = await Promise.all([
      this.db.cookbookLike.findUnique({ where: { userId_cookbookId: { userId: viewer.userId, cookbookId: id } }, select: { userId: true } }),
      this.db.cookbookSave.findUnique({ where: { userId_cookbookId: { userId: viewer.userId, cookbookId: id } }, select: { userId: true } }),
    ]);
    return toCookbook(row, { liked: like !== null, saved: save !== null });
  }

  /** The recipes in the order staff chose. Recipes that are no longer public are left out. */
  async recipes(id: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<RecipeSummary>> {
    await this.visible(id, viewer);
    const rows = await this.db.cookbookRecipe.findMany({
      where: { cookbookId: id, recipe: { status: 'PUBLISHED' } },
      include: { recipe: { include: withAuthor } },
      orderBy: [{ position: 'asc' }, { recipeId: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { cookbookId_recipeId: { cookbookId: id, recipeId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map((r) => toSummary(r.recipe)), nextCursor: hasMore ? (page.at(-1)?.recipeId ?? null) : null };
  }

  async listSaved(userId: string, limit: number, cursor?: string): Promise<Page<CookbookSummary>> {
    const rows = await this.db.cookbookSave.findMany({
      where: { userId, cookbook: { published: true } },
      include: { cookbook: { include: countRecipes } },
      orderBy: [{ createdAt: 'desc' }, { cookbookId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { userId_cookbookId: { userId, cookbookId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map((r) => toSummaryOut(r.cookbook)), nextCursor: hasMore ? (page.at(-1)?.cookbookId ?? null) : null };
  }

  /* ---- like and save: repeating either changes nothing ---- */

  async setLiked(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    await this.visible(id, viewer);
    return this.db.$transaction(async (tx) => {
      const changed = on
        ? (await tx.cookbookLike.createMany({ data: [{ userId: viewer.userId, cookbookId: id }], skipDuplicates: true })).count
        : (await tx.cookbookLike.deleteMany({ where: { userId: viewer.userId, cookbookId: id } })).count;
      const row = changed
        ? await tx.cookbook.update({ where: { id }, data: { likeCount: on ? { increment: 1 } : { decrement: 1 } }, select: { likeCount: true } })
        : await tx.cookbook.findUniqueOrThrow({ where: { id }, select: { likeCount: true } });
      return { active: on, count: row.likeCount };
    });
  }

  async setSaved(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    await this.visible(id, viewer);
    return this.db.$transaction(async (tx) => {
      const changed = on
        ? (await tx.cookbookSave.createMany({ data: [{ userId: viewer.userId, cookbookId: id }], skipDuplicates: true })).count
        : (await tx.cookbookSave.deleteMany({ where: { userId: viewer.userId, cookbookId: id } })).count;
      const row = changed
        ? await tx.cookbook.update({ where: { id }, data: { saveCount: on ? { increment: 1 } : { decrement: 1 } }, select: { saveCount: true } })
        : await tx.cookbook.findUniqueOrThrow({ where: { id }, select: { saveCount: true } });
      return { active: on, count: row.saveCount };
    });
  }

  /* ---- staff ---- */

  async create(input: CreateCookbookRequest): Promise<Cookbook> {
    await this.requireRecipes(input.recipeIds);
    const row = await this.db.cookbook.create({
      data: {
        title: input.title,
        description: input.description ?? '',
        coverImageUrl: input.coverImageUrl,
        category: input.category ?? null,
        published: input.published ?? true,
        recipes: { create: input.recipeIds.map((recipeId, position) => ({ recipeId, position })) },
      },
      include: countRecipes,
    });
    return toCookbook(row, null);
  }

  async update(id: string, input: UpdateCookbookRequest): Promise<Cookbook> {
    if (input.recipeIds) await this.requireRecipes(input.recipeIds);
    const data: Prisma.CookbookUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
    if (input.category !== undefined) data.category = input.category;
    if (input.published !== undefined) data.published = input.published;
    const row = await this.db.$transaction(async (tx) => {
      const exists = await tx.cookbook.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw errors.notFound('Cookbook not found');
      if (input.recipeIds) {
        await tx.cookbookRecipe.deleteMany({ where: { cookbookId: id } });
        await tx.cookbookRecipe.createMany({ data: input.recipeIds.map((recipeId, position) => ({ cookbookId: id, recipeId, position })) });
      }
      return tx.cookbook.update({ where: { id }, data, include: countRecipes });
    });
    return toCookbook(row, null);
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.db.cookbook.deleteMany({ where: { id } });
    if (count === 0) throw errors.notFound('Cookbook not found');
  }

  /* ---- helpers ---- */

  /** Unpublished cookbooks look like they do not exist, except to staff. */
  private async visible(id: string, viewer: Viewer | null): Promise<CookbookRow> {
    const row = await this.db.cookbook.findUnique({ where: { id }, include: countRecipes });
    if (!row || (!row.published && viewer?.role !== 'admin')) throw errors.notFound('Cookbook not found');
    return row;
  }

  private async requireRecipes(ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw errors.validation({ recipeIds: 'A recipe is listed twice' });
    const found = await this.db.recipe.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw errors.validation({ recipeIds: 'One of these recipes does not exist' });
  }
}
