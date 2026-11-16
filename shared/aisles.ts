// Shopping lists in the order a shop is walked: fresh things first, heavy and shelf-stable things after.
import type { ShoppingCategory } from './mealplan';

export const AISLE_ORDER: readonly ShoppingCategory[] = ['produce', 'bakery', 'meat', 'seafood', 'dairy', 'frozen', 'grains', 'canned', 'condiments', 'spices', 'beverages', 'other'];

/** Sorts lines by aisle, keeping the order inside an aisle (alphabetical by name when `alphabetical` is true). */
export function sortByAisle<T extends { category: ShoppingCategory; name: string }>(items: readonly T[], alphabetical = true): T[] {
  const rank = (c: ShoppingCategory) => {
    const i = AISLE_ORDER.indexOf(c);
    return i === -1 ? AISLE_ORDER.length : i;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.category) - rank(b.item.category) || (alphabetical ? a.item.name.localeCompare(b.item.name) : a.index - b.index))
    .map((x) => x.item);
}

/** The aisle name as shown on screen. */
export const AISLE_LABEL: Record<ShoppingCategory, string> = {
  produce: 'Fruit and vegetables',
  bakery: 'Bakery',
  meat: 'Meat',
  seafood: 'Fish and seafood',
  dairy: 'Dairy and eggs',
  frozen: 'Frozen',
  grains: 'Rice, pasta and grains',
  canned: 'Tins and jars',
  condiments: 'Oils, sauces and sweeteners',
  spices: 'Herbs and spices',
  beverages: 'Drinks',
  other: 'Other',
};
