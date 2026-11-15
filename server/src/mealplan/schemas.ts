import { z } from 'zod';
import {
  MEAL_TYPES,
  SHOPPING_CATEGORIES,
  WASTE_REASONS,
  isIsoDay,
  isMonday,
  type LogWasteRequest,
  type SaveMealPlanRequest,
  type UpdateShoppingCheckRequest,
} from '@shared';

const text = (max: number) => z.string().trim().max(max);
const webUrl = z.url({ protocol: /^https?$/ }).max(2048);
const day = z.string().refine(isIsoDay, 'Use a date like 2026-11-16');

export const weekStartParam = z.object({
  weekStart: z.string().refine(isMonday, 'A week starts on a Monday, written like 2026-11-16'),
});
export const planMealParams = z.object({
  weekStart: weekStartParam.shape.weekStart,
  date: day,
  mealType: z.enum(MEAL_TYPES),
});
export const planShoppingParams = z.object({
  weekStart: weekStartParam.shape.weekStart,
  itemId: text(64).min(1),
});

export const plannedMealSchema = z.object({
  recipeId: z.uuid(),
  recipeName: text(200).min(1),
  servings: z.number().int().min(1).max(50),
  imageUrl: webUrl.optional(),
});

const planDay = z.object({
  date: day,
  breakfast: plannedMealSchema.optional(),
  lunch: plannedMealSchema.optional(),
  dinner: plannedMealSchema.optional(),
  snack: plannedMealSchema.optional(),
});

const shoppingItem = z.object({
  id: text(64).min(1),
  name: text(100).min(1),
  amount: z.number().min(0).max(100_000),
  unit: text(30),
  category: z.enum(SHOPPING_CATEGORIES),
  recipes: z.array(text(64)).max(50),
  recipeNames: z.array(text(200)).max(50),
  inPantry: z.boolean(),
  pantryAmount: z.number().min(0).max(100_000),
  toBuy: z.number().min(0).max(100_000),
  checked: z.boolean(),
});

const count = z.number().min(0).max(1_000_000);

export const saveMealPlanSchema = z.object({
  days: z.array(planDay).max(7),
  shoppingList: z.array(shoppingItem).max(200).optional(),
  stats: z
    .object({
      pantryItemsUsed: count.optional(),
      expiringItemsUsed: count.optional(),
      ingredientOverlap: z.number().min(0).max(100).optional(),
      estimatedSavings: count.optional(),
    })
    .optional(),
  isGenerated: z.boolean().optional(),
}) satisfies z.ZodType<SaveMealPlanRequest>;

export const shoppingCheckSchema = z.object({ checked: z.boolean() }) satisfies z.ZodType<UpdateShoppingCheckRequest>;

export const planListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(52).default(12),
  cursor: z.string().refine(isIsoDay, 'Not a valid cursor').optional(),
});

/* ---- waste ---- */

export const logWasteSchema = z.object({
  itemName: text(100).min(1, 'Enter a name'),
  amount: z.number().positive().max(100_000),
  unit: text(30),
  reason: z.enum(WASTE_REASONS),
  estimatedValue: z.number().min(0).max(1_000_000),
  notes: text(500).optional(),
  wastedAt: z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date').optional(),
}) satisfies z.ZodType<LogWasteRequest>;

export const wasteListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(100).optional(),
});

export const idParam = z.object({ id: z.uuid() });
