import type { NutrientKey } from '@/lib/nutrition';
import type { Rating } from '@/types/order';

export type TagLevel = 'lo' | 'md' | 'hi';

/** Rating level from lib/nutrition mapped to the RatingTag level names. */
export const tagLevel = (r: Rating): TagLevel => (r.level === 'low' ? 'lo' : r.level === 'medium' ? 'md' : 'hi');

/** Which nutrient matters most for this user, from their health conditions. Sugars when nothing says otherwise. */
const CONDITION_FOCUS: [string, NutrientKey][] = [
  ['diabetic-type1', 'sugars'],
  ['diabetic-type2', 'sugars'],
  ['prediabetes', 'sugars'],
  ['pcos', 'sugars'],
  ['high-blood-pressure', 'salt'],
  ['kidney-disease', 'salt'],
  ['heart-disease', 'saturates'],
  ['high-cholesterol', 'saturates'],
];

export function focusNutrient(conditions: readonly string[] | undefined): NutrientKey {
  for (const [id, key] of CONDITION_FOCUS) if (conditions?.includes(id)) return key;
  return 'sugars';
}

/** Lower-case names used inside a sentence, keyed by the ids the dietary settings store. */
const ALLERGEN_NAMES: Record<string, string> = {
  nuts: 'tree nuts',
  peanuts: 'peanuts',
  shellfish: 'shellfish',
  fish: 'fish',
  eggs: 'egg',
  soy: 'soy',
  wheat: 'wheat',
  sesame: 'sesame',
  milk: 'milk',
  corn: 'corn',
  mustard: 'mustard',
  celery: 'celery',
  lupin: 'lupin',
  mollusks: 'molluscs',
  sulfites: 'sulphites',
  gluten: 'gluten',
};

const ALIAS: Record<string, string> = { egg: 'eggs', dairy: 'milk', nut: 'nuts', treenuts: 'nuts', mollusc: 'mollusks', molluscs: 'mollusks' };

const canon = (id: string): string => {
  const k = id.trim().toLowerCase();
  return ALIAS[k] ?? k;
};

export const allergenName = (id: string): string => ALLERGEN_NAMES[canon(id)] ?? id.toLowerCase();

const related = (a: string, b: string): boolean =>
  a === b || (a === 'gluten' && b === 'wheat') || (a === 'wheat' && b === 'gluten');

/** Dish allergens that hit any of the user's listed allergies (display names). */
export function matchingAllergens(dishAllergens: readonly string[], userAllergies: readonly string[]): string[] {
  const mine = userAllergies.map(canon);
  return dishAllergens.filter((d) => mine.some((u) => related(canon(d), u))).map(allergenName);
}
