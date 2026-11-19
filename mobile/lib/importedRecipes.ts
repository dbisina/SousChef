import type { WantToCookItem } from '@/types/wantToCook';

/** How long a new import stays pinned to the top of Home. */
export const FRESH_IMPORT_MS = 72 * 60 * 60 * 1000;

const millisOf = (ts: unknown): number => {
  const t = ts as { toMillis?: () => number; seconds?: number } | Date | null | undefined;
  if (!t) return 0;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  return 0;
};

/** Recipes the person brought in from a link, newest first. Cookbook scans and recipes saved from the app are not "imported with links". */
export function importedWithLinks(items: readonly WantToCookItem[]): WantToCookItem[] {
  return items
    .filter((i) => !!i.importedRecipe && !!i.importedRecipe.sourceURL && !(i.importedRecipe.sourcePlatform ?? '').toLowerCase().includes('cookbook'))
    .sort((a, b) => millisOf(b.savedAt) - millisOf(a.savedAt));
}

/** True while an import is new enough to sit at the top of Home. */
export function isFreshImport(item: WantToCookItem, now: number = Date.now()): boolean {
  const saved = millisOf(item.savedAt);
  return saved > 0 && now - saved < FRESH_IMPORT_MS && item.status !== 'cooked';
}

/** The newest link import that is still fresh, or null. */
export function freshestImport(items: readonly WantToCookItem[], now: number = Date.now()): WantToCookItem | null {
  const first = importedWithLinks(items).find((i) => isFreshImport(i, now));
  return first ?? null;
}
