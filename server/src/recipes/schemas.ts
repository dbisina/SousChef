import { z } from 'zod';
import {
  CUISINES,
  DIFFICULTIES,
  RECIPE_CATEGORIES,
  type CreateCommentRequest,
  type CreateMadePostRequest,
  type CreateRecipeRequest,
  type FlagRecipeRequest,
  type MatchRecipesRequest,
  type RateRecipeRequest,
  type UpdateRecipeRequest,
} from '@shared';

// Each request schema is declared against the shared type, so changing one without the other fails the build.

const text = (max: number) => z.string().trim().max(max);
const shortList = (max: number) => z.array(text(40).min(1)).max(max);
const url = z.url({ protocol: /^https?$/ }).max(2048);

const ingredient = z.object({
  name: text(100).min(1, 'Name the ingredient'),
  amount: z.number().positive().max(100_000),
  unit: text(30),
  optional: z.boolean().optional(),
});

const base = {
  title: text(120).min(2, 'Give the recipe a title'),
  description: text(2000),
  imageUrl: url,
  category: z.enum(RECIPE_CATEGORIES),
  cuisine: z.enum(CUISINES),
  difficulty: z.enum(DIFFICULTIES),
  prepTime: z.number().int().min(0).max(24 * 60),
  cookTime: z.number().int().min(0).max(24 * 60),
  servings: z.number().int().min(1).max(100),
  ingredients: z.array(ingredient).min(1, 'Add at least one ingredient').max(80),
  instructions: z.array(text(2000).min(1)).min(1, 'Add at least one step').max(80),
  tags: shortList(20).optional(),
  dietaryFlags: shortList(20).optional(),
  allergens: shortList(20).optional(),
  status: z.enum(['draft', 'published']).optional(),
  isOfficial: z.boolean().optional(),
  isExclusive: z.boolean().optional(),
};

export const createRecipeSchema = z.object({
  ...base,
  youtubeUrl: url.optional(),
}) satisfies z.ZodType<CreateRecipeRequest>;

export const updateRecipeSchema = z
  .object({
    title: base.title.optional(),
    description: base.description.optional(),
    imageUrl: base.imageUrl.optional(),
    category: base.category.optional(),
    cuisine: base.cuisine.optional(),
    difficulty: base.difficulty.optional(),
    prepTime: base.prepTime.optional(),
    cookTime: base.cookTime.optional(),
    servings: base.servings.optional(),
    ingredients: base.ingredients.optional(),
    instructions: base.instructions.optional(),
    tags: base.tags,
    dietaryFlags: base.dietaryFlags,
    allergens: base.allergens,
    status: base.status,
    isOfficial: base.isOfficial,
    isExclusive: base.isExclusive,
    youtubeUrl: url.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateRecipeRequest>;

const limit = z.coerce.number().int().min(1).max(50).default(20);
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const csv = z
  .string()
  .max(400)
  .transform((v) => v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 20));

/** Query string of GET /v1/recipes. */
export const listRecipesSchema = z.object({
  q: text(100).optional(),
  category: z.enum(RECIPE_CATEGORIES).optional(),
  cuisine: z.enum(CUISINES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  isOfficial: bool.optional(),
  authorId: z.uuid().optional(),
  maxPrepTime: z.coerce.number().int().min(0).max(24 * 60).optional(),
  maxCalories: z.coerce.number().int().min(0).max(10_000).optional(),
  dietaryFlags: csv.optional(),
  excludeAllergens: csv.optional(),
  sort: z.enum(['new', 'popular']).default('new'),
  limit,
  cursor: z.string().max(100).optional(),
});

export const pageSchema = z.object({ limit, cursor: z.string().max(100).optional() });

export const matchSchema = z.object({
  ingredients: z.array(text(100).min(1)).min(1).max(100),
  limit: z.number().int().min(1).max(50).optional(),
}) satisfies z.ZodType<MatchRecipesRequest>;

export const commentSchema = z.object({
  text: text(1000).min(1, 'Write something'),
}) satisfies z.ZodType<CreateCommentRequest>;

export const rateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: text(1000).optional(),
}) satisfies z.ZodType<RateRecipeRequest>;

export const madePostSchema = z.object({
  imageUrl: url,
  caption: text(500).optional(),
}) satisfies z.ZodType<CreateMadePostRequest>;

export const flagSchema = z.object({
  reason: text(500).min(3, 'Say what is wrong'),
}) satisfies z.ZodType<FlagRecipeRequest>;

export const idParam = z.object({ id: z.uuid() });
export const commentParams = z.object({ id: z.uuid(), commentId: z.uuid() });
