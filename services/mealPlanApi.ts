// Meal plans and the food-waste log against the SousChef server. Used by mealPlanService when EXPO_PUBLIC_API_URL is set.
// The server identifies a plan by its week (the Monday), so that is what the app's plan `id` is in this mode.
import { Timestamp } from '@/lib/firebase';
import type {
  LogWasteRequest,
  MealPlan,
  MealPlanDay as ApiDay,
  Page,
  PlannedMeal as ApiMeal,
  SaveMealPlanRequest,
  WasteEntry,
  WasteStats as ApiWasteStats,
} from '../shared/index';
import { api } from '@/lib/api';
import type { FoodWasteEntry, MealPlanDay, MealType, PlannedMeal, WasteEntryFormData, WasteStats, WeeklyMealPlan } from '@/types/mealplan';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const mealFromApi = (m: ApiMeal): PlannedMeal => ({ recipeId: m.recipeId, recipeName: m.recipeName, servings: m.servings, ...(m.imageUrl ? { imageURL: m.imageUrl } : {}) });
const mealToApi = (m: PlannedMeal): ApiMeal => ({ recipeId: m.recipeId, recipeName: m.recipeName, servings: m.servings, ...(m.imageURL ? { imageUrl: m.imageURL } : {}) });

function daysFromApi(days: ApiDay[]): MealPlanDay[] {
  return days.map((d) => {
    const out: MealPlanDay = { date: d.date };
    for (const t of MEAL_TYPES) if (d[t]) out[t] = mealFromApi(d[t] as ApiMeal);
    return out;
  });
}
function daysToApi(days: MealPlanDay[]): ApiDay[] {
  return days.map((d) => {
    const out: ApiDay = { date: d.date };
    for (const t of MEAL_TYPES) if (d[t]) out[t] = mealToApi(d[t] as PlannedMeal);
    return out;
  });
}

export function toAppPlan(p: MealPlan): WeeklyMealPlan {
  return {
    id: p.weekStart,
    userId: '',
    weekStartDate: p.weekStart,
    days: daysFromApi(p.days),
    shoppingList: p.shoppingList,
    stats: p.stats,
    createdAt: Timestamp.fromDate(new Date(p.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(p.updatedAt)),
    isGenerated: p.isGenerated,
  };
}

export function toAppWaste(w: WasteEntry): FoodWasteEntry {
  return {
    id: w.id,
    userId: '',
    itemName: w.itemName,
    amount: w.amount,
    unit: w.unit,
    reason: w.reason,
    date: Timestamp.fromDate(new Date(w.wastedAt)),
    estimatedValue: w.estimatedValue,
    ...(w.notes ? { notes: w.notes } : {}),
  };
}

const notFound = (err: unknown) => (err as { status?: number }).status === 404;

export async function apiCurrentPlan(): Promise<WeeklyMealPlan | null> {
  const res = await api().get<{ plan: MealPlan | null }>('/v1/me/meal-plans/current');
  return res.plan ? toAppPlan(res.plan) : null;
}

export async function apiPlanByWeek(weekStart: string): Promise<WeeklyMealPlan | null> {
  try {
    return toAppPlan(await api().get<MealPlan>(`/v1/me/meal-plans/${weekStart}`));
  } catch (err) {
    if (notFound(err)) return null;
    throw err;
  }
}

export async function apiPlans(): Promise<WeeklyMealPlan[]> {
  const res = await api().get<Page<MealPlan>>('/v1/me/meal-plans', { query: { limit: 52 } });
  return res.items.map(toAppPlan);
}

export async function apiSavePlan(plan: Pick<WeeklyMealPlan, 'weekStartDate' | 'days' | 'shoppingList' | 'stats' | 'isGenerated'>): Promise<WeeklyMealPlan> {
  const body: SaveMealPlanRequest = {
    days: daysToApi(plan.days),
    shoppingList: plan.shoppingList,
    stats: {
      pantryItemsUsed: plan.stats.pantryItemsUsed,
      expiringItemsUsed: plan.stats.expiringItemsUsed,
      ingredientOverlap: plan.stats.ingredientOverlap,
      estimatedSavings: plan.stats.estimatedSavings,
    },
    isGenerated: plan.isGenerated,
  };
  return toAppPlan(await api().put<MealPlan>(`/v1/me/meal-plans/${plan.weekStartDate}`, body));
}

export async function apiSetMeal(weekStart: string, date: string, mealType: MealType, meal: PlannedMeal | null): Promise<void> {
  const path = `/v1/me/meal-plans/${weekStart}/days/${date}/${mealType}`;
  if (meal) await api().put(path, mealToApi(meal));
  else await api().delete(path);
}

export async function apiDeletePlan(weekStart: string): Promise<void> {
  await api().delete(`/v1/me/meal-plans/${weekStart}`);
}

export async function apiCheckShoppingItem(weekStart: string, itemId: string, checked: boolean): Promise<void> {
  await api().put(`/v1/me/meal-plans/${weekStart}/shopping/${encodeURIComponent(itemId)}/checked`, { checked });
}

export async function apiLogWaste(data: WasteEntryFormData): Promise<FoodWasteEntry> {
  const body: LogWasteRequest = {
    itemName: data.itemName,
    amount: data.amount,
    unit: data.unit,
    reason: data.reason,
    estimatedValue: data.estimatedValue,
    ...(data.notes ? { notes: data.notes } : {}),
  };
  return toAppWaste(await api().post<WasteEntry>('/v1/me/waste', body));
}

export async function apiWasteLog(limit?: number): Promise<FoodWasteEntry[]> {
  const res = await api().get<Page<WasteEntry>>('/v1/me/waste', { query: { limit: Math.min(100, Math.max(1, limit ?? 100)) } });
  return res.items.map(toAppWaste);
}

export async function apiDeleteWaste(id: string): Promise<void> {
  await api().delete(`/v1/me/waste/${id}`);
}

export async function apiWasteStats(): Promise<WasteStats> {
  return api().get<ApiWasteStats>('/v1/me/waste/stats');
}
