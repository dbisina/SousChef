// Recipes against the enplace server. Used by recipeService when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type {
  CreateRecipeRequest,
  Page,
  MadePost,
  Post as ApiPost,
  Recipe as ApiRecipe,
  RecipeComment as ApiRecipeComment,
  RateRecipeResponse,
  RecipeMatch,
  RecipeSummary,
  BecauseYouCooked as ApiBecauseYouCooked,
  SimilarRecipes,
  ToggleResponse,
  UpdateRecipeRequest,
} from '@shared/index';
import { api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import type { Recipe, RecipeComment, RecipeFilters, RecipeFormData, RecipeMadePost } from '@/types';

const PAGE = 50;
/** The app's lists show everything at once; the server pages, so gather a few pages (200 recipes) at most. */
const MAX_PAGES = 4;

type Source = ApiRecipe | RecipeSummary;
const isFull = (r: Source): r is ApiRecipe => 'ingredients' in r;

/** The server's recipe as the screens already know it. A list entry has no steps or ingredients; those arrive when it is opened. */
export function toAppRecipe(r: Source): Recipe {
  const full = isFull(r) ? r : null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    imageURL: r.imageUrl,
    ...(full?.youtubeUrl ? { youtubeURL: full.youtubeUrl } : {}),
    authorId: r.author.id,
    authorName: r.author.displayName,
    ...(r.author.photoUrl ? { authorPhotoURL: r.author.photoUrl } : {}),
    isOfficial: r.isOfficial,
    isExclusive: r.isExclusive,
    ...(full ? { status: full.status } : {}),
    category: r.category,
    cuisine: r.cuisine,
    difficulty: r.difficulty,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    ingredients: full?.ingredients ?? [],
    instructions: full?.instructions ?? [],
    nutrition: full?.nutrition ?? {
      caloriesPerServing: r.caloriesPerServing,
      totalCalories: r.caloriesPerServing * r.servings,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    },
    tags: r.tags,
    dietaryFlags: r.dietaryFlags,
    allergens: r.allergens,
    likes: r.likeCount,
    saveCount: r.saveCount,
    ...(r.rating !== null ? { rating: r.rating } : {}),
    ratingCount: r.ratingCount,
    commentCount: r.commentCount,
    createdAt: Timestamp.fromDate(new Date(r.createdAt)),
    ...(full ? { updatedAt: Timestamp.fromDate(new Date(full.updatedAt)) } : {}),
  };
}

/** The app's form as the server's create request. Calories and nutrition are worked out on the server. */
export function toCreateRequest(data: RecipeFormData, imageUrl: string, isOfficial: boolean): CreateRecipeRequest {
  return {
    title: data.title,
    description: data.description,
    imageUrl,
    ...(data.youtubeURL ? { youtubeUrl: data.youtubeURL } : {}),
    category: data.category,
    cuisine: data.cuisine,
    difficulty: data.difficulty,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    servings: data.servings,
    ingredients: data.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, optional: i.optional })),
    instructions: data.instructions,
    tags: data.tags,
    ...(isOfficial ? { isOfficial: true } : {}),
  };
}

/** A picture already on the web (an edit that kept the old photo) is used as it is; a local file is uploaded first. */
const isRemote = (uri: string) => /^https?:\/\//i.test(uri);
async function imageAddress(uri: string): Promise<string> {
  return isRemote(uri) ? uri : (await uploadFile(uri, 'recipe_image')).url;
}

async function allPages(path: string, query: Record<string, string | number | boolean | undefined>): Promise<RecipeSummary[]> {
  const items: RecipeSummary[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await api().get<Page<RecipeSummary>>(path, { query: { ...query, limit: PAGE, cursor } });
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}

export async function apiCreateRecipe(data: RecipeFormData, imageUri: string, isOfficial: boolean): Promise<string> {
  const created = await api().post<ApiRecipe>('/v1/recipes', toCreateRequest(data, await imageAddress(imageUri), isOfficial));
  return created.id;
}

export async function apiGetRecipe(id: string): Promise<Recipe | null> {
  try {
    return toAppRecipe(await api().get<ApiRecipe>(`/v1/recipes/${id}`));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function apiGetRecipes(filters?: RecipeFilters): Promise<Recipe[]> {
  const items = await allPages('/v1/recipes', {
    ...(filters?.category ? { category: filters.category } : {}),
    ...(filters?.cuisine ? { cuisine: filters.cuisine } : {}),
    ...(filters?.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters?.isOfficial !== undefined ? { isOfficial: filters.isOfficial } : {}),
    ...(filters?.maxCalories !== undefined ? { maxCalories: filters.maxCalories } : {}),
    ...(filters?.maxPrepTime !== undefined ? { maxPrepTime: filters.maxPrepTime } : {}),
    ...(filters?.searchQuery ? { q: filters.searchQuery } : {}),
    ...(filters?.dietaryFlags?.length ? { dietaryFlags: filters.dietaryFlags.join(',') } : {}),
    ...(filters?.excludeAllergens?.length ? { excludeAllergens: filters.excludeAllergens.join(',') } : {}),
  });
  return items.map(toAppRecipe);
}

export async function apiGetRecipesByUser(userId: string): Promise<Recipe[]> {
  return (await allPages('/v1/recipes', { authorId: userId })).map(toAppRecipe);
}

export async function apiGetPopularRecipes(count: number): Promise<Recipe[]> {
  const page = await api().get<Page<RecipeSummary>>('/v1/recipes', { query: { sort: 'popular', limit: Math.min(PAGE, Math.max(1, count)) } });
  return page.items.map(toAppRecipe);
}

export async function apiUpdateRecipe(id: string, data: Partial<RecipeFormData>, newImageUri?: string): Promise<void> {
  const body: UpdateRecipeRequest = {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...('youtubeURL' in data ? { youtubeUrl: data.youtubeURL || null } : {}),
    ...(data.category ? { category: data.category } : {}),
    ...(data.cuisine ? { cuisine: data.cuisine } : {}),
    ...(data.difficulty ? { difficulty: data.difficulty } : {}),
    ...(data.prepTime !== undefined ? { prepTime: data.prepTime } : {}),
    ...(data.cookTime !== undefined ? { cookTime: data.cookTime } : {}),
    ...(data.servings !== undefined ? { servings: data.servings } : {}),
    ...(data.ingredients ? { ingredients: data.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, optional: i.optional })) } : {}),
    ...(data.instructions ? { instructions: data.instructions } : {}),
    ...(data.tags ? { tags: data.tags } : {}),
    ...(newImageUri ? { imageUrl: await imageAddress(newImageUri) } : {}),
  };
  await api().patch(`/v1/recipes/${id}`, body);
}

export async function apiDeleteRecipe(id: string): Promise<void> {
  await api().delete(`/v1/recipes/${id}`);
}

export async function apiSearchRecipes(text: string): Promise<Recipe[]> {
  return apiGetRecipes({ searchQuery: text });
}

/** Recipes ranked by how much of them the person already has. The score is the server's percentage. */
export async function apiRecipesByIngredients(names: string[]): Promise<{ recipe: Recipe; matchScore: number }[]> {
  if (names.length === 0) return [];
  const res = await api().post<{ items: RecipeMatch[] }>('/v1/recipes/match', { ingredients: names.slice(0, 100), limit: 50 });
  return res.items.map((m) => ({ recipe: toAppRecipe(m.recipe), matchScore: m.matchPercent }));
}

/* ---------------------------------------------------------------- "I made this" photos */

export function toAppMadePost(p: MadePost): RecipeMadePost {
  return {
    id: p.id,
    recipeId: p.recipeId,
    authorId: p.author.id,
    authorName: p.author.displayName,
    ...(p.author.photoUrl ? { authorPhotoURL: p.author.photoUrl } : {}),
    imageURL: p.imageUrl,
    ...(p.caption ? { caption: p.caption } : {}),
    likes: 0,
    createdAt: Timestamp.fromDate(new Date(p.createdAt)),
  };
}

/** A post that carries the recipe (shared from the cook screen) shown as one of the recipe's "I made this" photos. */
export function postToMadePost(p: ApiPost): RecipeMadePost {
  return {
    id: p.id,
    recipeId: p.recipeId ?? '',
    authorId: p.author.id,
    authorName: p.author.displayName,
    ...(p.author.photoUrl ? { authorPhotoURL: p.author.photoUrl } : {}),
    imageURL: p.photoUrl,
    ...(p.caption ? { caption: p.caption } : {}),
    likes: p.likeCount,
    createdAt: Timestamp.fromDate(new Date(p.createdAt)),
  };
}

/** Photos people added to the recipe plus the posts they shared after cooking it, newest first. */
export async function apiMadePosts(recipeId: string): Promise<RecipeMadePost[]> {
  const [made, cooked] = await Promise.all([
    api().get<Page<MadePost>>(`/v1/recipes/${recipeId}/made`, { query: { limit: 20 } }),
    api().get<Page<ApiPost>>(`/v1/recipes/${recipeId}/cooked`, { query: { limit: 20 } }).catch(() => ({ items: [] as ApiPost[] })),
  ]);
  return [...made.items.map(toAppMadePost), ...cooked.items.map(postToMadePost)].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

/** Uploads the photo from the phone, then adds it to the recipe's "I made this" photos. */
export async function apiAddMadePost(recipeId: string, photoUri: string): Promise<RecipeMadePost> {
  const file = await uploadFile(photoUri, 'made_post');
  return toAppMadePost(await api().post<MadePost>(`/v1/recipes/${recipeId}/made`, { imageUrl: file.url }));
}

/* ---------------------------------------------------------------- likes, saves, ratings, comments, reports */

export const apiSetRecipeLiked = (id: string, on: boolean): Promise<ToggleResponse> =>
  on ? api().put<ToggleResponse>(`/v1/recipes/${id}/like`) : api().delete<ToggleResponse>(`/v1/recipes/${id}/like`);

export const apiSetRecipeSaved = (id: string, on: boolean): Promise<ToggleResponse> =>
  on ? api().put<ToggleResponse>(`/v1/recipes/${id}/save`) : api().delete<ToggleResponse>(`/v1/recipes/${id}/save`);

export const apiRateRecipe = (id: string, rating: number, review?: string): Promise<RateRecipeResponse> =>
  api().put<RateRecipeResponse>(`/v1/recipes/${id}/rating`, { rating, ...(review ? { review } : {}) });

export async function apiRecipeComments(id: string): Promise<RecipeComment[]> {
  const page = await api().get<Page<ApiRecipeComment>>(`/v1/recipes/${id}/comments`, { query: { limit: 50 } });
  return page.items.map((c) => ({
    id: c.id,
    recipeId: c.recipeId,
    authorId: c.author.id,
    authorName: c.author.displayName,
    ...(c.author.photoUrl ? { authorPhotoURL: c.author.photoUrl } : {}),
    text: c.text,
    likes: 0,
    createdAt: Timestamp.fromDate(new Date(c.createdAt)),
  }));
}

export const apiAddRecipeComment = (id: string, text: string): Promise<ApiRecipeComment> => api().post<ApiRecipeComment>(`/v1/recipes/${id}/comments`, { text });

export const apiFlagRecipe = (id: string, reason: string): Promise<void> => api().post<unknown>(`/v1/recipes/${id}/flag`, { reason }).then(() => undefined);

/* ---------------------------------------------------------------- recommendations */

/** Dishes made of similar things, for the recipe being looked at. */
export async function apiSimilarRecipes(recipeId: string, limit = 8): Promise<Recipe[]> {
  const res = await api().get<SimilarRecipes>(`/v1/recipes/${recipeId}/similar`, { query: { limit } });
  return res.items.map(toAppRecipe);
}

/** Dishes like the one this person cooked or saved last (`basedOn` null until they have). */
export async function apiBecauseYouCooked(limit = 8): Promise<{ basedOn: { id: string; title: string } | null; items: Recipe[] }> {
  const res = await api().get<ApiBecauseYouCooked>('/v1/feed/because-you-cooked', { query: { limit } });
  return { basedOn: res.basedOn, items: res.items.map(toAppRecipe) };
}
