// Reading recipes out of web pages without a model where possible: most recipe sites publish the recipe as structured
// data (schema.org JSON-LD), which is exact and free. Otherwise the readable text goes to the AI.

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#8217': '’', '#8211': '–', '#8212': '—' };

export const decodeEntities = (s: string): string =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, name: string) => {
    const known = ENTITIES[name.toLowerCase()];
    if (known !== undefined) return known;
    if (name[0] === '#') {
      const code = name[1]?.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return m;
  });

/** Collapses whitespace and removes anything that could be markup, so text is safe to show and to send on. */
export const cleanText = (s: string, max = 2000): string => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, max);

/* ------------------------------------------------------------------ the page's own description */

export interface PageMeta {
  title: string | null;
  description: string | null;
  image: string | null;
}

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, 'i').exec(html);
    const found = a?.[1] ?? b?.[1];
    if (found) return cleanText(found, 4000);
  }
  return null;
}

export function pageMeta(html: string): PageMeta {
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return {
    title: metaContent(html, ['og:title', 'twitter:title']) ?? (titleTag ? cleanText(titleTag, 300) : null),
    description: metaContent(html, ['og:description', 'twitter:description', 'description']),
    image: metaContent(html, ['og:image', 'twitter:image']),
  };
}

/** The readable text of a page: scripts, styles and page furniture removed. */
export function visibleText(html: string, max = 12_000): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  const stripped = body
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, '\n');
  return decodeEntities(stripped.replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

/* ------------------------------------------------------------------ structured recipe data */

export interface ParsedRecipe {
  title: string;
  description: string;
  imageUrl?: string;
  ingredients: { name: string; amount: number; unit: string }[];
  instructions: string[];
  servings: number;
  prepTime?: number;
  cookTime?: number;
  tags: string[];
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every `Recipe` object published in the page's JSON-LD blocks (including inside `@graph`). */
export function jsonLdRecipes(html: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!isObject(node)) return;
    const type = asArray(node['@type']).map(String);
    if (type.includes('Recipe')) found.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse((m[1] as string).trim()));
    } catch {
      // a broken block is skipped; others may be fine
    }
  }
  return found;
}

/** "PT1H15M" -> 75. Anything else -> undefined. */
export function isoDurationToMinutes(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(value.trim());
  if (!m) return undefined;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes > 0 ? minutes : undefined;
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅕': 0.2, '⅖': 0.4 };
const UNITS = new Set([
  'tsp', 'teaspoon', 'teaspoons', 'tbsp', 'tablespoon', 'tablespoons', 'cup', 'cups', 'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'ml', 'l', 'liter', 'liters', 'litre', 'litres', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'pinch', 'pinches', 'clove', 'cloves',
  'slice', 'slices', 'piece', 'pieces', 'can', 'cans', 'bunch', 'bunches', 'stick', 'sticks', 'handful', 'handfuls', 'dash', 'dashes', 'sprig', 'sprigs',
]);

/** "1 1/2 cups plain flour" -> { amount 1.5, unit "cups", name "plain flour" }. No quantity means one of it. */
export function parseIngredientLine(line: string): { name: string; amount: number; unit: string } {
  let rest = cleanText(line, 300).replace(/^[-•*\s]+/, '');
  let amount = 0;
  let matched = false;
  for (;;) {
    const num = /^(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?(?!\d)/.exec(rest); // "2" or "2-3" (first of a range)
    const frac = /^(\d+)\s*\/\s*(\d+)/.exec(rest);
    const uni = new RegExp(`^([${Object.keys(FRACTIONS).join('')}])`).exec(rest);
    if (frac) {
      amount += Number(frac[1]) / Number(frac[2]);
      rest = rest.slice(frac[0].length).trim();
    } else if (num) {
      amount += Number(num[1]);
      rest = rest.slice(num[0].length).trim();
    } else if (uni) {
      amount += FRACTIONS[uni[1] as string] as number;
      rest = rest.slice(uni[0].length).trim();
    } else break;
    matched = true;
    if (!/^(\d|[½⅓⅔¼¾⅛⅕⅖])/.test(rest)) break; // a second number may follow ("1 1/2")
  }
  let unit = '';
  const first = /^([A-Za-z]+)\.?\s+(.*)$/.exec(rest);
  if (matched && first && UNITS.has((first[1] as string).toLowerCase())) {
    unit = (first[1] as string).toLowerCase();
    rest = (first[2] as string).replace(/^of\s+/i, '');
  }
  const name = rest.replace(/\s+/g, ' ').trim();
  return { name: name || cleanText(line, 100), amount: matched ? Math.round(amount * 1000) / 1000 : 1, unit };
}

function textOf(step: unknown): string[] {
  if (typeof step === 'string') return [cleanText(step, 1000)];
  if (isObject(step)) {
    if (typeof step['text'] === 'string') return [cleanText(step['text'], 1000)];
    if (step['itemListElement']) return asArray(step['itemListElement']).flatMap(textOf); // a section of steps
    if (typeof step['name'] === 'string') return [cleanText(step['name'], 1000)];
  }
  return [];
}

function imageOf(image: unknown): string | undefined {
  const first = asArray(image)[0];
  const url = typeof first === 'string' ? first : isObject(first) && typeof first['url'] === 'string' ? first['url'] : undefined;
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

function servingsOf(value: unknown): number {
  const first = asArray(value)[0];
  const n = typeof first === 'number' ? first : typeof first === 'string' ? Number(/\d+/.exec(first)?.[0]) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : 2;
}

/** A recipe from a JSON-LD `Recipe` object, or null if it has no usable ingredients and steps. */
export function recipeFromJsonLd(node: Record<string, unknown>): ParsedRecipe | null {
  const ingredients = asArray(node['recipeIngredient']).filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(parseIngredientLine);
  const instructions = asArray(node['recipeInstructions']).flatMap(textOf).filter(Boolean);
  const title = typeof node['name'] === 'string' ? cleanText(node['name'], 200) : '';
  if (!title || ingredients.length < 2 || instructions.length < 1) return null;
  const keywords = typeof node['keywords'] === 'string' ? node['keywords'].split(',') : asArray(node['keywords']).map(String);
  const image = imageOf(node['image']);
  return {
    title,
    description: typeof node['description'] === 'string' ? cleanText(node['description'], 1000) : '',
    ...(image ? { imageUrl: image } : {}),
    ingredients: ingredients.slice(0, 80),
    instructions: instructions.slice(0, 80),
    servings: servingsOf(node['recipeYield']),
    ...(isoDurationToMinutes(node['prepTime']) ? { prepTime: isoDurationToMinutes(node['prepTime']) as number } : {}),
    ...(isoDurationToMinutes(node['cookTime']) ? { cookTime: isoDurationToMinutes(node['cookTime']) as number } : {}),
    tags: keywords.map((k) => cleanText(k, 40)).filter(Boolean).slice(0, 10),
  };
}
