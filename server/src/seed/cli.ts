// Starter content for a fresh server.
//
//   npm run seed                           add anything missing
//   npm run seed -- --dry-run              say what would be added, change nothing
//   npm run seed -- --admin me@example.com make an existing account staff (register in the app first)
//
// Uses DATABASE_URL. Safe to run again.
import { createDb } from '../db';
import { seedContent } from './run';

async function main() {
  const args = process.argv.slice(2);
  const adminAt = args.indexOf('--admin');
  const adminEmail = adminAt >= 0 ? args[adminAt + 1] : undefined;
  if (adminAt >= 0 && (!adminEmail || adminEmail.startsWith('--'))) throw new Error('--admin needs an email address');
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');

  const db = createDb(url, 2);
  try {
    const report = await seedContent(db, { dryRun: args.includes('--dry-run'), ...(adminEmail ? { adminEmail } : {}) }, (line) => process.stdout.write(`${line}\n`));
    process.stdout.write(`\n${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
