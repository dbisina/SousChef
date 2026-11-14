import type {
  Cuisine,
  Difficulty,
  MadePost,
  NutritionInfo,
  Recipe,
  RecipeAuthor,
  RecipeCategory,
  RecipeComment,
  RecipeIngredient,
  RecipeStatus,
  RecipeSummary,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';

export const authorSelect = {
  id: true,
  handle: true,
  displayName: true,
  photoUrl: true,
  isChef: true,
  verifiedChefAt: true,
  kind: true,
} satisfies Prisma.UserSelect;

export const withAuthor = { author: { select: authorSelect } } satisfies Prisma.RecipeInclude;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;
export type RecipeRow = Prisma.RecipeGetPayload<{ include: typeof withAuthor }>;

export const toAuthor = (u: AuthorRow): RecipeAuthor => ({
  id: u.id,
  handle: u.handle,
  displayName: u.displayName,
  photoUrl: u.photoUrl,
  isChef: u.isChef,
  isVerifiedChef: u.verifiedChefAt !== null,
  kind: u.kind === 'HOUSE' ? 'house' : 'person',
});

const statusOut = (s: RecipeRow['status']): RecipeStatus => (s === 'DRAFT' ? 'draft' : s === 'FLAGGED' ? 'flagged' : 'published');

/** One decimal place, or null when nobody has rated it. */
export const averageRating = (sum: number, count: number): number | null =>
  count === 0 ? null : Math.round((sum / count) * 10) / 10;

export function toSummary(r: RecipeRow): RecipeSummary {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.imageUrl,
    author: toAuthor(r.author),
    isOfficial: r.isOfficial,
    isExclusive: r.isExclusive,
    // The columns are plain strings in the database; the API schemas only let valid values in.
    category: r.category as RecipeCategory,
    cuisine: r.cuisine as Cuisine,
    difficulty: r.difficulty as Difficulty,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    caloriesPerServing: r.caloriesPerServing,
    tags: r.tags,
    dietaryFlags: r.dietaryFlags,
    allergens: r.allergens,
    likeCount: r.likeCount,
    saveCount: r.saveCount,
    commentCount: r.commentCount,
    rating: averageRating(r.ratingSum, r.ratingCount),
    ratingCount: r.ratingCount,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toRecipe(r: RecipeRow, viewer: Recipe['viewer']): Recipe {
  return {
    ...toSummary(r),
    status: statusOut(r.status),
    youtubeUrl: r.youtubeUrl,
    // JSON columns written only by this service from validated input.
    ingredients: r.ingredients as unknown as RecipeIngredient[],
    instructions: r.instructions as unknown as string[],
    nutrition: r.nutrition as unknown as NutritionInfo,
    updatedAt: r.updatedAt.toISOString(),
    viewer,
  };
}

export const toComment = (c: { id: string; recipeId: string; text: string; createdAt: Date; author: AuthorRow }): RecipeComment => ({
  id: c.id,
  recipeId: c.recipeId,
  author: toAuthor(c.author),
  text: c.text,
  createdAt: c.createdAt.toISOString(),
});

export const toMadePost = (p: {
  id: string;
  recipeId: string;
  imageUrl: string;
  caption: string;
  createdAt: Date;
  author: AuthorRow;
}): MadePost => ({
  id: p.id,
  recipeId: p.recipeId,
  author: toAuthor(p.author),
  imageUrl: p.imageUrl,
  caption: p.caption,
  createdAt: p.createdAt.toISOString(),
});
