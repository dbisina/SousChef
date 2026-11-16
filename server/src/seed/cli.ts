// Starter content for a fresh server.
//
//   npm run seed                           add anything missing
//   npm run seed -- --dry-run              say what would be added, change nothing
//   npm run seed -- --admin me@example.com make an existing account staff (register in the app first)
//   npm run seed -- --pro me@example.com   give an existing account a Pro plan for 30 days (test hosts only)
//   npm run seed -- --reset-generated      delete the recipes (and their posts) that --generate wrote, to write them again
//   npm run seed -- --puzzles N            write Daily Dish puzzles until there are N (and stock the generated games)
//   npm run seed -- --photos [N]           give game questions a real photo, N at a time (default 30; run again for the next batch)
//   npm run seed -- --generate [N]         write recipes with real photos from the dish list (needs the AI and file store settings; N at most)
//
// Uses DATABASE_URL. Safe to run again.
import { createDb } from '../db';
import { buildAiRouter } from '../ai/factory';
import { loadConfig } from '../config';
import { storageFromConfig } from '../storage/storage';
import dishList from '../../seed/dishes.json';
import { GamePoolService, POOL_GAMES } from '../play/pool';
import { generateContent, generatePuzzles, type DishDef } from './generate';
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
    const photosAt = args.indexOf('--photos');
    if (photosAt >= 0) {
      // Real photos for game questions that have none: N at a time (default 30), until the batch is done.
      const batch = Number(args[photosAt + 1]) || 30;
      const config = loadConfig(process.env);
      const log = { warn: (m: unknown) => process.stderr.write(`${typeof m === 'string' ? m : JSON.stringify(m)}\n`) };
      const pool = new GamePoolService(db, buildAiRouter(config, db, log), undefined, undefined, false, { storage: storageFromConfig(config), pauseMs: 2500 });
      const total = await db.gamePoolItem.count({ where: { photoTried: false, imageUrl: null } });
      process.stdout.write(`${total} questions still to look at\n`);
      process.stdout.write(`photos added: ${await pool.backfillPhotos(batch)}\n`);
    }
    if (args.includes('--reset-generated')) {
      const titles = (dishList as DishDef[]).map((d) => d.title);
      const ids = (await db.recipe.findMany({ where: { title: { in: titles }, author: { kind: 'HOUSE' } }, select: { id: true } })).map((r) => r.id);
      await db.post.deleteMany({ where: { recipeId: { in: ids } } });
      await db.cookbook.deleteMany({ where: { title: { endsWith: ' Favourites' } } });
      const gone = await db.recipe.deleteMany({ where: { id: { in: ids } } });
      process.stdout.write(`removed ${gone.count} generated recipes\n`);
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
