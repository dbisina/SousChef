import {
  matchPantry,
  nameKey,
  type AddShoppingItemsRequest,
  type AddWantToCookRequest,
  type ImportedRecipe,
  type PantryCategory,
  type PantryFilter,
  type PantryItem,
  type PantryItemInput,
  type PantrySummary,
  type Page,
  type RecipeIngredient,
  type ShoppingItem,
  type UpdatePantryItemRequest,
  type UpdateShoppingItemRequest,
  type UpdateWantToCookRequest,
  type WantToCookItem,
  type WantToCookStatus,
  PANTRY_CATEGORIES,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Db } from '../db';
import { errors } from '../errors';
import { toSummary, withAuthor, type RecipeRow } from '../recipes/mappers';

/** Per person. Keeps one account from filling the database. */
export const MAX_PANTRY_ITEMS = 500;
export const MAX_WANT_TO_COOK = 500;
export const MAX_SHOPPING_ITEMS = 300;
const DAY_MS = 86_400_000;
const EXPIRING_WITHIN_DAYS = 3;

/* ------------------------------------------------------------------ mappers */

type PantryRow = Prisma.PantryItemGetPayload<object>;
const toPantryItem = (r: PantryRow): PantryItem => ({
  id: r.id,
  name: r.name,
  amount: r.amount,
  unit: r.unit,
  category: r.category as PantryCategory, // validated on the way in
  expiresAt: r.expiresAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

type ShoppingRow = Prisma.ShoppingItemGetPayload<object>;
const toShoppingItem = (r: ShoppingRow): ShoppingItem => ({
  id: r.id,
  name: r.name,
  amount: r.amount,
  unit: r.unit,
  category: r.category,
  checked: r.checked,
  recipeId: r.recipeId,
  recipeTitle: r.recipeTitle,
  createdAt: r.createdAt.toISOString(),
});

const statusOut: Record<string, WantToCookStatus> = { SAVED: 'saved', PLANNED: 'planned', SHOPPING: 'shopping', COOKED: 'cooked' };
const statusIn: Record<WantToCookStatus, 'SAVED' | 'PLANNED' | 'SHOPPING' | 'COOKED'> = {
  saved: 'SAVED',
  planned: 'PLANNED',
  shopping: 'SHOPPING',
  cooked: 'COOKED',
};

type WantRow = Prisma.WantToCookItemGetPayload<{ include: { recipe: { include: typeof withAuthor } } }>;

/** The ingredients of whichever kind of recipe this is. */
function ingredientsOf(row: WantRow): { name: string; amount: number; unit: string; optional?: boolean }[] {
  if (row.recipe) return row.recipe.ingredients as unknown as RecipeIngredient[];
  return (row.imported as unknown as ImportedRecipe).ingredients;
}

const wantInclude = { recipe: { include: withAuthor } } satisfies Prisma.WantToCookItemInclude;

/* ------------------------------------------------------------------ pantry */

export class PantryService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(userId: string, opts: { category?: PantryCategory | undefined; q?: string | undefined; filter?: PantryFilter | undefined }): Promise<PantryItem[]> {
    const now = this.now();
    const where: Prisma.PantryItemWhereInput = { userId };
    if (opts.category) where.category = opts.category;
    if (opts.q) where.OR = [{ name: { contains: opts.q, mode: 'insensitive' } }, { category: { contains: opts.q.toLowerCase() } }];
    if (opts.filter === 'expiring') where.expiresAt = { gt: now, lt: new Date(now.getTime() + EXPIRING_WITHIN_DAYS * DAY_MS) };
    if (opts.filter === 'expired') where.expiresAt = { lt: now };
    const rows = await this.db.pantryItem.findMany({
      where,
      // Soonest to expire first when looking at expiry; otherwise newest first.
      orderBy: opts.filter ? [{ expiresAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_PANTRY_ITEMS,
    });
    return rows.map(toPantryItem);
  }

  async summary(userId: string): Promise<PantrySummary> {
    const summary = Object.fromEntries(PANTRY_CATEGORIES.map((c) => [c, 0])) as PantrySummary;
    const groups = await this.db.pantryItem.groupBy({ by: ['category'], where: { userId }, _count: { _all: true } });
    for (const g of groups) if (g.category in summary) summary[g.category as PantryCategory] = g._count._all;
    return summary;
  }

  async names(userId: string): Promise<string[]> {
    const rows = await this.db.pantryItem.findMany({ where: { userId }, select: { name: true }, take: MAX_PANTRY_ITEMS });
    return rows.map((r) => r.name);
  }

  async add(userId: string, input: PantryItemInput): Promise<PantryItem> {
    return (await this.addMany(userId, [input]))[0] as PantryItem;
  }

  async addMany(userId: string, inputs: PantryItemInput[]): Promise<PantryItem[]> {
    const have = await this.db.pantryItem.count({ where: { userId } });
    if (have + inputs.length > MAX_PANTRY_ITEMS) {
      throw errors.limitReached(`Your pantry can hold ${MAX_PANTRY_ITEMS} items. Remove some to add more.`);
    }
    const rows = await this.db.pantryItem.createManyAndReturn({
      data: inputs.map((i) => ({
        userId,
        name: i.name,
        nameKey: nameKey(i.name),
        amount: i.amount,
        unit: i.unit,
        category: i.category,
        expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
      })),
    });
    return rows.map(toPantryItem);
  }

  async update(userId: string, id: string, input: UpdatePantryItemRequest): Promise<PantryItem> {
    const data: Prisma.PantryItemUpdateManyMutationInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
      data.nameKey = nameKey(input.name);
    }
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.category !== undefined) data.category = input.category;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt === null ? null : new Date(input.expiresAt);
    const { count } = await this.db.pantryItem.updateMany({ where: { id, userId }, data });
    if (count === 0) throw errors.notFound('Pantry item not found');
    return toPantryItem(await this.db.pantryItem.findUniqueOrThrow({ where: { id } }));
  }

  /** Takes some of an item away (cooked with it). When nothing is left the item is removed and null comes back. */
  async use(userId: string, id: string, used: number): Promise<PantryItem | null> {
    return this.db.$transaction(async (tx) => {
      // Lock the row so two "I used some" requests are applied one after the other, not both from the same starting amount.
      const locked = await tx.$queryRaw<{ amount: number }[]>`
        SELECT "amount" FROM "PantryItem" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const current = locked[0];
      if (!current) throw errors.notFound('Pantry item not found');
      const left = current.amount - used;
      if (left <= 1e-9) {
        await tx.pantryItem.delete({ where: { id } });
        return null;
      }
      return toPantryItem(await tx.pantryItem.update({ where: { id }, data: { amount: left } }));
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.db.pantryItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw errors.notFound('Pantry item not found');
  }

  async clear(userId: string): Promise<void> {
    await this.db.pantryItem.deleteMany({ where: { userId } });
  }
}

/* ------------------------------------------------------------------ shopping list */

export class ShoppingService {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<ShoppingItem[]> {
    const rows = await this.db.shoppingItem.findMany({
      where: { userId },
      orderBy: [{ checked: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_SHOPPING_ITEMS,
    });
    return rows.map(toShoppingItem);
  }

  /** Adds lines. Something already on the list (same name and unit, not ticked off) just gets the amount added. */
  async add(userId: string, input: AddShoppingItemsRequest['items']): Promise<ShoppingItem[]> {
    return this.db.$transaction(async (tx) => {
      const out: ShoppingItem[] = [];
      for (const item of input) {
        const key = nameKey(item.name);
        const unit = item.unit.trim();
        const existing = await tx.shoppingItem.findFirst({ where: { userId, nameKey: key, unit, checked: false } });
        if (existing) {
          out.push(toShoppingItem(await tx.shoppingItem.update({ where: { id: existing.id }, data: { amount: { increment: item.amount } } })));
          continue;
        }
        if ((await tx.shoppingItem.count({ where: { userId } })) >= MAX_SHOPPING_ITEMS) {
          throw errors.limitReached(`Your shopping list can hold ${MAX_SHOPPING_ITEMS} items. Clear some to add more.`);
        }
        out.push(
          toShoppingItem(
            await tx.shoppingItem.create({
              data: {
                userId,
                name: item.name,
                nameKey: key,
                amount: item.amount,
                unit,
                category: item.category ?? null,
                recipeId: item.recipeId ?? null,
                recipeTitle: item.recipeTitle ?? null,
              },
            }),
          ),
        );
      }
      return out;
    });
  }

  async update(userId: string, id: string, input: UpdateShoppingItemRequest): Promise<ShoppingItem> {
    const data: Prisma.ShoppingItemUpdateManyMutationInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
      data.nameKey = nameKey(input.name);
    }
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.unit !== undefined) data.unit = input.unit.trim();
    if (input.checked !== undefined) data.checked = input.checked;
    const { count } = await this.db.shoppingItem.updateMany({ where: { id, userId }, data });
    if (count === 0) throw errors.notFound('Shopping item not found');
    return toShoppingItem(await this.db.shoppingItem.findUniqueOrThrow({ where: { id } }));
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.db.shoppingItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw errors.notFound('Shopping item not found');
  }

  async clear(userId: string, checkedOnly: boolean): Promise<void> {
    await this.db.shoppingItem.deleteMany({ where: { userId, ...(checkedOnly ? { checked: true } : {}) } });
  }
}

/* ------------------------------------------------------------------ want to cook */

export class WantToCookService {
  constructor(
    private readonly db: Db,
    private readonly pantry: PantryService,
    private readonly shopping: ShoppingService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Saved recipes, newest first, each with how much of it the pantry covers. */
  async list(userId: string, opts: { status?: WantToCookStatus | undefined; limit: number; cursor?: string | undefined }): Promise<Page<WantToCookItem>> {
    const rows = await this.db.wantToCookItem.findMany({
      where: { userId, ...(opts.status ? { status: statusIn[opts.status] } : {}), ...this.available(userId) },
      include: wantInclude,
      orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    const names = await this.pantry.names(userId);
    return { items: page.map((r) => this.toItem(r, names)), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  /** Adding a recipe that is already saved changes nothing and says so (`created: false`). */
  async add(userId: string, input: AddWantToCookRequest): Promise<{ item: WantToCookItem; created: boolean }> {
    if ((await this.db.wantToCookItem.count({ where: { userId } })) >= MAX_WANT_TO_COOK) {
      throw errors.limitReached(`You can save ${MAX_WANT_TO_COOK} recipes. Remove some to save more.`);
    }
    let id: string;
    let created = true;
    if ('recipeId' in input) {
      const recipe = await this.db.recipe.findFirst({
        where: { id: input.recipeId, OR: [{ status: 'PUBLISHED' }, { authorId: userId }] },
        select: { id: true },
      });
      if (!recipe) throw errors.notFound('Recipe not found');
      const { count } = await this.db.wantToCookItem.createMany({ data: [{ userId, recipeId: recipe.id }], skipDuplicates: true });
      created = count === 1;
      id = (await this.db.wantToCookItem.findFirstOrThrow({ where: { userId, recipeId: recipe.id }, select: { id: true } })).id;
    } else {
      id = (await this.db.wantToCookItem.create({ data: { userId, imported: input.imported as unknown as Prisma.InputJsonValue }, select: { id: true } })).id;
    }
    return { item: await this.get(userId, id), created };
  }

  async update(userId: string, id: string, input: UpdateWantToCookRequest): Promise<WantToCookItem> {
    const row = await this.db.wantToCookItem.findFirst({ where: { id, userId }, select: { status: true } });
    if (!row) throw errors.notFound('Saved recipe not found');
    const data: Prisma.WantToCookItemUpdateInput = {};
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.plannedFor !== undefined) data.plannedFor = input.plannedFor === null ? null : new Date(input.plannedFor);
    if (input.status !== undefined) {
      data.status = statusIn[input.status];
      // The time it was cooked is set when it becomes cooked and cleared if it is moved back.
      if (input.status === 'cooked' && row.status !== 'COOKED') data.cookedAt = this.now();
      if (input.status !== 'cooked') data.cookedAt = null;
    }
    await this.db.wantToCookItem.update({ where: { id }, data });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.db.wantToCookItem.deleteMany({ where: { id, userId } });
    if (count === 0) throw errors.notFound('Saved recipe not found');
  }

  /** Puts what is missing from the pantry onto the shopping list, and marks the recipe as "shopping". */
  async addMissingToShoppingList(userId: string, id: string): Promise<{ added: ShoppingItem[]; item: WantToCookItem }> {
    const row = await this.rowFor(userId, id);
    const ingredients = ingredientsOf(row);
    const match = matchPantry(ingredients, await this.pantry.names(userId));
    const missing = new Set(match.missing);
    const title = row.recipe?.title ?? (row.imported as unknown as ImportedRecipe).title;
    const lines = ingredients
      .filter((i) => missing.has(i.name))
      .map((i) => ({
        name: i.name,
        amount: i.amount > 0 ? i.amount : 1,
        unit: i.unit,
        ...(row.recipeId ? { recipeId: row.recipeId } : {}),
        recipeTitle: title,
      }));
    const added = lines.length > 0 ? await this.shopping.add(userId, lines) : [];
    if (added.length > 0 && (row.status === 'SAVED' || row.status === 'PLANNED')) {
      await this.db.wantToCookItem.update({ where: { id }, data: { status: 'SHOPPING' } });
    }
    return { added, item: await this.get(userId, id) };
  }

  /* ---- helpers ---- */

  /** Hide a saved recipe that has since become unavailable (its author unpublished it, or it was reported). */
  private available(userId: string): Prisma.WantToCookItemWhereInput {
    return { OR: [{ recipeId: null }, { recipe: { OR: [{ status: 'PUBLISHED' }, { authorId: userId }] } }] };
  }

  private async rowFor(userId: string, id: string): Promise<WantRow> {
    const row = await this.db.wantToCookItem.findFirst({ where: { id, userId, ...this.available(userId) }, include: wantInclude });
    if (!row) throw errors.notFound('Saved recipe not found');
    return row;
  }

  private async get(userId: string, id: string): Promise<WantToCookItem> {
    return this.toItem(await this.rowFor(userId, id), await this.pantry.names(userId));
  }

  private toItem(row: WantRow, pantryNames: string[]): WantToCookItem {
    return {
      id: row.id,
      status: statusOut[row.status] ?? 'saved',
      savedAt: row.savedAt.toISOString(),
      plannedFor: row.plannedFor?.toISOString() ?? null,
      cookedAt: row.cookedAt?.toISOString() ?? null,
      notes: row.notes,
      recipe: row.recipe ? toSummary(row.recipe as RecipeRow) : null,
      imported: row.recipe ? null : (row.imported as unknown as ImportedRecipe),
      pantryMatch: matchPantry(ingredientsOf(row), pantryNames),
    };
  }
}
