import { z } from 'zod';
import { CUISINES, DIFFICULTIES, type CreateRecipeRequest, type Cuisine, type RecipeCategory } from '@shared';
import type { AiRouter } from '../ai/router';
import type { Db } from '../db';
import { HouseService } from '../invites/house';
import { RecipeService } from '../recipes/service';
import type { Storage } from '../storage/storage';
import { EntitlementService } from '../subscriptions/service';
import { CookbookService } from '../cookbooks/service';
import { HOUSES, type HouseKey } from './copy';

/** One dish to generate: who posts it, and what to look for on Wikipedia to find a real photo of it. */
export interface DishDef {
  title: string;
  house: HouseKey;
  cuisine: Cuisine;
  category: RecipeCategory;
  wiki: string;
}

export interface GenerateReport {
  created: string[];
  existing: number;
  skipped: { title: string; reason: string }[];
  cookbooks: number;
  posts: number;
}

export interface GenerateDeps {
  db: Db;
  ai: AiRouter;
  storage: Storage | null;
  fetchImpl?: typeof fetch;
  say?: (line: string) => void;
}

const UA = 'enplaceSeed/1.0 (recipe app content seeding)';
const FREE_LICENSE = /^(cc0|public domain|pd\b|cc[- ]by(?![- ]n[cd])|cc[- ]by[- ]sa)/i;
const NEEDS_CREDIT = /^cc[- ]by/i;

const aiSchema = z.object({
  description: z.string().min(20).max(600),
  servings: z.coerce.number().int().min(1).max(12),
  prepTime: z.coerce.number().int().min(0).max(240),
  cookTime: z.coerce.number().int().min(0).max(480),
  difficulty: z.enum(DIFFICULTIES),
  ingredients: z
    .array(z.object({ name: z.string().min(2).max(80), amount: z.coerce.number().positive().max(5000), unit: z.string().max(20).default(''), optional: z.boolean().optional().catch(undefined) }))
    .min(4)
    .max(30),
  instructions: z.array(z.string().min(15).max(600)).min(4).max(20),
  tags: z.array(z.string().max(30)).max(8).optional().catch(undefined),
  dietaryFlags: z.array(z.string().max(30)).max(6).optional().catch(undefined),
  allergens: z.array(z.string().max(30)).max(8).optional().catch(undefined),
  nutritionPerServing: z.object({ calories: z.coerce.number(), protein: z.coerce.number(), carbs: z.coerce.number(), fat: z.coerce.number(), fiber: z.coerce.number().default(0) }),
  postTitle: z.string().min(3).max(70),
  postCaption: z.string().min(20).max(300),
});

const SYSTEM = `You are a professional recipe developer writing for a cooking app. Write one accurate, tested-quality recipe for the dish you are given.
Rules: real, sensible quantities for the stated servings; metric or common kitchen units (g, ml, tbsp, tsp, cup, piece, clove, pinch); every step names the heat, the time or the sign that it is done; no invented health claims; nothing unsafe.
Return only JSON: {"description": one or two inviting sentences, "servings": number, "prepTime": minutes, "cookTime": minutes, "difficulty": "easy"|"medium"|"hard", "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string], "tags": [string], "dietaryFlags": subset of ["vegetarian","vegan","gluten-free","dairy-free","nut-free"], "allergens": subset of ["gluten","dairy","eggs","nuts","peanuts","soy","fish","shellfish","sesame"], "nutritionPerServing": {"calories": kcal, "protein": g, "carbs": g, "fat": g, "fiber": g} for ONE serving, worked out from your ingredient amounts, "postTitle": a short friendly headline, "postCaption": two sentences of practical advice for cooking it well}.`;

export interface Photo {
  bytes: Buffer;
  mime: string;
  /** Text to credit the photographer with, or null when the licence asks for none. */
  credit: string | null;
  source: string;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The lead picture of the dish's Wikipedia article, if its licence allows reuse. Null if not. */
export async function findWikipediaPhoto(wiki: string, fetchImpl: typeof fetch = fetch, waitScale?: number): Promise<Photo | null> {
  const get = async (url: string) => {
    // Wikimedia answers 429 when asked too fast: wait as long as it says (or a little longer each time) and try again.
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) return res;
      if (res.status !== 429 || attempt >= 4) throw new Error(`${res.status}`);
      const asked = Number(res.headers.get('retry-after'));
      await new Promise((r) => setTimeout(r, (Number.isFinite(asked) && asked > 0 ? Math.min(asked, 30) : 4 * (attempt + 1)) * 1000 * (waitScale ?? 1)));
    }
  };
  const page = (await (await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=thumbnail|name&pithumbsize=1000&titles=${encodeURIComponent(wiki)}`)).json()) as {
    query?: { pages?: Record<string, { pageimage?: string; thumbnail?: { source: string; width: number } }> };
  };
  const first = Object.values(page.query?.pages ?? {})[0];
  if (!first?.pageimage || !first.thumbnail || first.thumbnail.width < 700) return null;
  const file = (await (await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|mime&titles=${encodeURIComponent(`File:${first.pageimage}`)}`)).json()) as {
    query?: { pages?: Record<string, { imageinfo?: { mime?: string; extmetadata?: Record<string, { value?: string }> }[] }> };
  };
  const info = Object.values(file.query?.pages ?? {})[0]?.imageinfo?.[0];
  const licence = info?.extmetadata?.['LicenseShortName']?.value ?? '';
  if (!FREE_LICENSE.test(licence) || !/^image\/(jpeg|png|webp)$/.test(info?.mime ?? '')) return null;
  const author = stripTags(info?.extmetadata?.['Artist']?.value ?? '') || 'Wikimedia Commons contributor';
  const img = await get(first.thumbnail.source);
  const bytes = Buffer.from(await img.arrayBuffer());
  if (bytes.byteLength < 20_000 || bytes.byteLength > 3_500_000) return null;
  return {
    bytes,
    mime: first.thumbnail.source.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
    credit: NEEDS_CREDIT.test(licence) ? `Photo: ${author.slice(0, 80)} (${licence}), Wikimedia Commons` : null,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(first.pageimage)}`,
  };
}

const verdict = z.object({ match: z.boolean(), reason: z.string().optional() });

/**
 * The model's own nutrition estimate, accepted only when it is believable: a plausible meal size, and macros that add up to
 * the calories (4 kcal a gram of protein or carbohydrate, 9 of fat) within a quarter. Null otherwise.
 */
export function believableNutrition(n: { calories: number; protein: number; carbs: number; fat: number; fiber: number }, servings: number) {
  const values = [n.calories, n.protein, n.carbs, n.fat, n.fiber];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return null;
  if (n.calories < 60 || n.calories > 1500) return null;
  const fromMacros = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (Math.abs(fromMacros - n.calories) > n.calories * 0.25) return null;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { caloriesPerServing: Math.round(n.calories), totalCalories: Math.round(n.calories * servings), protein: r(n.protein), carbs: r(n.carbs), fat: r(n.fat), fiber: r(n.fiber) };
}

/** Asks a model that can see whether the picture really shows the dish (a lead image can be a map, a diagram or a person). */
export async function photoShows(ai: AiRouter, title: string, photo: Photo, mode: 'dish' | 'subject' = 'dish'): Promise<boolean> {
  try {
    const v = await ai.runJson(
      {
        task: 'judge_plate',
        system: 'You check food photos. Answer only with JSON.',
        prompt:
          mode === 'dish'
            ? `Does this photo clearly show the dish "${title}" as a finished plate or serving of food (not a diagram, map, ingredients only, packaging or a person)? It must also show no readable business names, shop or restaurant signs, menus, receipts, price tags, logos or brand text anywhere in the picture. Return {"match": true|false, "reason": "..."}.`
            : `Is this a clear, good photo of "${title}" (a food, ingredient, dish, drink, kitchen tool or cooking technique)? It must really show that subject, in focus, with no text overlays, logos, maps, diagrams or people's faces as the main subject. Return {"match": true|false, "reason": "..."}.`,
        images: [{ base64: photo.bytes.toString('base64'), mimeType: photo.mime }],
        json: true,
        maxOutputTokens: 120,
        temperature: 0,
      },
      verdict,
    );
    return v.match;
  } catch {
    return false;
  }
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function store(storage: Storage, key: string, photo: Photo, fetchImpl: typeof fetch): Promise<string> {
  const signed = await storage.presignUpload({ key, contentType: photo.mime, expiresSeconds: 600 });
  const res = await fetchImpl(signed.url, { method: 'PUT', headers: signed.headers, body: new Uint8Array(photo.bytes) });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return storage.publicUrl(key);
}

/**
 * A verified photo of the dish: the lead picture of its Wikipedia article if that shows the dish, otherwise the first
 * Wikimedia Commons search result (free licence only) that a vision model confirms. Null with a reason when none passes.
 */
export async function pickDishPhoto(ai: AiRouter, dish: Pick<DishDef, 'title' | 'wiki'>, fetchImpl: typeof fetch): Promise<{ photo: Photo | null; reason: string }> {
  let lead: Photo | null = null;
  try {
    lead = await findWikipediaPhoto(dish.wiki, fetchImpl);
  } catch {
    lead = null;
  }
  if (lead && (await photoShows(ai, dish.title, lead))) return { photo: lead, reason: '' };
  let candidates: Photo[] = [];
  try {
    candidates = await findCommonsPhotos(`${dish.title} food dish`, fetchImpl, 3);
  } catch {
    candidates = [];
  }
  for (const c of candidates) if (await photoShows(ai, dish.title, c)) return { photo: c, reason: '' };
  return { photo: null, reason: lead || candidates.length > 0 ? 'the photo does not clearly show the dish' : 'no freely licensed photo found' };
}

/**
 * Gives an official recipe a new verified photo: the recipe, its posts, and any cookbook cover or account picture that used the
 * old one all move to it. For photos that turned out to show someone else's branding. Returns what happened, in words.
 */
export async function rephotoDish(deps: GenerateDeps, dishes: DishDef[], title: string): Promise<string> {
  const { db, ai, storage } = deps;
  if (!storage) throw new Error('Photos need the file store (S3_* settings).');
  const fetchImpl = deps.fetchImpl ?? fetch;
  const dish = dishes.find((d) => d.title === title);
  if (!dish) return `${title}: not in the dish list`;
  const recipes = await db.recipe.findMany({ where: { title, author: { kind: 'HOUSE' } }, select: { id: true, imageUrl: true, description: true } });
  if (recipes.length === 0) return `${title}: no such official recipe`;
  const found = await pickDishPhoto(ai, dish, fetchImpl);
  if (!found.photo) return `${title}: kept the old photo (${found.reason})`;
  const photo = found.photo;
  const imageUrl = await store(storage, `seed/${slug(title)}-${Date.now().toString(36)}.${photo.mime === 'image/png' ? 'png' : 'jpg'}`, photo, fetchImpl);
  for (const r of recipes) {
    const base = (r.description ?? '').replace(/\n\nPhoto: [^\n]*$/, '');
    await db.recipe.update({ where: { id: r.id }, data: { imageUrl, description: photo.credit ? `${base}\n\n${photo.credit}` : base } });
    await db.post.updateMany({ where: { recipeId: r.id }, data: { photoUrl: imageUrl } });
    await db.cookbook.updateMany({ where: { coverImageUrl: r.imageUrl }, data: { coverImageUrl: imageUrl } });
    await db.user.updateMany({ where: { photoUrl: r.imageUrl, kind: 'HOUSE' }, data: { photoUrl: imageUrl } });
  }
  return `${title}: new photo ${imageUrl} (${photo.source})`;
}

/**
 * Real recipes from the dish list: one model-written recipe per dish (checked against the server's own recipe rules), with a
 * real photo of the dish from Wikipedia (free licences only, checked by a vision model, stored on our own file store so the link
 * never dies). A dish with no verified photo is skipped, never faked. Then a cookbook per official account, and a post for
 * every recipe from the account that owns it. Safe to run again: dishes already there are left alone.
 */
export async function generateContent(deps: GenerateDeps, dishes: DishDef[], options: { limit?: number; dryRun?: boolean; pauseMs?: number } = {}): Promise<GenerateReport> {
  const { db, ai, storage } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const say = deps.say ?? (() => undefined);
  const report: GenerateReport = { created: [], existing: 0, skipped: [], cookbooks: 0, posts: 0 };
  if (!storage) throw new Error('Photos need the file store (S3_* settings). Set it up first.');

  const house = new HouseService(db);
  const recipes = new RecipeService(db, new EntitlementService(db));
  const cookbooks = new CookbookService(db);
  const ids = new Map<HouseKey, string>();
  for (const [key, account] of Object.entries(HOUSES)) {
    const found = await db.user.findFirst({ where: { handle: { in: [account.handle, account.legacyHandle] }, kind: 'HOUSE' }, select: { id: true } });
    if (found) ids.set(key, found.id);
  }

  let made = 0;
  const byHouse = new Map<HouseKey, { id: string; title: string; imageUrl: string }[]>();
  for (const dish of dishes) {
    const authorId = ids.get(dish.house);
    if (!authorId) {
      report.skipped.push({ title: dish.title, reason: 'its official account does not exist yet (run npm run seed first)' });
      continue;
    }
    const have = await db.recipe.findFirst({ where: { authorId, title: dish.title }, select: { id: true, imageUrl: true } });
    if (have) {
      report.existing++;
      byHouse.set(dish.house, [...(byHouse.get(dish.house) ?? []), { id: have.id, title: dish.title, imageUrl: have.imageUrl }]);
      continue;
    }
    if (options.limit !== undefined && made >= options.limit) continue;
    if (options.dryRun) {
      say(`would generate ${dish.title}`);
      continue;
    }
    if (options.pauseMs) await new Promise((r) => setTimeout(r, options.pauseMs));
    try {
      const found = await pickDishPhoto(ai, dish, fetchImpl);
      if (!found.photo) {
        report.skipped.push({ title: dish.title, reason: found.reason });
        continue;
      }
      const photo = found.photo;
      const draft = await ai.runJson(
        { task: 'extract_recipe', system: SYSTEM, prompt: `Dish: ${dish.title}\nCuisine: ${dish.cuisine}\nMeal: ${dish.category}`, json: true, maxOutputTokens: 2500, temperature: 0.3 },
        aiSchema,
      );
      const nutrition = believableNutrition(draft.nutritionPerServing, draft.servings);
      if (!nutrition) {
        report.skipped.push({ title: dish.title, reason: 'the nutrition estimate was not believable' });
        continue;
      }
      const imageUrl = await store(storage, `seed/${slug(dish.title)}.${photo.mime === 'image/png' ? 'png' : 'jpg'}`, photo, fetchImpl);
      const input: CreateRecipeRequest = {
        title: dish.title,
        description: photo.credit ? `${draft.description}\n\n${photo.credit}` : draft.description,
        imageUrl,
        category: dish.category,
        cuisine: (CUISINES as readonly string[]).includes(dish.cuisine) ? dish.cuisine : 'other',
        difficulty: draft.difficulty,
        prepTime: draft.prepTime,
        cookTime: draft.cookTime,
        servings: draft.servings,
        ingredients: draft.ingredients.map((i) => ({ name: i.name.trim(), amount: i.amount, unit: i.unit.trim(), ...(i.optional ? { optional: true } : {}) })),
        instructions: draft.instructions.map((s) => s.trim()),
        ...(draft.tags ? { tags: draft.tags } : {}),
        ...(draft.dietaryFlags ? { dietaryFlags: draft.dietaryFlags } : {}),
        ...(draft.allergens ? { allergens: draft.allergens } : {}),
        isOfficial: true,
      };
      const row = await recipes.create({ userId: authorId, role: 'admin' }, input);
      // The server's own calorie table does not know every ingredient, so the checked estimate is what is stored.
      await db.recipe.update({ where: { id: row.id }, data: { nutrition, caloriesPerServing: nutrition.caloriesPerServing } });
      await house.post(authorId, {
        kind: 'recipe',
        title: draft.postTitle,
        caption: draft.postCaption,
        meta: `${draft.prepTime + draft.cookTime} min · ${draft.difficulty[0]?.toUpperCase()}${draft.difficulty.slice(1)}`,
        recipeId: row.id,
        photoUrl: imageUrl,
      });
      report.posts++;
      report.created.push(dish.title);
      made++;
      byHouse.set(dish.house, [...(byHouse.get(dish.house) ?? []), { id: row.id, title: dish.title, imageUrl }]);
      say(`added ${dish.title}`);
    } catch (err) {
      report.skipped.push({ title: dish.title, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  if (!options.dryRun) {
    for (const [key, list] of byHouse) {
      const def = HOUSES[key];
      const owner = ids.get(key);
      if (owner) {
        const account = await db.user.findUnique({ where: { id: owner }, select: { photoUrl: true } });
        if (!account?.photoUrl && list[0]) await db.user.update({ where: { id: owner }, data: { photoUrl: list[0].imageUrl } });
      }
      if (!def) continue;
      const title = `${def.displayName.replace(/^enplace /, '')} Favourites`;
      if (list.length >= 4 && !(await db.cookbook.findFirst({ where: { title }, select: { id: true } }))) {
        await cookbooks.create({ title, description: def.bio.replace(' An official enplace account.', ''), coverImageUrl: list[0]!.imageUrl, recipeIds: list.map((r) => r.id) });
        report.cookbooks++;
      }
    }
  }
  return report;
}

const puzzleSchema = z.object({
  answer: z.string().trim().min(3).max(60),
  aliases: z.array(z.string().trim().min(2).max(60)).max(6).default([]),
  clues: z.array(z.string().trim().min(8).max(160)).length(6),
});

const PUZZLE_SYSTEM = `You write the Daily Dish puzzle for a cooking app. Each puzzle is one well-known dish from around the world. It has six clues, hardest first: the first is vague (history, region or technique), the last nearly gives it away; no clue contains the dish's name; every clue is true.
Return only JSON: {"puzzles": [{"answer": the dish name in its common English form, "aliases": other names people might type, "clues": [six strings]}]}`;

/**
 * More Daily Dish puzzles, written by the model and added after the ones already there (never the same dish twice), so the
 * daily game does not run out or repeat. Returns how many were added.
 */
export async function generatePuzzles(db: Db, ai: AiRouter, target: number, say: (line: string) => void = () => undefined): Promise<number> {
  const { DailyDishService } = await import('../play/dailyDish');
  const service = new DailyDishService(db);
  const existing = await service.listPuzzles();
  const have = new Set(existing.map((p) => p.answer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
  const added: z.infer<typeof puzzleSchema>[] = [];
  for (let round = 0; round < 8 && existing.length + added.length < target; round++) {
    const asked = Math.min(25, target - existing.length - added.length + 5);
    const raw = await ai.runJson(
      { task: 'game_content', system: PUZZLE_SYSTEM, prompt: `Write ${asked} puzzles for dishes from many different countries. Do not use any of these dishes: ${[...have].slice(0, 120).join(', ')}.`, json: true, maxOutputTokens: 6000, temperature: 0.8 },
      z.object({ puzzles: z.array(z.unknown()).min(1) }),
    );
    for (const candidate of raw.puzzles) {
      const parsed = puzzleSchema.safeParse(candidate);
      if (!parsed.success) continue;
      const key = parsed.data.answer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (have.has(key)) continue;
      const name = parsed.data.answer.toLowerCase();
      if (parsed.data.clues.some((c) => c.toLowerCase().includes(name))) continue; // a clue that names the dish gives it away
      have.add(key);
      added.push(parsed.data);
    }
    say(`puzzles: ${existing.length + added.length} of ${target}`);
  }
  if (added.length > 0) {
    await service.setPuzzles([
      ...existing.map((p) => ({ answer: p.answer, aliases: p.aliases, clues: p.clues, ...(p.photoUrl ? { photoUrl: p.photoUrl } : {}) })),
      ...added,
    ]);
  }
  return added.length;
}

/**
 * Gives Daily Dish puzzles a real photo of the answer (shown when the game is over): the lead picture of the dish's Wikipedia
 * article, free licences only, checked by a vision model, stored on our own file store. A puzzle with no verified photo is left
 * without one. Returns how many were given a photo. Safe to run again.
 */
export async function backfillPuzzlePhotos(
  db: Db,
  ai: AiRouter,
  storage: Storage,
  say: (line: string) => void = () => undefined,
  options: { fetchImpl?: typeof fetch; pauseMs?: number; limit?: number } = {},
): Promise<number> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const todo = await db.dailyPuzzle.findMany({ where: { photoUrl: null }, orderBy: { position: 'asc' }, take: options.limit ?? 40 });
  let added = 0;
  for (const puzzle of todo) {
    try {
      const photo = await findWikipediaPhoto(puzzle.answer, fetchImpl);
      if (photo && (await photoShows(ai, puzzle.answer, photo))) {
        const url = await store(storage, `daily/${slug(puzzle.answer)}.jpg`, photo, fetchImpl);
        await db.dailyPuzzle.update({ where: { position: puzzle.position }, data: { photoUrl: url } });
        added += 1;
        say(`photo: ${puzzle.answer}`);
      } else {
        say(`no photo: ${puzzle.answer}`);
      }
    } catch (err) {
      say(`photo failed for ${puzzle.answer}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (options.pauseMs) await new Promise((r) => setTimeout(r, options.pauseMs));
  }
  return added;
}

/**
 * Photos from a Wikimedia Commons search (free licences only, wide enough to use), best first. For questions about an
 * ingredient or technique whose Wikipedia article has no usable lead picture. Returns up to `max` candidates.
 */
export async function findCommonsPhotos(query: string, fetchImpl: typeof fetch = fetch, max = 3): Promise<Photo[]> {
  const get = async (url: string) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) return res;
      if (res.status !== 429 || attempt >= 3) throw new Error(`${res.status}`);
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  };
  const search = (await (
    await get(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1000`,
    )
  ).json()) as {
    query?: { pages?: Record<string, { index?: number; imageinfo?: { thumburl?: string; width?: number; mime?: string; extmetadata?: Record<string, { value?: string }> }[]; title?: string }> };
  };
  const pages = Object.values(search.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const out: Photo[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const licence = info?.extmetadata?.['LicenseShortName']?.value ?? '';
    if (!info?.thumburl || !FREE_LICENSE.test(licence) || !/^image\/(jpeg|png)$/.test(info.mime ?? '') || (info.width ?? 0) < 700) continue;
    // Skip files whose name says they are not a photograph of the thing.
    if (/\b(map|diagram|logo|icon|flag|svg|chart|graph|drawing|illustration|painting|label|packag)/i.test(page.title ?? '')) continue;
    try {
      const img = await get(info.thumburl);
      const bytes = Buffer.from(await img.arrayBuffer());
      if (bytes.byteLength < 20_000 || bytes.byteLength > 3_500_000) continue;
      const author = stripTags(info.extmetadata?.['Artist']?.value ?? '') || 'Wikimedia Commons contributor';
      out.push({
        bytes,
        mime: info.thumburl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        credit: NEEDS_CREDIT.test(licence) ? `Photo: ${author.slice(0, 80)} (${licence}), Wikimedia Commons` : null,
        source: `https://commons.wikimedia.org/wiki/${encodeURIComponent((page.title ?? '').replace(/ /g, '_'))}`,
      });
    } catch {
      // try the next candidate
    }
    if (out.length >= max) break;
  }
  return out;
}
