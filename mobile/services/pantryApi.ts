// The pantry against the enplace server. Used by pantryService and pantryStore when EXPO_PUBLIC_API_URL is set.
import { Timestamp } from '@/lib/firebase';
import type { BulkAddPantryRequest, PantryFilter, PantryItem as ApiPantryItem, PantryItemInput, PantrySummary, UpdatePantryItemRequest } from '@shared/index';
import { api } from '@/lib/api';
import type { PantryCategory, PantryItem, PantryItemFormData } from '@/types';

export function toAppPantryItem(p: ApiPantryItem): PantryItem {
  return {
    id: p.id,
    name: p.name,
    amount: p.amount,
    unit: p.unit,
    category: p.category,
    ...(p.expiresAt ? { expiryDate: Timestamp.fromDate(new Date(p.expiresAt)) } : {}),
    addedAt: Timestamp.fromDate(new Date(p.createdAt)),
  };
}

const toInput = (d: PantryItemFormData): PantryItemInput => ({
  name: d.name,
  amount: d.amount,
  unit: d.unit,
  category: d.category,
  ...(d.expiryDate ? { expiresAt: d.expiryDate.toISOString() } : {}),
});

/** The app's partial update (its own field names, possibly a Firestore timestamp) as the server's. */
function toUpdate(data: Partial<PantryItemFormData> | Partial<PantryItem>): UpdatePantryItemRequest {
  const d = data as Partial<PantryItemFormData> & Partial<PantryItem>;
  const raw = d.expiryDate as Date | { toDate(): Date } | undefined;
  const expiry = raw instanceof Date ? raw : raw?.toDate();
  return {
    ...(d.name !== undefined ? { name: d.name } : {}),
    ...(d.amount !== undefined ? { amount: d.amount } : {}),
    ...(d.unit !== undefined ? { unit: d.unit } : {}),
    ...(d.category !== undefined ? { category: d.category } : {}),
    ...(expiry ? { expiresAt: expiry.toISOString() } : {}),
  };
}

export async function apiListPantry(query?: { category?: PantryCategory; q?: string; filter?: PantryFilter }): Promise<PantryItem[]> {
  const res = await api().get<{ items: ApiPantryItem[] }>('/v1/me/pantry', { query });
  return res.items.map(toAppPantryItem);
}

export async function apiAddPantryItem(data: PantryItemFormData): Promise<PantryItem> {
  return toAppPantryItem(await api().post<ApiPantryItem>('/v1/me/pantry', toInput(data)));
}

export async function apiBulkAddPantry(items: PantryItemFormData[]): Promise<PantryItem[]> {
  if (items.length === 0) return [];
  const body: BulkAddPantryRequest = { items: items.map(toInput) };
  const res = await api().post<{ items: ApiPantryItem[] }>('/v1/me/pantry/bulk', body);
  return res.items.map(toAppPantryItem);
}

export async function apiUpdatePantryItem(id: string, data: Partial<PantryItemFormData> | Partial<PantryItem>): Promise<PantryItem> {
  return toAppPantryItem(await api().patch<ApiPantryItem>(`/v1/me/pantry/${id}`, toUpdate(data)));
}

export async function apiDeletePantryItem(id: string): Promise<void> {
  await api().delete(`/v1/me/pantry/${id}`);
}

export async function apiClearPantry(): Promise<void> {
  await api().delete('/v1/me/pantry');
}

export async function apiPantrySummary(): Promise<PantrySummary> {
  return api().get<PantrySummary>('/v1/me/pantry/summary');
}
