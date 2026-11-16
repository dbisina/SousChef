// One-off, READ-ONLY export of the old Firestore recipes and cookbooks into server/seed/content.json.
//
//   gcloud auth login            (an account that can read the Firebase project)
//   node server/scripts/export-firestore.mjs [projectId]
//
// What it keeps: the recipes and cookbooks themselves. What it drops on purpose: authors and their names (the seed puts
// every recipe under a neutral official SousChef account), users, emails, push tokens, counters and anything personal.
// Recipes that were stored twice are kept once. The output is committed, so nobody needs Firestore access again.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const project = process.argv[2] ?? 'souschef-c23d6';
const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim();
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;

const value = (v) => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(value);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, value(x)]));
  return null;
};

async function all(collection) {
  const out = [];
  let pageToken = '';
  do {
    const res = await fetch(`${base}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${collection}: ${res.status}`);
    const json = await res.json();
    for (const d of json.documents ?? []) out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, value(v)])) });
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

/** Which official SousChef account a recipe goes under (decided by the old author, which is then thrown away). */
const houseFor = (authorName) => (/julia/i.test(authorName) ? 'baking' : /jamie/i.test(authorName) ? 'quick' : 'kitchen');

/** Photos whose old links no longer exist (found 2026-11-15), swapped for working ones. */
const PHOTO_FIXES = {
  'Grilled Salmon with Asparagus': 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&w=800&q=80',
  'Classic Chicken Stir-Fry': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
  'Avocado Toast with Poached Egg': 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&w=800&q=80',
  'Kitchen Classics': 'https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?auto=format&fit=crop&w=800&q=80',
};

const recipesRaw = await all('recipes');
const byTitle = new Map();
const idToTitle = new Map();
for (const r of recipesRaw) {
  idToTitle.set(r.id, r.title);
  if (byTitle.has(r.title)) continue; // stored twice: keep the first
  byTitle.set(r.title, {
    title: r.title,
    description: r.description ?? '',
    imageUrl: PHOTO_FIXES[r.title] ?? r.imageURL,
    category: r.category,
    cuisine: r.cuisine,
    difficulty: r.difficulty,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    ingredients: (r.ingredients ?? []).map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, ...(i.optional ? { optional: true } : {}) })),
    instructions: r.instructions ?? [],
    tags: r.tags ?? [],
    house: houseFor(r.authorName ?? ''),
  });
}

/** A cookbook named after a real person gets a neutral name. */
const neutral = (title) => title.replace(/^Chef \w+'s Masterclass$/i, 'Kitchen Classics');
const unnamed = (text) => (text ?? '').replace(/,? (?:curated|chosen|picked|written) by [\w ]+? (?:himself|herself|themselves)\b/i, '').replace(/\s+/g, ' ').trim();

const cookbooks = (await all('cookbooks')).map((c) => ({
  title: neutral(c.title),
  description: unnamed(c.description),
  coverImageUrl: PHOTO_FIXES[neutral(c.title)] ?? c.coverImageURL,
  category: c.category ?? undefined,
  // By recipe title, so the two copies of a recipe collapse into one.
  recipes: [...new Set((c.recipeIds ?? []).map((id) => idToTitle.get(id)).filter(Boolean))],
  house: houseFor(c.authorName ?? ''),
}));

mkdirSync(new URL('../seed/', import.meta.url), { recursive: true });
const file = new URL('../seed/content.json', import.meta.url);
writeFileSync(file, JSON.stringify({ recipes: [...byTitle.values()], cookbooks }, null, 2) + '\n');
console.log(`wrote ${byTitle.size} recipes (from ${recipesRaw.length} documents) and ${cookbooks.length} cookbooks to server/seed/content.json`);
