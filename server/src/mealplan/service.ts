import {
  MEAL_TYPES,
  WASTE_REASONS,
  weekDates,
  weekStartOf,
  type LogWasteRequest,
  type MealPlan,
  type MealPlanDay,
  type MealPlanStats,
  type MealType,
  type Page,
  type PlanShoppingItem,
  type PlannedMeal,
  type SaveMealPlanRequest,
  type WasteEntry,
  type WasteReason,
  type WasteStats,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Db } from '../db';
import { errors } from '../errors';

const DAY_MS = 86_400_000;
/** A change of more than this share, up or down, against the month before counts as a trend. */
const TREND_THRESHOLD = 0.1;

const asDate = (isoDay: string): Date => new Date(`${isoDay}T00:00:00.000Z`);
const noStats = (): MealPlanStats => ({
  pantryItemsUsed: 0,
  expiringItemsUsed: 0,
  ingredientOverlap: 0,
  estimatedSavings: 0,
  totalMeals: 0,
  uniqueRecipes: 0,
});

type PlanRow = Prisma.MealPlanGetPayload<object>;

const toPlan = (r: PlanRow): MealPlan => ({
  weekStart: r.weekStart.toISOString().slice(0, 10),
  // JSON columns written only by this service from validated input.
  days: r.days as unknown as MealPlanDay[],
  shoppingList: r.shoppingList as unknown as PlanShoppingItem[],
  stats: r.stats as unknown as MealPlanStats,
  isGenerated: r.isGenerated,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/** Seven days in order; any day the caller left out is empty. Days outside the week, or repeated, are an error. */
function normalizeDays(weekStart: string, days: MealPlanDay[]): MealPlanDay[] {
  const wanted = weekDates(weekStart);
  const byDate = new Map<string, MealPlanDay>();
  for (const d of days) {
    if (!wanted.includes(d.date)) throw errors.validation({ days: `${d.date} is not in the week starting ${weekStart}` });
    if (byDate.has(d.date)) throw errors.validation({ days: `${d.date} appears twice` });
    byDate.set(d.date, d);
  }
  return wanted.map((date) => byDate.get(date) ?? { date });
}

/** The two totals the server always works out itself. */
function totals(days: MealPlanDay[]): Pick<MealPlanStats, 'totalMeals' | 'uniqueRecipes'> {
  const ids = new Set<string>();
  let totalMeals = 0;
  for (const day of days) {
    for (const type of MEAL_TYPES) {
      const meal = day[type];
      if (meal) {
        totalMeals++;
        ids.add(meal.recipeId);
      }
    }
  }
  return { totalMeals, uniqueRecipes: ids.size };
}

export class MealPlanService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** This week's plan (the week is the UTC Monday-to-Sunday containing "now"), or null if there is none yet. */
  current(userId: string): Promise<MealPlan | null> {
    return this.get(userId, weekStartOf(this.now()));
  }

  async get(userId: string, weekStart: string): Promise<MealPlan | null> {
    const row = await this.db.mealPlan.findUnique({ where: { userId_weekStart: { userId, weekStart: asDate(weekStart) } } });
    return row ? toPlan(row) : null;
  }

  /** Newest week first. The cursor is the last week returned. */
  async list(userId: string, limit: number, cursor?: string): Promise<Page<MealPlan>> {
    const rows = await this.db.mealPlan.findMany({
      where: { userId, ...(cursor ? { weekStart: { lt: asDate(cursor) } } : {}) },
      orderBy: { weekStart: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map(toPlan);
    return { items: page, nextCursor: hasMore ? (page.at(-1)?.weekStart ?? null) : null };
  }

  /** Creates the week's plan or replaces it. */
  async save(userId: string, weekStart: string, input: SaveMealPlanRequest): Promise<MealPlan> {
    const days = normalizeDays(weekStart, input.days);
    const key = { userId_weekStart: { userId, weekStart: asDate(weekStart) } };
    const existing = await this.db.mealPlan.findUnique({ where: key, select: { stats: true } });
    const before = (existing?.stats ?? noStats()) as unknown as MealPlanStats;
    const stats: MealPlanStats = { ...before, ...input.stats, ...totals(days) };
    const data = {
      days: days as unknown as Prisma.InputJsonValue,
      shoppingList: (input.shoppingList ?? []) as unknown as Prisma.InputJsonValue,
      stats: stats as unknown as Prisma.InputJsonValue,
      isGenerated: input.isGenerated ?? false,
    };
    return toPlan(await this.db.mealPlan.upsert({ where: key, create: { userId, weekStart: asDate(weekStart), ...data }, update: data }));
  }

  /** Puts a meal in one slot, or clears it. Starts the week's plan if there is none yet. */
  setMeal(userId: string, weekStart: string, date: string, type: MealType, meal: PlannedMeal | null): Promise<MealPlan> {
    if (!weekDates(weekStart).includes(date)) throw errors.validation({ date: `${date} is not in the week starting ${weekStart}` });
    return this.edit(userId, weekStart, true, (plan) => {
      const days = (plan.days as unknown as MealPlanDay[]).map((d) => {
        if (d.date !== date) return d;
        const { [type]: _replaced, ...rest } = d;
        return meal ? { ...rest, [type]: meal } : rest;
      });
      return { days, stats: { ...(plan.stats as unknown as MealPlanStats), ...totals(days) } };
    });
  }

  setChecked(userId: string, weekStart: string, itemId: string, checked: boolean): Promise<MealPlan> {
    return this.edit(userId, weekStart, false, (plan) => {
      const list = plan.shoppingList as unknown as PlanShoppingItem[];
      if (!list.some((i) => i.id === itemId)) throw errors.notFound('Shopping item not found');
      return { shoppingList: list.map((i) => (i.id === itemId ? { ...i, checked } : i)) };
    });
  }

  async remove(userId: string, weekStart: string): Promise<void> {
    const { count } = await this.db.mealPlan.deleteMany({ where: { userId, weekStart: asDate(weekStart) } });
    if (count === 0) throw errors.notFound('Meal plan not found');
  }

  /**
   * Read-change-write on one plan with the row locked, so two edits arriving together (two meals dropped in at once)
   * both land instead of the second overwriting the first.
   */
  private edit(
    userId: string,
    weekStart: string,
    createIfMissing: boolean,
    change: (plan: PlanRow) => { days?: unknown; shoppingList?: unknown; stats?: unknown },
  ): Promise<MealPlan> {
    const date = asDate(weekStart);
    return this.db.$transaction(async (tx) => {
      if (createIfMissing) {
        const days = weekDates(weekStart).map((d) => ({ date: d }));
        await tx.mealPlan.createMany({
          data: [{ userId, weekStart: date, days: days as unknown as Prisma.InputJsonValue, stats: noStats() as unknown as Prisma.InputJsonValue }],
          skipDuplicates: true,
        });
      }
      await tx.$queryRaw`SELECT 1 FROM "MealPlan" WHERE "userId" = ${userId}::uuid AND "weekStart" = ${weekStart}::date FOR UPDATE`;
      const plan = await tx.mealPlan.findUnique({ where: { userId_weekStart: { userId, weekStart: date } } });
      if (!plan) throw errors.notFound('Meal plan not found');
      const changes = change(plan);
      return toPlan(
        await tx.mealPlan.update({
          where: { id: plan.id },
          data: {
            ...(changes.days !== undefined ? { days: changes.days as Prisma.InputJsonValue } : {}),
            ...(changes.shoppingList !== undefined ? { shoppingList: changes.shoppingList as Prisma.InputJsonValue } : {}),
            ...(changes.stats !== undefined ? { stats: changes.stats as Prisma.InputJsonValue } : {}),
          },
        }),
      );
    });
  }
}

/* ------------------------------------------------------------------ food waste */

/** Less waste than the month before is "improving". With nothing to compare against there is no trend to report. */
function trend(thisMonth: number, lastMonth: number): WasteStats['trendDirection'] {
  if (lastMonth === 0) return 'stable';
  if (thisMonth < lastMonth * (1 - TREND_THRESHOLD)) return 'improving';
  if (thisMonth > lastMonth * (1 + TREND_THRESHOLD)) return 'worsening';
  return 'stable';
}

type WasteRow = Prisma.WasteEntryGetPayload<object>;
const toEntry = (r: WasteRow): WasteEntry => ({
  id: r.id,
  itemName: r.itemName,
  amount: r.amount,
  unit: r.unit,
  reason: r.reason as WasteReason, // validated on the way in
  estimatedValue: r.estimatedValue,
  notes: r.notes,
  wastedAt: r.wastedAt.toISOString(),
});

export class WasteService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async log(userId: string, input: LogWasteRequest): Promise<WasteEntry> {
    const row = await this.db.wasteEntry.create({
      data: {
        userId,
        itemName: input.itemName,
        amount: input.amount,
        unit: input.unit,
        reason: input.reason,
        estimatedValue: input.estimatedValue,
        notes: input.notes ?? '',
        wastedAt: input.wastedAt ? new Date(input.wastedAt) : this.now(),
      },
    });
    return toEntry(row);
  }

  async list(userId: string, limit: number, cursor?: string): Promise<Page<WasteEntry>> {
    const rows = await this.db.wasteEntry.findMany({
      where: { userId },
      orderBy: [{ wastedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return { items: page.map(toEntry), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.db.wasteEntry.deleteMany({ where: { id, userId } });
    if (count === 0) throw errors.notFound('Entry not found');
  }

  /** Worked out from the log each time, so deleting an entry takes it out of the totals too. */
  async stats(userId: string): Promise<WasteStats> {
    const now = this.now();
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
    const twoMonthsAgo = new Date(now.getTime() - 60 * DAY_MS);
    const sum = async (where: Prisma.WasteEntryWhereInput) =>
      (await this.db.wasteEntry.aggregate({ where: { userId, ...where }, _sum: { estimatedValue: true }, _count: { _all: true } }));

    const [all, week, month, before, reasons, top, savings] = await Promise.all([
      sum({}),
      sum({ wastedAt: { gte: weekAgo } }),
      sum({ wastedAt: { gte: monthAgo } }),
      sum({ wastedAt: { gte: twoMonthsAgo, lt: monthAgo } }),
      this.db.wasteEntry.groupBy({ by: ['reason'], where: { userId }, _count: { _all: true } }),
      this.db.$queryRaw<{ name: string; count: bigint }[]>`
        SELECT min("itemName") AS name, count(*) AS count
        FROM "WasteEntry" WHERE "userId" = ${userId}::uuid
        GROUP BY lower("itemName") ORDER BY count(*) DESC, lower("itemName") ASC LIMIT 5`,
      this.db.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(("stats"->>'estimatedSavings')::float8), 0) AS total FROM "MealPlan" WHERE "userId" = ${userId}::uuid`,
    ]);

    const wasteByReason = Object.fromEntries(WASTE_REASONS.map((r) => [r, 0])) as Record<WasteReason, number>;
    for (const g of reasons) if (g.reason in wasteByReason) wasteByReason[g.reason as WasteReason] = g._count._all;

    const thisMonth = month._sum.estimatedValue ?? 0;
    const lastMonth = before._sum.estimatedValue ?? 0;
    const trendDirection = trend(thisMonth, lastMonth);

    return {
      totalWasted: all._sum.estimatedValue ?? 0,
      wastedThisWeek: week._sum.estimatedValue ?? 0,
      wastedThisMonth: thisMonth,
      itemsWastedThisMonth: month._count._all,
      topWastedItems: top.map((t) => ({ name: t.name, count: Number(t.count) })),
      wasteByReason,
      trendDirection,
      savedByPlanning: savings[0]?.total ?? 0,
    };
  }
}
