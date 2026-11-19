import { FRESH_IMPORT_MS, freshestImport, importedWithLinks, isFreshImport } from '@/lib/importedRecipes';
import type { WantToCookItem } from '@/types/wantToCook';

const NOW = 1_800_000_000_000;
const ts = (ms: number) => ({ toMillis: () => ms });

const item = (id: string, savedMs: number, over: Record<string, unknown> = {}, recipe: Record<string, unknown> | null = {}): WantToCookItem =>
  ({
    id,
    ownerId: 'u',
    status: 'saved',
    savedAt: ts(savedMs),
    addedToShoppingList: false,
    ...(recipe ? { importedRecipe: { id, title: id, sourceURL: 'https://x.test/' + id, sourcePlatform: 'tiktok', ...recipe } } : {}),
    ...over,
  }) as unknown as WantToCookItem;

describe('importedWithLinks', () => {
  it('keeps only link imports, newest first', () => {
    const items = [
      item('old', NOW - 5000),
      item('new', NOW - 1000),
      item('scan', NOW, {}, { sourceURL: '', sourcePlatform: 'cookbook_scan' }),
      item('app', NOW, {}, null),
    ];
    expect(importedWithLinks(items).map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('drops cookbook photo imports even when they carry a link', () => {
    expect(importedWithLinks([item('c', NOW, {}, { sourcePlatform: 'Cookbook' })])).toHaveLength(0);
  });
});

describe('fresh imports', () => {
  it('is fresh inside 72 hours and not after', () => {
    expect(isFreshImport(item('a', NOW - 1000), NOW)).toBe(true);
    expect(isFreshImport(item('a', NOW - FRESH_IMPORT_MS - 1), NOW)).toBe(false);
  });

  it('is not fresh once cooked', () => {
    expect(isFreshImport(item('a', NOW - 1000, { status: 'cooked' }), NOW)).toBe(false);
  });

  it('picks the newest fresh import, or null', () => {
    const items = [item('a', NOW - 9000), item('b', NOW - 2000), item('stale', NOW - FRESH_IMPORT_MS - 10)];
    expect(freshestImport(items, NOW)?.id).toBe('b');
    expect(freshestImport([item('stale', NOW - FRESH_IMPORT_MS - 10)], NOW)).toBeNull();
    expect(freshestImport([], NOW)).toBeNull();
  });
});
