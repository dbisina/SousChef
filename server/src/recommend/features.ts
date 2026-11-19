/** A recipe (or a person's taste) as numbers: how much of each trait it has. Missing means zero. */
export type Vec = Record<string, number>;

/** The parts of a recipe that say what kind of dish it is. */
export interface RecipeTraits {
  cuisine: string;
  category: string;
  difficulty: string;
  prepTime: number;
  cookTime: number;
  dietaryFlags: string[];
  tags: string[];
  /** Lowercase ingredient names, in the order the recipe lists them. */
  ingredientNames: string[];
}

/** Everyone has these; they say nothing about the dish. */
const STAPLES = new Set(['salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'vegetable oil', 'cooking oil', 'sunflower oil', 'ice', 'salt and pepper']);
/** Words that describe how an ingredient is prepared or how much of it there is, not what it is. */
const DESCRIPTORS = new Set([
  'fresh', 'chopped', 'diced', 'sliced', 'minced', 'large', 'small', 'medium', 'ground', 'boneless', 'skinless', 'cooked', 'raw', 'dried', 'frozen',
  'whole', 'grated', 'ripe', 'finely', 'roughly', 'taste', 'of', 'and', 'or', 'the', 'for', 'extra', 'virgin', 'plain', 'optional', 'red', 'green',
  'yellow', 'white', 'black', 'brown', 'sweet', 'hot', 'mild', 'light', 'dark', 'low', 'fat', 'free', 'organic', 'unsalted', 'salted',
]);
/** Words that name a kind of thing rather than the thing (the dish is "soy" or "chicken", not "sauce" or "breast"). */
const GENERIC = new Set(['sauce', 'powder', 'paste', 'stock', 'broth', 'cube', 'leaf', 'leave', 'clove', 'piece', 'pinch', 'cup', 'juice', 'zest', 'seed', 'fillet', 'breast', 'thigh', 'wing']);

const singular = (w: string): string => {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};

/**
 * The words that say what an ingredient is, singular, without how it is cut or how much there is: "finely chopped red onions"
 * is onion, "chicken breast" is chicken, "soy sauce" is soy. At most three. None for staples (salt, pepper, oil, water).
 */
export function ingredientTokens(name: string): string[] {
  const cleaned = name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s-]/g, ' ').trim();
  if (STAPLES.has(cleaned)) return [];
  const out: string[] = [];
  for (const raw of cleaned.split(/[\s-]+/)) {
    if (raw.length < 3 || DESCRIPTORS.has(raw)) continue;
    const w = singular(raw);
    if (w.length < 3 || GENERIC.has(w) || STAPLES.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out.slice(0, 3);
}

const timeBand = (minutes: number): string => (minutes <= 20 ? 'quick' : minutes <= 40 ? 'short' : minutes <= 75 ? 'medium' : 'long');

/** How a recipe is described: what it is (cuisine, meal), how hard and long it is, what it suits, and what is in it. Length 1. */
export function recipeFeatures(r: RecipeTraits): Vec {
  const v: Vec = {};
  const add = (key: string, w: number) => {
    v[key] = Math.max(v[key] ?? 0, w);
  };
  if (r.cuisine && r.cuisine !== 'other') add(`cuisine:${r.cuisine}`, 1.0);
  if (r.category) add(`meal:${r.category}`, 0.6);
  if (r.difficulty) add(`level:${r.difficulty}`, 0.3);
  add(`time:${timeBand((r.prepTime || 0) + (r.cookTime || 0))}`, 0.4);
  for (const d of r.dietaryFlags.slice(0, 6)) add(`diet:${d.toLowerCase()}`, 0.5);
  // What is in it: the first few ingredients the recipe lists (the main ones), by what they are.
  let taken = 0;
  for (const name of r.ingredientNames.slice(0, 8)) {
    for (const t of ingredientTokens(name)) {
      if (taken >= 8) break;
      if (v[`ing:${t}`] === undefined) {
        add(`ing:${t}`, 0.8);
        taken++;
      }
    }
  }
  for (const tag of r.tags.slice(0, 5)) {
    const t = tag.toLowerCase().trim();
    if (t) add(`tag:${t}`, 0.3);
  }
  return normalize(v);
}

export const norm = (v: Vec): number => Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));

export function normalize(v: Vec): Vec {
  const n = norm(v);
  if (n === 0) return {};
  const out: Vec = {};
  for (const [k, x] of Object.entries(v)) out[k] = x / n;
  return out;
}

/** The dot product of two vectors. Both length 1: how alike they are, from -1 to 1. */
export function cosine(a: Vec, b: Vec): number {
  const [small, big] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of Object.entries(small)) {
    const y = big[k];
    if (y !== undefined) dot += x * y;
  }
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot / d;
}

/** `into += v * weight` (in place). */
export function addScaled(into: Vec, v: Vec, weight: number): void {
  for (const [k, x] of Object.entries(v)) into[k] = (into[k] ?? 0) + x * weight;
}

/** Keeps the strongest `n` traits (by size, either way), so a profile stays small. */
export function topTraits(v: Vec, n: number): Vec {
  return Object.fromEntries(Object.entries(v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n));
}
