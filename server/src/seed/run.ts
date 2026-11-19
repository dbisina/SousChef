import type { CreateRecipeRequest } from '@shared';
import { CookbookService } from '../cookbooks/service';
import type { Db } from '../db';
import { HouseService } from '../invites/house';
import { DailyDishService } from '../play/dailyDish';
import { RecipeService } from '../recipes/service';
import { EntitlementService } from '../subscriptions/service';
import content from '../../seed/content.json';
import { HOUSES, HOUSE_POSTS, PUZZLES, type HouseKey } from './copy';

type SeedRecipe = Omit<CreateRecipeRequest, 'isOfficial' | 'status'> & { house: HouseKey };
interface SeedCookbook {
  title: string;
  description: string;
  coverImageUrl: string;
  category?: string;
  recipes: string[];
}

export interface SeedOptions {
  /** Say what would happen; write nothing. */
  dryRun?: boolean;
  /** Make this existing account staff. */
  adminEmail?: string;
  /** Give this existing account a Pro plan for 30 days (for trying a test host; no payment involved). */
  proEmail?: string;
}

export interface SeedReport {
  houses: { created: number; existing: number };
  recipes: { created: number; existing: number };
  cookbooks: { created: number; existing: number };
  posts: { created: number; existing: number };
  puzzles: 'set' | 'kept' | 'would-set';
  /** Photos whose address changed in the seed data and were updated on things that already existed. */
  photosRefreshed: number;
  admin: string | null;
  pro: string | null;
}

const tally = () => ({ created: 0, existing: 0 });

/**
 * Starter content for a fresh server: the official enplace accounts, the recipes and cookbooks that used to live in
 * Firestore (once each, under those accounts), a few posts, and the first Daily Dish puzzles. Safe to run again: it only
 * adds what is missing and never touches puzzles staff have already set.
 */
export async function seedContent(db: Db, options: SeedOptions = {}, say: (line: string) => void = () => undefined): Promise<SeedReport> {
  const dry = options.dryRun === true;
  const report: SeedReport = { houses: tally(), recipes: tally(), cookbooks: tally(), posts: tally(), puzzles: 'kept', photosRefreshed: 0, admin: null, pro: null };
  const house = new HouseService(db);
  const recipes = new RecipeService(db, new EntitlementService(db));
  const cookbooks = new CookbookService(db);
  const staff = (userId: string) => ({ userId, role: 'admin' as const });
  const data = content as unknown as { recipes: SeedRecipe[]; cookbooks: SeedCookbook[] };

  // 1. Official accounts
  const houseIds = new Map<HouseKey, string>();
  for (const [key, def] of Object.entries(HOUSES)) {
    const found = await db.user.findFirst({ where: { handle: { in: [def.handle, def.legacyHandle] }, kind: 'HOUSE' }, select: { id: true, handle: true, displayName: true, bio: true } });
    if (found) {
      // An account made under the old name is renamed in place (same id, so followers and posts stay).
      if (!dry && (found.handle !== def.handle || found.displayName !== def.displayName || found.bio !== def.bio)) {
        await db.user.update({ where: { id: found.id }, data: { handle: def.handle, displayName: def.displayName, bio: def.bio } });
      }
      houseIds.set(key, found.id);
      report.houses.existing++;
      continue;
    }
    report.houses.created++;
    say(`${dry ? 'would create' : 'creating'} official account ${def.displayName}`);
    if (!dry) {
      const photo = data.recipes.find((r) => r.house === key)?.imageUrl; // the newer accounts get theirs from their first generated recipe
      const made = await house.create({ displayName: def.displayName, handle: def.handle, bio: def.bio, ...(photo ? { photoUrl: photo } : {}) });
      houseIds.set(key, made.user.id);
    }
  }

  // 2. Recipes (official, under the account that fits)
  const recipeIds = new Map<string, string>();
  for (const r of data.recipes) {
    const authorId = houseIds.get(r.house);
    const existing = authorId ? await db.recipe.findFirst({ where: { authorId, title: r.title }, select: { id: true, imageUrl: true } }) : null;
    if (existing) {
      recipeIds.set(r.title, existing.id);
      report.recipes.existing++;
      // A photo link that has since gone dead is fixed in the seed data; keep what is already saved in step.
      if (existing.imageUrl !== r.imageUrl) {
        report.photosRefreshed++;
        if (!dry) await db.recipe.update({ where: { id: existing.id }, data: { imageUrl: r.imageUrl } });
      }
      continue;
    }
    report.recipes.created++;
    say(`${dry ? 'would add' : 'adding'} recipe ${r.title}`);
    if (!dry && authorId) {
      const { house: _house, ...input } = r;
      const made = await recipes.create(staff(authorId), { ...input, isOfficial: true });
      recipeIds.set(r.title, made.id);
    }
  }

  // 3. Cookbooks
  for (const c of data.cookbooks) {
    const have = await db.cookbook.findFirst({ where: { title: c.title }, select: { id: true, coverImageUrl: true } });
    if (have) {
      report.cookbooks.existing++;
      if (have.coverImageUrl !== c.coverImageUrl) {
        report.photosRefreshed++;
        if (!dry) await db.cookbook.update({ where: { id: have.id }, data: { coverImageUrl: c.coverImageUrl } });
      }
      continue;
    }
    report.cookbooks.created++;
    say(`${dry ? 'would add' : 'adding'} cookbook ${c.title}`);
    if (!dry) {
      const ids = c.recipes.map((t) => recipeIds.get(t)).filter((id): id is string => id !== undefined);
      await cookbooks.create({ title: c.title, description: c.description, coverImageUrl: c.coverImageUrl, ...(c.category ? { category: c.category } : {}), recipeIds: ids });
    }
  }

  // 4. Posts from the official accounts
  for (const p of HOUSE_POSTS) {
    const recipe = data.recipes.find((r) => r.title === p.recipe);
    if (!recipe) continue;
    const accountId = houseIds.get(recipe.house);
    const exists = accountId ? await db.post.findFirst({ where: { authorId: accountId, title: p.title }, select: { id: true, photoUrl: true } }) : null;
    if (exists) {
      report.posts.existing++;
      if (exists.photoUrl !== recipe.imageUrl) {
        report.photosRefreshed++;
        if (!dry) await db.post.update({ where: { id: exists.id }, data: { photoUrl: recipe.imageUrl } });
      }
      continue;
    }
    report.posts.created++;
    say(`${dry ? 'would post' : 'posting'} "${p.title}"`);
    const recipeId = recipeIds.get(p.recipe);
    if (!dry && accountId && recipeId) {
      const minutes = recipe.prepTime + recipe.cookTime;
      await house.post(accountId, { kind: 'recipe', title: p.title, caption: p.caption, meta: `${minutes} min · ${recipe.difficulty[0]?.toUpperCase()}${recipe.difficulty.slice(1)}`, recipeId, photoUrl: recipe.imageUrl });
    }
  }

  // 5. Daily Dish puzzles, only if nobody has set any yet
  if ((await db.dailyPuzzle.count()) === 0) {
    report.puzzles = dry ? 'would-set' : 'set';
    say(`${dry ? 'would set' : 'setting'} ${PUZZLES.length} Daily Dish puzzles`);
    if (!dry) await new DailyDishService(db).setPuzzles(PUZZLES);
  }

  // 6. Staff access for an account that already exists
  if (options.adminEmail) {
    const email = options.adminEmail.trim();
    const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, kind: 'PERSON' }, select: { id: true, role: true } });
    if (!user) throw new Error(`No account with that email yet. Register in the app first, then run this again.`);
    if (user.role !== 'ADMIN') {
      say(`${dry ? 'would make' : 'making'} ${email} staff`);
      if (!dry) await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    }
    report.admin = email;
  }

  // 7. A Pro plan for a test account
  if (options.proEmail) {
    const email = options.proEmail.trim();
    const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, kind: 'PERSON' }, select: { id: true } });
    if (!user) throw new Error('No account with that email yet. Register in the app first, then run this again.');
    say(`${dry ? 'would give' : 'giving'} ${email} a Pro plan for 30 days`);
    if (!dry) {
      const now = new Date();
      const data = { tier: 'pro', status: 'ACTIVE' as const, willRenew: false, expiresAt: new Date(now.getTime() + 30 * 86_400_000), lastEventAt: now };
      await db.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    }
    report.pro = email;
  }
  return report;
}
