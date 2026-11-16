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

const UA = 'SousChefSeed/1.0 (recipe app content seeding)';
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
  postTitle: z.string().min(3).max(70),
  postCaption: z.string().min(20).max(300),
});

const SYSTEM = `You are a professional recipe developer writing for a cooking app. Write one accurate, tested-quality recipe for the dish you are given.
Rules: real, sensible quantities for the stated servings; metric or common kitchen units (g, ml, tbsp, tsp, cup, piece, clove, pinch); every step names the heat, the time or the sign that it is done; no invented health claims; nothing unsafe.
Return only JSON: {"description": one or two inviting sentences, "servings": number, "prepTime": minutes, "cookTime": minutes, "difficulty": "easy"|"medium"|"hard", "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string], "tags": [string], "dietaryFlags": subset of ["vegetarian","vegan","gluten-free","dairy-free","nut-free"], "allergens": subset of ["gluten","dairy","eggs","nuts","peanuts","soy","fish","shellfish","sesame"], "postTitle": a short friendly headline, "postCaption": two sentences of practical advice for cooking it well}.`;

interface Photo {
  bytes: Buffer;
  mime: string;
  /** Text to credit the photographer with, or null when the licence asks for none. */
  credit: string | null;
  source: string;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** The lead picture of the dish's Wikipedia article, if its licence allows reuse. Null if not. */
export async function findWikipediaPhoto(wiki: string, fetchImpl: typeof fetch = fetch): Promise<Photo | null> {
  const get = async (url: string) => {
    const res = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res;
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

/** Asks a model that can see whether the picture really shows the dish (a lead image can be a map, a diagram or a person). */
export async function photoShows(ai: AiRouter, title: string, photo: Photo): Promise<boolean> {
  try {
    const v = await ai.runJson(
      {
        task: 'judge_plate',
        system: 'You check food photos. Answer only with JSON.',
        prompt: `Does this photo clearly show the dish "${title}" as a finished plate or serving of food (not a diagram, map, ingredients only, packaging or a person)? Return {"match": true|false, "reason": "..."}.`,
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

async function store(storage: Storage, key: string, photo: Photo, fetchImpl: typeof fetch): Promise<string> {
  const signed = await storage.presignUpload({ key, contentType: photo.mime, expiresSeconds: 600 });
  const res = await fetchImpl(signed.url, { method: 'PUT', headers: signed.headers, body: new Uint8Array(photo.bytes) });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return storage.publicUrl(key);
}

/**
 * Real recipes from the dish list: one model-written recipe per dish (checked against the server's own recipe rules), with a
 * real photo of the dish from Wikipedia (free licences only, checked by a vision model, stored on our own file store so the link
 * never dies). A dish with no verified photo is skipped, never faked. Then a cookbook per official account, and a post for
 * every recipe from the account that owns it. Safe to run again: dishes already there are left alone.
 */
export async function generateContent(deps: GenerateDeps, dishes: DishDef[], options: { limit?: number; dryRun?: boolean } = {}): Promise<GenerateReport> {
  const { db, ai, storage } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const say = deps.say ?? (() => undefined);
  const report: GenerateReport = { created: [], existing: 0, skipped: [], cookbooks: 0, posts: 0 };
  if (!storage) throw new Error('Photos need the file store (S3_* settings). Set it up first.');

  const house = new HouseService(db);
  const recipes = new RecipeService(db, new EntitlementService(db));
  const cookbooks = new CookbookService(db);
  const ids = new Map<HouseKey, string>();
  for (const key of Object.keys(HOUSES) as HouseKey[]) {
    const found = await db.user.findFirst({ where: { handle: HOUSES[key].handle, kind: 'HOUSE' }, select: { id: true } });
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
    try {
      const photo = await findWikipediaPhoto(dish.wiki, fetchImpl);
      if (!photo) {
        report.skipped.push({ title: dish.title, reason: 'no freely licensed photo found' });
        continue;
      }
      if (!(await photoShows(ai, dish.title, photo))) {
        report.skipped.push({ title: dish.title, reason: 'the photo does not clearly show the dish' });
        continue;
      }
      const draft = await ai.runJson(
        { task: 'extract_recipe', system: SYSTEM, prompt: `Dish: ${dish.title}\nCuisine: ${dish.cuisine}\nMeal: ${dish.category}`, json: true, maxOutputTokens: 2500, temperature: 0.3 },
        aiSchema,
      );
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
      const title = `${def.displayName.replace(/^SousChef /, '')} Favourites`;
      if (list.length >= 4 && !(await db.cookbook.findFirst({ where: { title }, select: { id: true } }))) {
        await cookbooks.create({ title, description: def.bio.replace(' An official SousChef account.', ''), coverImageUrl: list[0]!.imageUrl, recipeIds: list.map((r) => r.id) });
        report.cookbooks++;
      }
    }
  }
  return report;
}
