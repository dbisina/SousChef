import { z } from 'zod';
import {
  CUISINES,
  DIFFICULTIES,
  PANTRY_CATEGORIES,
  RECIPE_CATEGORIES,
  type AddShoppingItemsRequest,
  type AddWantToCookRequest,
  type BulkAddPantryRequest,
  type PantryItemInput,
  type UpdatePantryItemRequest,
  type UpdateShoppingItemRequest,
  type UpdateWantToCookRequest,
  type UsePantryItemRequest,
} from '@shared';

const text = (max: number) => z.string().trim().max(max);
const name = text(100).min(1, 'Enter a name');
const unit = text(30);
const amount = z.number().positive().max(100_000);
const webUrl = z.url({ protocol: /^https?$/ }).max(2048);
/** An ISO date ("2026-12-01") or date-time. */
const isoDate = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date');

/* ---- pantry ---- */

const pantryItem = z.object({
  name,
  amount,
  unit,
  category: z.enum(PANTRY_CATEGORIES),
  expiresAt: isoDate.optional(),
}) satisfies z.ZodType<PantryItemInput>;

export const pantryItemSchema = pantryItem;

export const bulkPantrySchema = z.object({
  items: z.array(pantryItem).min(1).max(50),
}) satisfies z.ZodType<BulkAddPantryRequest>;

export const updatePantrySchema = z
  .object({
    name: name.optional(),
    amount: amount.optional(),
    unit: unit.optional(),
    category: z.enum(PANTRY_CATEGORIES).optional(),
    expiresAt: isoDate.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdatePantryItemRequest>;

export const usePantrySchema = z.object({ amount }) satisfies z.ZodType<UsePantryItemRequest>;

export const pantryQuerySchema = z.object({
  category: z.enum(PANTRY_CATEGORIES).optional(),
  q: text(100).optional(),
  filter: z.enum(['expiring', 'expired']).optional(),
});

/* ---- want to cook ---- */

const importedRecipe = z.object({
  title: text(200).min(1),
  description: text(2000),
  imageUrl: webUrl.optional(),
  videoUrl: webUrl.optional(),
  sourceUrl: webUrl,
  sourcePlatform: text(40).optional(),
  ingredients: z
    .array(z.object({ name, amount: z.number().min(0).max(100_000), unit, optional: z.boolean().optional() }))
    .min(1)
    .max(80),
  instructions: z.array(text(2000).min(1)).max(80),
  servings: z.number().int().min(1).max(100),
  prepTime: z.number().int().min(0).max(24 * 60).optional(),
  cookTime: z.number().int().min(0).max(24 * 60).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  cuisine: z.enum(CUISINES).optional(),
  category: z.enum(RECIPE_CATEGORIES).optional(),
  tags: z.array(text(40).min(1)).max(20),
  extractionConfidence: z.number().min(0).max(1),
  stepClips: z.array(webUrl.nullable()).max(80).optional(),
});

export const addWantToCookSchema = z.union([
  z.object({ recipeId: z.uuid() }).strict(),
  z.object({ imported: importedRecipe }).strict(),
]) satisfies z.ZodType<AddWantToCookRequest>;

export const updateWantToCookSchema = z
  .object({
    status: z.enum(['saved', 'planned', 'shopping', 'cooked']).optional(),
    plannedFor: isoDate.nullable().optional(),
    notes: text(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateWantToCookRequest>;

export const wantToCookQuerySchema = z.object({
  status: z.enum(['saved', 'planned', 'shopping', 'cooked']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(100).optional(),
});

/* ---- shopping list ---- */

const shoppingItem = z.object({
  name,
  amount,
  unit,
  category: text(40).optional(),
  recipeId: z.uuid().optional(),
  recipeTitle: text(200).optional(),
});

export const addShoppingSchema = z.object({
  items: z.array(shoppingItem).min(1).max(50),
}) satisfies z.ZodType<AddShoppingItemsRequest>;

export const updateShoppingSchema = z
  .object({
    name: name.optional(),
    amount: amount.optional(),
    unit: unit.optional(),
    checked: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateShoppingItemRequest>;

export const clearShoppingQuery = z.object({
  checkedOnly: z.enum(['true', 'false']).transform((v) => v === 'true').default(false),
});

export const idParam = z.object({ id: z.uuid() });
