// Making a recipe bigger or smaller, and switching between metric and US measures and Celsius and Fahrenheit.
// Plain arithmetic, so the app can do it on the phone with no network and no AI.

export type UnitSystem = 'original' | 'metric' | 'us';
export type TempUnit = 'original' | 'c' | 'f';

interface UnitInfo {
  kind: 'volume' | 'mass';
  /** Millilitres or grams in one of it. */
  size: number;
}

const UNITS: Record<string, UnitInfo> = {
  ml: { kind: 'volume', size: 1 },
  l: { kind: 'volume', size: 1000 },
  litre: { kind: 'volume', size: 1000 },
  liter: { kind: 'volume', size: 1000 },
  tsp: { kind: 'volume', size: 4.92892 },
  teaspoon: { kind: 'volume', size: 4.92892 },
  tbsp: { kind: 'volume', size: 14.7868 },
  tablespoon: { kind: 'volume', size: 14.7868 },
  cup: { kind: 'volume', size: 236.588 },
  g: { kind: 'mass', size: 1 },
  gram: { kind: 'mass', size: 1 },
  kg: { kind: 'mass', size: 1000 },
  oz: { kind: 'mass', size: 28.3495 },
  ounce: { kind: 'mass', size: 28.3495 },
  lb: { kind: 'mass', size: 453.592 },
  pound: { kind: 'mass', size: 453.592 },
};

/** "Cups" -> "cup", "tbsp." -> "tbsp". */
const unitKey = (unit: string): string => unit.toLowerCase().replace(/\./g, '').trim().replace(/s$/, '');

const round = (n: number, places = 2): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
/** To the nearest quarter, which is how cups and spoons are measured. */
const quarter = (n: number): number => Math.max(0.25, Math.round(n * 4) / 4);
/** To a tidy number for a scale or a jug: nearest 5 when large. */
const tidy = (n: number): number => (n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : round(n, 1));

export interface Measure {
  amount: number;
  unit: string;
}

/** The same amount in the other system. Things that are not measured by volume or weight (eggs, cloves) are left alone. */
export function convertMeasure(m: Measure, system: UnitSystem): Measure {
  if (system === 'original') return m;
  const info = UNITS[unitKey(m.unit)];
  if (!info) return m;
  const base = m.amount * info.size; // ml or g
  if (system === 'metric') {
    if (info.kind === 'volume') return base >= 1000 ? { amount: round(base / 1000), unit: 'l' } : { amount: tidy(base), unit: 'ml' };
    return base >= 1000 ? { amount: round(base / 1000), unit: 'kg' } : { amount: tidy(base), unit: 'g' };
  }
  if (info.kind === 'volume') {
    if (base >= 59) return { amount: quarter(base / 236.588), unit: 'cup' };
    if (base >= 14) return { amount: quarter(base / 14.7868), unit: 'tbsp' };
    return { amount: quarter(base / 4.92892), unit: 'tsp' };
  }
  const oz = base / 28.3495;
  return oz >= 16 ? { amount: round(oz / 16, 1), unit: 'lb' } : { amount: round(oz, 1), unit: 'oz' };
}

const toC = (f: number) => Math.round(((f - 32) * 5) / 9 / 5) * 5;
const toF = (c: number) => Math.round((c * 9) / 5 / 5 + 32 / 5) * 5; // (c x 9/5 + 32), to the nearest 5

/** Rewrites oven temperatures in a step ("bake at 350°F") into the other unit. Other numbers are left alone. */
export function convertTemperatures(text: string, to: TempUnit): string {
  if (to === 'original') return text;
  return text.replace(/(\d{2,3})\s*(?:°|º|degrees?)\s*(celsius|fahrenheit|c|f)\b/gi, (whole, num: string, u: string) => {
    const from = u.toLowerCase().startsWith('c') ? 'c' : 'f';
    if (from === to) return whole;
    const n = Number(num);
    return to === 'c' ? `${toC(n)}°C` : `${toF(n)}°F`;
  });
}

export interface ScalableRecipe {
  servings: number;
  ingredients: { name: string; amount: number; unit: string; optional?: boolean }[];
  instructions: string[];
}

export interface ScaleOptions {
  servings: number;
  units?: UnitSystem;
  temp?: TempUnit;
}

export interface ScaledRecipe extends ScalableRecipe {
  /** What the amounts were multiplied by. */
  factor: number;
  /** Quantities written inside the steps ("add 2 cups") are not changed: check them against the list. */
  note: string;
}

export function scaleRecipe(recipe: ScalableRecipe, options: ScaleOptions): ScaledRecipe {
  const servings = Math.min(100, Math.max(1, Math.round(options.servings)));
  const factor = servings / Math.max(1, recipe.servings);
  return {
    servings,
    factor: round(factor, 4),
    ingredients: recipe.ingredients.map((i) => {
      const scaled = convertMeasure({ amount: round(i.amount * factor, 2), unit: i.unit }, options.units ?? 'original');
      return { ...i, amount: scaled.amount, unit: scaled.unit };
    }),
    instructions: recipe.instructions.map((s) => convertTemperatures(s, options.temp ?? 'original')),
    note: factor === 1 ? '' : 'Amounts written inside the steps are not changed. Check them against the ingredient list.',
  };
}
