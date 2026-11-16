import {
  calculateIngredientCalories,
  calculateNutrition,
  type CreateRecipeRequest,
  type MadePost,
  type Page,
  type RateRecipeResponse,
  type Recipe,
  type RecipeComment,
  type RecipeIngredient,
  type RecipeMatch,
  type RecipeSummary,
  type ToggleResponse,
  type UpdateRecipeRequest,
} from '@shared';
import { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import type { EntitlementService } from '../subscriptions/service';
import { errors } from '../errors';
import {
  authorSelect,
  averageRating,
  toComment,
  toMadePost,
  toRecipe,
  toSummary,
  withAuthor,
  type RecipeRow,
} from './mappers';

/** Distinct reports that hide a recipe until an admin looks at it. */
export const FLAG_HIDE_THRESHOLD = 3;
/** Most ranked matches a text search considers before the filters and the page are applied. */
const SEARCH_CANDIDATES = 200;

export type { Viewer };

export interface ListFilters {
  q?: string | undefined;
  category?: string | undefined;
  cuisine?: string | undefined;
  difficulty?: string | undefined;
  isOfficial?: boolean | undefined;
  authorId?: string | undefined;
  maxPrepTime?: number | undefined;
  maxCalories?: number | undefined;
  dietaryFlags?: string[] | undefined;
  excludeAllergens?: string[] | undefined;
  sort: 'new' | 'popular';
  limit: number;
  cursor?: string | undefined;
}

const cleanList = (values: string[] | undefined): string[] =>
  [...new Set((values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean))];

export class RecipeService {
  constructor(
    private readonly db: Db,
    private readonly entitlements: EntitlementService,
  ) {}

  /* ------------------------------------------------------------------ recipes */

  async create(viewer: Viewer, input: CreateRecipeRequest): Promise<Recipe> {
    this.requireAdminForFlags(viewer, input);
    const ingredients = withCalories(input.ingredients);
    const row = await this.db.recipe.create({
      data: {
        authorId: viewer.userId,
        title: input.title,
        description: input.description,
        imageUrl: input.imageUrl,
        youtubeUrl: input.youtubeUrl ?? null,
        status: input.status === 'draft' ? 'DRAFT' : 'PUBLISHED',
        isOfficial: input.isOfficial ?? false,
        isExclusive: input.isExclusive ?? false,
        category: input.category,
        cuisine: input.cuisine,
        difficulty: input.difficulty,
        prepTime: input.prepTime,
        cookTime: input.cookTime,
        servings: input.servings,
        ...derived(ingredients, input.servings),
        instructions: input.instructions,
        tags: cleanList(input.tags),
        dietaryFlags: cleanList(input.dietaryFlags),
        allergens: cleanList(input.allergens),
      },
      include: withAuthor,
    });
    return toRecipe(row, { liked: false, saved: false, myRating: null });
  }

  async get(id: string, viewer: Viewer | null): Promise<Recipe> {
    const row = await this.visibleRow(id, viewer);
    await this.requireExclusiveAccess(row, viewer);
    if (!viewer) return toRecipe(row, null);
    const [like, save, rating] = await Promise.all([
      this.db.recipeLike.findUnique({ where: { userId_recipeId: { userId: viewer.userId, recipeId: id } }, select: { userId: true } }),
      this.db.recipeSave.findUnique({ where: { userId_recipeId: { userId: viewer.userId, recipeId: id } }, select: { userId: true } }),
      this.db.recipeRating.findUnique({ where: { userId_recipeId: { userId: viewer.userId, recipeId: id } }, select: { rating: true } }),
    ]);
    return toRecipe(row, { liked: like !== null, saved: save !== null, myRating: rating?.rating ?? null });
  }

  async update(id: string, viewer: Viewer, input: UpdateRecipeRequest): Promise<Recipe> {
    const row = await this.db.recipe.findUnique({ where: { id }, include: withAuthor });
    if (!row || (row.authorId !== viewer.userId && viewer.role !== 'admin')) throw errors.notFound('Recipe not found');
    this.requireAdminForFlags(viewer, input);
    // A hidden recipe stays hidden until an admin restores it.
    if (row.status === 'FLAGGED' && input.status !== undefined && viewer.role !== 'admin') {
      throw errors.forbidden('This recipe was reported and is being reviewed');
    }

    const data: Prisma.RecipeUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.youtubeUrl !== undefined) data.youtubeUrl = input.youtubeUrl;
    if (input.category !== undefined) data.category = input.category;
    if (input.cuisine !== undefined) data.cuisine = input.cuisine;
    if (input.difficulty !== undefined) data.difficulty = input.difficulty;
    if (input.prepTime !== undefined) data.prepTime = input.prepTime;
    if (input.cookTime !== undefined) data.cookTime = input.cookTime;
    if (input.instructions !== undefined) data.instructions = input.instructions;
    if (input.tags !== undefined) data.tags = cleanList(input.tags);
    if (input.dietaryFlags !== undefined) data.dietaryFlags = cleanList(input.dietaryFlags);
    if (input.allergens !== undefined) data.allergens = cleanList(input.allergens);
    if (input.isOfficial !== undefined) data.isOfficial = input.isOfficial;
    if (input.isExclusive !== undefined) data.isExclusive = input.isExclusive;
    if (input.status !== undefined) data.status = input.status === 'draft' ? 'DRAFT' : 'PUBLISHED';
    if (input.servings !== undefined) data.servings = input.servings;
    if (input.ingredients !== undefined || input.servings !== undefined) {
      // Nutrition follows the ingredients and the servings, so it is recomputed whenever either changes.
      const ingredients = input.ingredients
        ? withCalories(input.ingredients)
        : (row.ingredients as unknown as RecipeIngredient[]);
      Object.assign(data, derived(ingredients, input.servings ?? row.servings));
    }

    await this.db.recipe.update({ where: { id }, data });
    return this.get(id, viewer);
  }

  async remove(id: string, viewer: Viewer): Promise<void> {
    const row = await this.db.recipe.findUnique({ where: { id }, select: { authorId: true } });
    if (!row || (row.authorId !== viewer.userId && viewer.role !== 'admin')) throw errors.notFound('Recipe not found');
    await this.db.recipe.delete({ where: { id } });
  }

  /* ------------------------------------------------------------------ lists and search */

  async list(filters: ListFilters): Promise<Page<RecipeSummary>> {
    const where: Prisma.RecipeWhereInput = { status: 'PUBLISHED' };
    if (filters.category) where.category = filters.category;
    if (filters.cuisine) where.cuisine = filters.cuisine;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.isOfficial !== undefined) where.isOfficial = filters.isOfficial;
    if (filters.authorId) where.authorId = filters.authorId;
    if (filters.maxPrepTime !== undefined) where.prepTime = { lte: filters.maxPrepTime };
    if (filters.maxCalories !== undefined) where.caloriesPerServing = { lte: filters.maxCalories };
    if (filters.dietaryFlags?.length) where.dietaryFlags = { hasEvery: filters.dietaryFlags };
    if (filters.excludeAllergens?.length) where.NOT = { allergens: { hasSome: filters.excludeAllergens } };

    if (filters.q) return this.search(filters.q, where, filters.limit, filters.cursor);

    const rows = await this.db.recipe.findMany({
      where,
      include: withAuthor,
      orderBy:
        filters.sort === 'popular'
          ? [{ likeCount: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    return pageOf(rows, filters.limit, toSummary);
  }

  /** Text search: best matches first (whole words, then close spellings of the title). Paged by offset. */
  private async search(q: string, where: Prisma.RecipeWhereInput, limit: number, cursor?: string): Promise<Page<RecipeSummary>> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw errors.validation({ cursor: 'Not a valid cursor' });

    const ranked = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Recipe"
      WHERE "status" = 'PUBLISHED'
        AND (to_tsvector('simple', "title" || ' ' || "description") @@ websearch_to_tsquery('simple', ${q}::text)
             OR ${q}::text <% "title")
      ORDER BY ts_rank(to_tsvector('simple', "title" || ' ' || "description"), websearch_to_tsquery('simple', ${q}::text)) DESC,
               word_similarity(${q}::text, "title") DESC,
               "createdAt" DESC
      LIMIT ${SEARCH_CANDIDATES}`;
    const order = new Map(ranked.map((r, i) => [r.id, i]));
    if (order.size === 0) return { items: [], nextCursor: null };

    const rows = await this.db.recipe.findMany({ where: { AND: [where, { id: { in: [...order.keys()] } }] }, include: withAuthor });
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const slice = rows.slice(offset, offset + limit);
    return {
      items: slice.map(toSummary),
      nextCursor: offset + limit < rows.length ? String(offset + limit) : null,
    };
  }

  /** The person's own recipes, drafts and reported ones included. */
  async listMine(userId: string, limit: number, cursor?: string): Promise<Page<RecipeSummary>> {
    const rows = await this.db.recipe.findMany({
      where: { authorId: userId },
      include: withAuthor,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return pageOf(rows, limit, toSummary);
  }

  async listSaved(userId: string, limit: number, cursor?: string): Promise<Page<RecipeSummary>> {
    const saves = await this.db.recipeSave.findMany({
      where: { userId, recipe: { status: 'PUBLISHED' } },
      include: { recipe: { include: withAuthor } },
      orderBy: [{ createdAt: 'desc' }, { recipeId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { userId_recipeId: { userId, recipeId: cursor } }, skip: 1 } : {}),
    });
    const hasMore = saves.length > limit;
    const page = saves.slice(0, limit);
    return { items: page.map((s) => toSummary(s.recipe)), nextCursor: hasMore ? (page.at(-1)?.recipeId ?? null) : null };
  }

  /** Recipes that use what the person has, best match first. */
  async match(ingredients: string[], limit: number): Promise<RecipeMatch[]> {
    const names = cleanList(ingredients);
    if (names.length === 0) return [];
    const hits = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Recipe"
      WHERE "status" = 'PUBLISHED' AND "ingredientNames" && ${names}::text[]
      ORDER BY cardinality(ARRAY(SELECT unnest("ingredientNames") INTERSECT SELECT unnest(${names}::text[])))::float
               / GREATEST(cardinality("ingredientNames"), 1) DESC,
               "createdAt" DESC
      LIMIT ${limit}`;
    if (hits.length === 0) return [];
    const rows = await this.db.recipe.findMany({ where: { id: { in: hits.map((h) => h.id) } }, include: withAuthor });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const have = new Set(names);
    return hits.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      const needed = row.ingredientNames;
      const missing = needed.filter((n) => !have.has(n));
      const matchPercent = needed.length === 0 ? 0 : Math.round(((needed.length - missing.length) / needed.length) * 100);
      return [{ recipe: toSummary(row), matchPercent, missing }];
    });
  }

  /* ------------------------------------------------------------------ likes and saves */

  likeState(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    return this.flip(id, viewer, on, 'likeCount', {
      insert: (tx) => tx.recipeLike.createMany({ data: [{ userId: viewer.userId, recipeId: id }], skipDuplicates: true }).then((r) => r.count),
      remove: (tx) => tx.recipeLike.deleteMany({ where: { userId: viewer.userId, recipeId: id } }).then((r) => r.count),
    });
  }

  saveState(id: string, viewer: Viewer, on: boolean): Promise<ToggleResponse> {
    return this.flip(id, viewer, on, 'saveCount', {
      insert: (tx) => tx.recipeSave.createMany({ data: [{ userId: viewer.userId, recipeId: id }], skipDuplicates: true }).then((r) => r.count),
      remove: (tx) => tx.recipeSave.deleteMany({ where: { userId: viewer.userId, recipeId: id } }).then((r) => r.count),
    });
  }

  /**
   * Adds or removes a like/save. The row and the counter change in one transaction, and a repeat of the same action
   * changes nothing, so a double tap or a retried request cannot throw the count off.
   */
  private async flip(
    id: string,
    viewer: Viewer,
    on: boolean,
    counter: 'likeCount' | 'saveCount',
    ops: { insert: (tx: Prisma.TransactionClient) => Promise<number>; remove: (tx: Prisma.TransactionClient) => Promise<number> },
  ): Promise<ToggleResponse> {
    await this.visibleRow(id, viewer);
    return this.db.$transaction(async (tx) => {
      const changed = await (on ? ops.insert(tx) : ops.remove(tx));
      const recipe =
        changed > 0
          ? await tx.recipe.update({ where: { id }, data: { [counter]: on ? { increment: 1 } : { decrement: 1 } }, select: { likeCount: true, saveCount: true } })
          : await tx.recipe.findUniqueOrThrow({ where: { id }, select: { likeCount: true, saveCount: true } });
      return { active: on, count: recipe[counter] };
    });
  }

  /* ------------------------------------------------------------------ ratings */

  async rate(id: string, viewer: Viewer, rating: number, review: string | undefined): Promise<RateRecipeResponse> {
    const row = await this.visibleRow(id, viewer);
    if (row.authorId === viewer.userId) throw errors.forbidden('You cannot rate your own recipe');
    return this.db.$transaction(async (tx) => {
      // Lock the recipe row so two ratings arriving together are applied one after the other.
      await tx.$queryRaw`SELECT 1 FROM "Recipe" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const key = { userId_recipeId: { userId: viewer.userId, recipeId: id } };
      const existing = await tx.recipeRating.findUnique({ where: key, select: { rating: true } });
      await tx.recipeRating.upsert({
        where: key,
        create: { userId: viewer.userId, recipeId: id, rating, review: review ?? null },
        update: { rating, review: review ?? null },
      });
      const updated = await tx.recipe.update({
        where: { id },
        data: existing
          ? { ratingSum: { increment: rating - existing.rating } }
          : { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
        select: { ratingSum: true, ratingCount: true },
      });
      return { rating: averageRating(updated.ratingSum, updated.ratingCount), ratingCount: updated.ratingCount };
    });
  }

  /* ------------------------------------------------------------------ comments */

  async listComments(id: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<RecipeComment>> {
    await this.visibleRow(id, viewer);
    const rows = await this.db.recipeComment.findMany({
      where: { recipeId: id },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return pageOf(rows, limit, toComment);
  }

  async addComment(id: string, viewer: Viewer, text: string): Promise<RecipeComment> {
    await this.visibleRow(id, viewer);
    return this.db.$transaction(async (tx) => {
      const comment = await tx.recipeComment.create({
        data: { recipeId: id, authorId: viewer.userId, text },
        include: { author: { select: authorSelect } },
      });
      await tx.recipe.update({ where: { id }, data: { commentCount: { increment: 1 } } });
      return toComment(comment);
    });
  }

  async deleteComment(id: string, commentId: string, viewer: Viewer): Promise<void> {
    const comment = await this.db.recipeComment.findFirst({
      where: { id: commentId, recipeId: id },
      select: { authorId: true, recipe: { select: { authorId: true } } },
    });
    // The commenter, the recipe's author and admins may remove a comment.
    const allowed = comment && (comment.authorId === viewer.userId || comment.recipe.authorId === viewer.userId || viewer.role === 'admin');
    if (!comment || !allowed) throw errors.notFound('Comment not found');
    await this.db.$transaction(async (tx) => {
      const { count } = await tx.recipeComment.deleteMany({ where: { id: commentId } });
      if (count > 0) await tx.recipe.update({ where: { id }, data: { commentCount: { decrement: 1 } } });
    });
  }

  /* ------------------------------------------------------------------ "I made this" posts */

  async listMadePosts(id: string, viewer: Viewer | null, limit: number, cursor?: string): Promise<Page<MadePost>> {
    await this.visibleRow(id, viewer);
    const rows = await this.db.recipeMadePost.findMany({
      where: { recipeId: id },
      include: { author: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return pageOf(rows, limit, toMadePost);
  }

  async addMadePost(id: string, viewer: Viewer, imageUrl: string, caption: string | undefined): Promise<MadePost> {
    await this.visibleRow(id, viewer);
    const post = await this.db.recipeMadePost.create({
      data: { recipeId: id, authorId: viewer.userId, imageUrl, caption: caption ?? '' },
      include: { author: { select: authorSelect } },
    });
    return toMadePost(post);
  }

  async deleteMadePost(id: string, postId: string, viewer: Viewer): Promise<void> {
    const post = await this.db.recipeMadePost.findFirst({ where: { id: postId, recipeId: id }, select: { authorId: true } });
    if (!post || (post.authorId !== viewer.userId && viewer.role !== 'admin')) throw errors.notFound('Post not found');
    await this.db.recipeMadePost.delete({ where: { id: postId } });
  }

  /* ------------------------------------------------------------------ reports */

  async flag(id: string, viewer: Viewer, reason: string): Promise<void> {
    const row = await this.visibleRow(id, viewer);
    if (row.authorId === viewer.userId) throw errors.forbidden('You cannot report your own recipe');
    await this.db.recipeFlag.createMany({ data: [{ recipeId: id, reporterId: viewer.userId, reason }], skipDuplicates: true });
    const reports = await this.db.recipeFlag.count({ where: { recipeId: id } });
    if (reports >= FLAG_HIDE_THRESHOLD) {
      await this.db.recipe.updateMany({ where: { id, status: 'PUBLISHED' }, data: { status: 'FLAGGED' } });
    }
  }

  /* ------------------------------------------------------------------ helpers */

  /** The recipe if this person may see it; otherwise "not found" (so hidden recipes cannot be probed for). */
  private async visibleRow(id: string, viewer: Viewer | null): Promise<RecipeRow> {
    const row = await this.db.recipe.findUnique({ where: { id }, include: withAuthor });
    const mine = viewer !== null && (row?.authorId === viewer.userId || viewer.role === 'admin');
    if (!row || (row.status !== 'PUBLISHED' && !mine)) throw errors.notFound('Recipe not found');
    return row;
  }

  /** Pro-only recipes open for the author, staff and people on a plan that includes them. */
  private async requireExclusiveAccess(row: RecipeRow, viewer: Viewer | null): Promise<void> {
    if (!row.isExclusive) return;
    if (viewer && (viewer.userId === row.authorId || viewer.role === 'admin')) return;
    if (viewer && (await this.entitlements.forUser(viewer.userId)).features.exclusiveRecipes) return;
    throw errors.upgradeRequired('pro');
  }

  private requireAdminForFlags(viewer: Viewer, input: { isOfficial?: boolean | undefined; isExclusive?: boolean | undefined }): void {
    if ((input.isOfficial || input.isExclusive) && viewer.role !== 'admin') {
      throw errors.forbidden('Only SousChef staff can mark a recipe official or exclusive');
    }
  }
}

function withCalories(input: CreateRecipeRequest['ingredients']): RecipeIngredient[] {
  return input.map((i) => ({
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    optional: i.optional ?? false,
    calories: calculateIngredientCalories(i.name, i.amount, i.unit),
  }));
}

/** The stored fields that follow from the ingredients and servings. */
function derived(ingredients: RecipeIngredient[], servings: number) {
  const nutrition = calculateNutrition(ingredients, servings);
  return {
    ingredients: ingredients as unknown as Prisma.InputJsonValue,
    ingredientNames: cleanList(ingredients.map((i) => i.name)),
    nutrition: nutrition as unknown as Prisma.InputJsonValue,
    caloriesPerServing: nutrition.caloriesPerServing,
  };
}

/** Takes `limit + 1` rows: the extra one only says whether another page exists. */
function pageOf<R extends { id: string }, T>(rows: R[], limit: number, map: (row: R) => T): Page<T> {
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return { items: page.map(map), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
}
