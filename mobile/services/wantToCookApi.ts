// "Want to cook", the shopping list and link import against the SousChef server.
// Used by wantToCookStore and recipeImportService when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type {
  AddShoppingItemsRequest,
  AddWantToCookRequest,
  ImportedRecipe as ApiImported,
  ImportResult,
  ShoppingItem,
  UpdateWantToCookRequest,
  WantToCookItem as ApiItem,
} from '@shared/index';
import { api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import type { Ingredient, Recipe } from '@/types';
import type { ImportedRecipe, QuickShoppingItem, URLExtractionResponse, WantToCookItem, WantToCookStatus } from '@/types/wantToCook';

/* ---------------------------------------------------------------- mapping */

const ingredientFromApi = (i: ApiImported['ingredients'][number]): Ingredient => ({ name: i.name, amount: i.amount, unit: i.unit, calories: 0, optional: i.optional ?? false });

export function importedFromApi(r: ApiImported, id: string): ImportedRecipe {
  return {
    id,
    title: r.title,
    description: r.description,
    ...(r.imageUrl ? { imageURL: r.imageUrl } : {}),
    ...(r.videoUrl ? { videoURL: r.videoUrl } : {}),
    sourceURL: r.sourceUrl,
    ...(r.sourcePlatform ? { sourcePlatform: r.sourcePlatform } : {}),
    ingredients: r.ingredients.map(ingredientFromApi),
    instructions: r.instructions,
    servings: r.servings,
    ...(r.prepTime !== undefined ? { prepTime: r.prepTime } : {}),
    ...(r.cookTime !== undefined ? { cookTime: r.cookTime } : {}),
    ...(r.difficulty ? { difficulty: r.difficulty } : {}),
    ...(r.cuisine ? { cuisine: r.cuisine } : {}),
    ...(r.category ? { category: r.category } : {}),
    tags: r.tags,
    extractedAt: Timestamp.now(),
    extractionConfidence: r.extractionConfidence,
  };
}

export function importedToApi(r: ImportedRecipe): ApiImported {
  return {
    title: r.title,
    description: r.description,
    ...(r.imageURL ? { imageUrl: r.imageURL } : {}),
    ...(r.videoURL ? { videoUrl: r.videoURL } : {}),
    sourceUrl: r.sourceURL,
    ...(r.sourcePlatform ? { sourcePlatform: r.sourcePlatform } : {}),
    ingredients: r.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, ...(i.optional ? { optional: true } : {}) })),
    instructions: r.instructions,
    servings: r.servings,
    ...(r.prepTime !== undefined ? { prepTime: r.prepTime } : {}),
    ...(r.cookTime !== undefined ? { cookTime: r.cookTime } : {}),
    ...(r.difficulty ? { difficulty: r.difficulty } : {}),
    ...(r.cuisine ? { cuisine: r.cuisine } : {}),
    ...(r.category ? { category: r.category } : {}),
    tags: r.tags,
    extractionConfidence: r.extractionConfidence,
  };
}

export function toAppItem(w: ApiItem): WantToCookItem {
  return {
    id: w.id,
    ownerId: '',
    ...(w.recipe ? { recipeId: w.recipe.id } : {}),
    ...(w.imported ? { importedRecipe: importedFromApi(w.imported, w.id) } : {}),
    status: w.status,
    savedAt: Timestamp.fromDate(new Date(w.savedAt)),
    ...(w.plannedFor ? { plannedFor: Timestamp.fromDate(new Date(w.plannedFor)) } : {}),
    ...(w.cookedAt ? { cookedAt: Timestamp.fromDate(new Date(w.cookedAt)) } : {}),
    pantryMatchPercent: w.pantryMatch.matchPercent,
    matchingIngredients: w.pantryMatch.matching,
    missingIngredients: w.pantryMatch.missing,
    ...(w.notes ? { notes: w.notes } : {}),
    addedToShoppingList: false,
  };
}

export function toAppShoppingItem(s: ShoppingItem): QuickShoppingItem {
  return {
    id: s.id,
    name: s.name,
    amount: s.amount,
    unit: s.unit,
    ...(s.category ? { category: s.category } : {}),
    checked: s.checked,
    ...(s.recipeId ? { recipeId: s.recipeId } : {}),
    ...(s.recipeTitle ? { recipeName: s.recipeTitle } : {}),
    addedAt: Timestamp.fromDate(new Date(s.createdAt)),
  };
}

/* ---------------------------------------------------------------- want to cook */

export async function apiListWantToCook(): Promise<WantToCookItem[]> {
  const res = await api().get<{ items: ApiItem[] }>('/v1/me/want-to-cook');
  return res.items.map(toAppItem);
}

export async function apiAddWantToCook(recipe: Recipe | ImportedRecipe, isImported: boolean): Promise<WantToCookItem> {
  const body: AddWantToCookRequest = isImported ? { imported: importedToApi(recipe as ImportedRecipe) } : { recipeId: (recipe as Recipe).id };
  return toAppItem(await api().post<ApiItem>('/v1/me/want-to-cook', body));
}

export async function apiUpdateWantToCook(id: string, status: WantToCookStatus): Promise<WantToCookItem> {
  const body: UpdateWantToCookRequest = { status };
  return toAppItem(await api().patch<ApiItem>(`/v1/me/want-to-cook/${id}`, body));
}

export async function apiRemoveWantToCook(id: string): Promise<void> {
  await api().delete(`/v1/me/want-to-cook/${id}`);
}

/* ---------------------------------------------------------------- shopping list */

export async function apiShoppingList(): Promise<QuickShoppingItem[]> {
  const res = await api().get<{ items: ShoppingItem[] }>('/v1/me/shopping-list');
  return res.items.map(toAppShoppingItem);
}

export async function apiAddShopping(items: Array<{ name: string; amount: number; unit: string; recipeId?: string; recipeName?: string }>): Promise<QuickShoppingItem[]> {
  const body: AddShoppingItemsRequest = {
    items: items.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, ...(i.recipeId ? { recipeId: i.recipeId } : {}), ...(i.recipeName ? { recipeTitle: i.recipeName } : {}) })),
  };
  const res = await api().post<{ items: ShoppingItem[] }>('/v1/me/shopping-list', body);
  return res.items.map(toAppShoppingItem);
}

export async function apiCheckShopping(id: string, checked: boolean): Promise<void> {
  await api().patch(`/v1/me/shopping-list/${id}`, { checked });
}

export async function apiRemoveShopping(id: string): Promise<void> {
  await api().delete(`/v1/me/shopping-list/${id}`);
}

export async function apiClearShopping(checkedOnly: boolean): Promise<void> {
  await api().delete('/v1/me/shopping-list', { query: { checkedOnly } });
}

/* ---------------------------------------------------------------- link import */

/**
 * "I want to cook ...": the server searches the web for a real recipe page and imports it (or, with no search available,
 * has the model write a standard version and says so in `message`). Null when nothing usable came back.
 */
export async function apiSearchRecipe(query: string, onProgress?: (message: string) => void): Promise<(URLExtractionResponse & { note?: string }) | null> {
  onProgress?.('Searching the web for a recipe...');
  const result = await api().post<ImportResult>('/v1/imports/search', { query }, { timeoutMs: 90_000 });
  if (result.status !== 'done' || !result.recipe) return null;
  return { success: true, recipe: importedFromApi(result.recipe, result.id), confidence: result.recipe.extractionConfidence, ...(result.message ? { note: result.message } : {}) };
}

/**
 * Reads a recipe from a link on the server (caption, page data, then AI). Null when the server cannot read it from the
 * link alone (a video whose caption has no recipe), so the caller can fall back to the on-device reader.
 */
export async function apiExtractFromUrl(
  url: string,
  onProgress?: (message: string) => void,
  /** Asks the person for screenshots of the video (addresses on the phone) when its caption holds no recipe. */
  askFrames?: () => Promise<string[] | null>,
): Promise<URLExtractionResponse | null> {
  onProgress?.('Reading the link...');
  let result = await api().post<ImportResult>('/v1/imports', { url }, { timeoutMs: 60_000 });
  if (result.status === 'needs_frames' && askFrames) {
    const uris = await askFrames();
    if (uris && uris.length > 0) {
      onProgress?.('Reading the screenshots...');
      const uploadIds: string[] = [];
      for (const uri of uris) uploadIds.push((await uploadFile(uri, 'import_frame')).id);
      result = await api().post<ImportResult>(`/v1/imports/${result.id}/frames`, { uploadIds }, { timeoutMs: 90_000 });
    }
  }
  if (result.status !== 'done' || !result.recipe) return null;
  return { success: true, recipe: importedFromApi(result.recipe, result.id), confidence: result.recipe.extractionConfidence };
}
