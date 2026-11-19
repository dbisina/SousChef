// Turns what a person types or pastes ("2 cups flour", "1 1/2 tbsp olive oil", "salt to taste") into recipe ingredients,
// so nobody has to fill three boxes per ingredient.

export interface IngredientLine {
  name: string;
  amount: number;
  unit: string;
  optional: boolean;
}

const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

/** Written unit -> the short form the app stores. */
const UNITS: Record<string, string> = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', tsps: 'tsp',
  gram: 'g', grams: 'g', g: 'g', gr: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg', kgs: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', l: 'l',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  pinch: 'pinch', pinches: 'pinch', dash: 'dash', dashes: 'dash',
  clove: 'clove', cloves: 'clove', slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  piece: 'piece', pieces: 'piece', bunch: 'bunch', bunches: 'bunch', handful: 'handful', handfuls: 'handful',
  stick: 'stick', sticks: 'stick', pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack',
};

/** "1", "1.5", "1/2", "1 1/2", "½", "1½" at the start of the text: the amount and what is left. */
function takeAmount(text: string): { amount: number | null; rest: string } {
  let s = text;
  let total = 0;
  let found = false;
  const whole = /^(\d+(?:[.,]\d+)?)(?!\s*\/)\s*/.exec(s);
  // "2-3 cloves": take the lower number, which is what the recipe needs at least.
  const range = /^(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?\s*/i.exec(s);
  if (range) {
    return { amount: parseFloat(range[1]!.replace(',', '.')), rest: s.slice(range[0].length) };
  }
  if (whole) {
    total += parseFloat(whole[1]!.replace(',', '.'));
    s = s.slice(whole[0].length);
    found = true;
  }
  const mixed = /^(\d+)\s*\/\s*(\d+)\s*/.exec(s);
  if (mixed && Number(mixed[2]) !== 0) {
    total += Number(mixed[1]) / Number(mixed[2]);
    s = s.slice(mixed[0].length);
    found = true;
  } else if (!found) {
    const only = /^(\d+)\s*\/\s*(\d+)\s*/.exec(text);
    if (only && Number(only[2]) !== 0) {
      return { amount: Number(only[1]) / Number(only[2]), rest: text.slice(only[0].length) };
    }
  }
  const first = s[0] ?? '';
  if (first && VULGAR[first] !== undefined) {
    total += VULGAR[first]!;
    s = s.slice(1).trimStart();
    found = true;
  }
  return found ? { amount: Math.round(total * 1000) / 1000, rest: s } : { amount: null, rest: text };
}

/** Reads one line. Returns null for an empty line or a heading such as "Ingredients:". */
export function parseIngredientLine(raw: string): IngredientLine | null {
  let line = raw.replace(/^[\s\-–—•*·▪●◦✓☐]+/, '').trim();
  line = line.replace(/^\d+[.)]\s+/, ''); // "1. flour" and "1. 4 tomatoes": a number, a full stop and a space is a list number, never an amount
  if (!line || /^(ingredients?|you will need|for the [a-z ]+|method|directions?|steps?)\s*:?$/i.test(line)) return null;

  let optional = false;
  line = line.replace(/\s*[(,]?\s*\boptional\b\)?\s*$/i, () => {
    optional = true;
    return '';
  });

  const { amount, rest } = takeAmount(line);
  let body = rest.trim();
  let unit = '';
  const unitMatch = /^([A-Za-z]+)\.?(?=\s|$)/.exec(body);
  const known = unitMatch ? UNITS[unitMatch[1]!.toLowerCase()] : undefined;
  // A single letter ("c", "g", "l") only counts as a unit after an amount: "garlic" and "l" in "lemon" stay words.
  if (known && !(amount === null && unitMatch![1]!.length <= 2) && !(unitMatch![1]!.length === 1 && amount === null)) {
    unit = known;
    body = body.slice(unitMatch![0].length).trim();
    body = body.replace(/^of\s+/i, '');
  }
  body = body.replace(/^[,:\-–]\s*/, '').replace(/\s+/g, ' ').trim();
  if (!body) return null;
  const withoutAmount = amount === null;
  return {
    name: body,
    // "a pinch of salt" or "salt to taste": no number to give, so one pinch, or 0 when there is no unit either.
    amount: withoutAmount ? (unit ? 1 : 0) : amount,
    unit,
    optional,
  };
}

/** Every line of a pasted or typed list. */
export function parseIngredientLines(text: string): IngredientLine[] {
  return text
    .split(/\r?\n|;/)
    .map((l) => parseIngredientLine(l))
    .filter((l): l is IngredientLine => l !== null);
}

/** The reverse, for editing: one line per ingredient. */
export function formatIngredientLine(i: IngredientLine): string {
  const amount = i.amount > 0 ? String(Math.round(i.amount * 100) / 100) : '';
  return [amount, i.unit, i.name].filter(Boolean).join(' ') + (i.optional ? ' (optional)' : '');
}
