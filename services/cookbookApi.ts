// Curated cookbooks against the SousChef server. Used by cookbookStore when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type { Cookbook as ApiCookbook, CookbookSummary, Page, RecipeSummary, ToggleResponse } from '../shared/index';
import { api } from '@/lib/api';
import { toAppRecipe } from '@/services/recipeApi';
import type { Cookbook, Recipe } from '@/types';

type Source = ApiCookbook | CookbookSummary;

/**
 * The server's cookbook as the screens know it. The server sends how many recipes a cookbook has, not their ids, so
 * `recipeIds` is filled in when the recipes are loaded (a cookbook screen opens them straight away).
 */
export function toAppCookbook(c: Source, recipeIds: string[] = []): Cookbook {
  const updated = 'updatedAt' in c ? c.updatedAt : c.createdAt;
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    coverImageURL: c.coverImageUrl,
    recipeIds,
    ...(c.category ? { category: c.category } : {}),
    likes: c.likeCount,
    createdAt: Timestamp.fromDate(new Date(c.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(updated)),
  };
}

export async function apiListCookbooks(): Promise<Cookbook[]> {
  const page = await api().get<Page<CookbookSummary>>('/v1/cookbooks', { query: { limit: 20 } });
  return page.items.map((c) => toAppCookbook(c));
}

export async function apiCookbookRecipes(id: string): Promise<Recipe[]> {
  const out: RecipeSummary[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await api().get<Page<RecipeSummary>>(`/v1/cookbooks/${id}/recipes`, { query: { limit: 50, cursor } });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out.map(toAppRecipe);
}

/** The cookbook and its recipes together; null if it does not exist (or is not published). */
export async function apiCookbookWithRecipes(id: string): Promise<{ cookbook: Cookbook; recipes: Recipe[] } | null> {
  try {
    const [book, recipes] = await Promise.all([api().get<ApiCookbook>(`/v1/cookbooks/${id}`), apiCookbookRecipes(id)]);
    return { cookbook: toAppCookbook(book, recipes.map((r) => r.id)), recipes };
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

/** Returns the cookbook's new like count. */
export async function apiSetCookbookLiked(id: string, on: boolean): Promise<number> {
  const path = `/v1/cookbooks/${id}/like`;
  return (on ? await api().put<ToggleResponse>(path) : await api().delete<ToggleResponse>(path)).count;
}

export async function apiSetCookbookSaved(id: string, on: boolean): Promise<void> {
  const path = `/v1/cookbooks/${id}/save`;
  if (on) await api().put(path);
  else await api().delete(path);
}
