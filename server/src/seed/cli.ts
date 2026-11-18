// Starter content for a fresh server.
//
//   npm run seed                           add anything missing
//   npm run seed -- --dry-run              say what would be added, change nothing
//   npm run seed -- --admin me@example.com make an existing account staff (register in the app first)
//   npm run seed -- --pro me@example.com   give an existing account a Pro plan for 30 days (test hosts only)
//   npm run seed -- --reset-generated      delete the recipes (and their posts) that --generate wrote, to write them again
//   npm run seed -- --puzzles N            write Daily Dish puzzles until there are N (and stock the generated games)
//   npm run seed -- --puzzle-photos [N]    give Daily Dish puzzles a real photo of the answer, N at a time (default 20)
//   npm run seed -- --photos [N]           give game questions a real photo, N at a time (default 30; run again for the next batch;
//                                          add --retry to look again at questions that found none before)
//   npm run seed -- --rephoto "Title"      give one official recipe a new checked photo (its posts and covers follow)
//   npm run seed -- --generate [N]        write recipes with real photos from the dish list (needs the AI and file store settings; N at most)
//
// Uses DATABASE_URL. Safe to run again.
import { createDb } from '../db';
import { buildAiRouter } from '../ai/factory';
import { loadConfig } from '../config';
import { storageFromConfig } from '../storage/storage';
import dishList from '../../seed/dishes.json';
import { GamePoolService, POOL_GAMES } from '../play/pool';
import { backfillPuzzlePhotos, generateContent, generatePuzzles, rephotoDish, type DishDef } from './generate';
import { seedContent } from './run';

async function main() {
  const args = process.argv.slice(2);
  const adminAt = args.indexOf('--admin');
  const adminEmail = adminAt >= 0 ? args[adminAt + 1] : undefined;
  if (adminAt >= 0 && (!adminEmail || adminEmail.startsWith('--'))) throw new Error('--admin needs an email address');
  const proAt = args.indexOf('--pro');
  const proEmail = proAt >= 0 ? args[proAt + 1] : undefined;
  if (proAt >= 0 && (!proEmail || proEmail.startsWith('--'))) throw new Error('--pro needs an email address');
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');

  const db = createDb(url, 2);
  try {
    const report = await seedContent(db, { dryRun: args.includes('--dry-run'), ...(adminEmail ? { adminEmail } : {}), ...(proEmail ? { proEmail } : {}) }, (line) => process.stdout.write(`${line}\n`));
    process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
    if (args.includes('--report')) {
      // Where the content stands: recipes per official account (fewest first) and what the AI has cost this month.
      const accounts = await db.user.findMany({ where: { kind: 'HOUSE' }, select: { id: true, handle: true } });
      const counts = await db.recipe.groupBy({ by: ['authorId'], where: { author: { kind: 'HOUSE' } }, _count: { _all: true } });
      const per = new Map(counts.map((c) => [c.authorId, c._count._all]));
      const rows = accounts.map((a) => ({ handle: a.handle, recipes: per.get(a.id) ?? 0 })).sort((a, b) => a.recipes - b.recipes);
      const spent = await db.aiUsage.aggregate({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { costMicros: true } });
      const config = loadConfig(process.env);
      process.stdout.write(`accounts: ${rows.length}, recipes: ${rows.reduce((s, r) => s + r.recipes, 0)}, under 10: ${rows.filter((r) => r.recipes < 10).length}\n`);
      for (const r of rows) process.stdout.write(`${String(r.recipes).padStart(3)}  ${r.handle}\n`);
      process.stdout.write(`AI spent this month: $${((spent._sum.costMicros ?? 0) / 1_000_000).toFixed(2)} of $${config.AI_MONTHLY_BUDGET_USD}\n`);
    }
    const puzzlesAt = args.indexOf('--puzzles');
    if (puzzlesAt >= 0) {
      const target = Number(args[puzzlesAt + 1]);
      if (!Number.isFinite(target) || target < 1) throw new Error('--puzzles needs a number');
      const config = loadConfig(process.env);
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      const ai = buildAiRouter(config, db, log);
      const added = await generatePuzzles(db, ai, target, (line) => process.stdout.write(`${line}\n`));
      process.stdout.write(`added ${added} puzzles\n`);
      const pool = new GamePoolService(db, ai, undefined, undefined, false, { storage: storageFromConfig(config), pauseMs: 2500 });
      for (const game of POOL_GAMES) {
        try {
          process.stdout.write(`${game}: +${await pool.refill(game)} questions\n`);
        } catch (err) {
          process.stdout.write(`${game}: ${err instanceof Error ? err.message : String(err)}\n`);
        }
      }
    }
    const puzzlePhotosAt = args.indexOf('--puzzle-photos');
    if (puzzlePhotosAt >= 0) {
      // Real photos of the answers to Daily Dish puzzles that have none: N at a time (default 20).
      const config = loadConfig(process.env);
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      const storage = storageFromConfig(config);
      if (!storage) throw new Error('--puzzle-photos needs the file store settings');
      const added = await backfillPuzzlePhotos(db, buildAiRouter(config, db, log), storage, (line) => process.stdout.write(`${line}\n`), { pauseMs: 2500, limit: Number(args[puzzlePhotosAt + 1]) || 20 });
      process.stdout.write(`puzzle photos added: ${added}\n`);
    }
    const photosAt = args.indexOf('--photos');
    if (photosAt >= 0) {
      // Real photos for game questions that have none: N at a time (default 30), until the batch is done.
      const batch = Number(args[photosAt + 1]) || 30;
      const config = loadConfig(process.env);
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      const pool = new GamePoolService(db, buildAiRouter(config, db, log), undefined, undefined, false, { storage: storageFromConfig(config), pauseMs: 2500 });
      const total = await db.gamePoolItem.count({ where: { photoTried: false, imageUrl: null } });
      process.stdout.write(`${total} questions still to look at\n`);
      process.stdout.write(`photos added: ${await pool.backfillPhotos(batch, { retry: args.includes('--retry') })}\n`);
    }
    if (args.includes('--reset-generated')) {
      const titles = (dishList as DishDef[]).map((d) => d.title);
      const ids = (await db.recipe.findMany({ where: { title: { in: titles }, author: { kind: 'HOUSE' } }, select: { id: true } })).map((r) => r.id);
      await db.post.deleteMany({ where: { recipeId: { in: ids } } });
      await db.cookbook.deleteMany({ where: { title: { endsWith: ' Favourites' } } });
      const gone = await db.recipe.deleteMany({ where: { id: { in: ids } } });
      process.stdout.write(`removed ${gone.count} generated recipes\n`);
    }
    const rephotoAt = args.indexOf('--rephoto');
    if (rephotoAt >= 0) {
      const title = args[rephotoAt + 1];
      if (!title || title.startsWith('--')) throw new Error('--rephoto needs a recipe title in quotes');
      const config = loadConfig(process.env);
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      process.stdout.write(`${await rephotoDish({ db, ai: buildAiRouter(config, db, log), storage: storageFromConfig(config) }, dishList as DishDef[], title)}\n`);
    }
    const genAt = args.indexOf('--generate');
    if (genAt >= 0) {
      const limitArg = Number(args[genAt + 1]);
      const config = loadConfig(process.env);
      const dishes = dishList as DishDef[];
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      const made = await generateContent(
        { db, ai: buildAiRouter(config, db, log), storage: storageFromConfig(config), say: (line) => process.stdout.write(`${line}\n`) },
        dishes,
        { ...(Number.isFinite(limitArg) && limitArg > 0 ? { limit: limitArg } : {}), dryRun: args.includes('--dry-run'), pauseMs: 2500 },
      );
      process.stdout.write(`\n${JSON.stringify(made, null, 2)}\n`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
