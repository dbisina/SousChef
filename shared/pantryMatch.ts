// Which of a recipe's ingredients the pantry covers. Pure, so the app and the server give the same answer.
import type { PantryMatch } from './kitchen';

/** Lowercase, trimmed, single spaces: the form names are compared in. */
export const nameKey = (name: string): string => name.toLowerCase().replace(/\s+/g, ' ').trim();

/** "tomatoes" -> "tomato", "berries" -> "berry", "onions" -> "onion". Not a real stemmer, just the common plurals. */
const singular = (word: string): string => {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

const words = (name: string): string[] => nameKey(name).split(/[^a-z0-9]+/).filter(Boolean).map(singular);

/**
 * A pantry name covers an ingredient when all the words of one are among the words of the other, so "tomato" covers
 * "tomatoes", "chicken" covers "chicken breast" and "oil" covers "olive oil" - but "oil" is not found in "boil" and
 * "egg" is not found in "eggplant", because whole words are compared, not letters.
 */
const covers = (pantry: string[], ingredient: string[]): boolean => {
  if (pantry.length === 0 || ingredient.length === 0) return false;
  return pantry.every((w) => ingredient.includes(w)) || ingredient.every((w) => pantry.includes(w));
};

export function matchPantry(
  ingredients: { name: string; optional?: boolean | undefined }[],
  pantryNames: string[],
): PantryMatch {
  const pantry = pantryNames.map(words).filter((w) => w.length > 0);
  // Optional ingredients never count against you; if every ingredient is optional, they all count.
  const required = ingredients.filter((i) => !i.optional);
  const considered = required.length > 0 ? required : ingredients;

  const matching: string[] = [];
  const missing: string[] = [];
  for (const ingredient of considered) {
    const w = words(ingredient.name);
    (pantry.some((p) => covers(p, w)) ? matching : missing).push(ingredient.name);
  }
  const total = matching.length + missing.length;
  return {
    matchPercent: total === 0 ? 0 : Math.round((matching.length / total) * 100),
    matching,
    missing,
    canMake: total > 0 && missing.length === 0,
  };
}
