// Key rotation for saved health readings and meals:  node dist/resealHealth.js
//
//  1. Put the new key in HEALTH_DATA_KEY with a new HEALTH_DATA_KEY_ID, and move the old one into HEALTH_DATA_OLD_KEYS ("1:oldbase64").
//  2. Restart the server (new data is now sealed with the new key; old data still opens).
//  3. Run this until it prints remaining: 0.
//  4. Then the old key can be removed from HEALTH_DATA_OLD_KEYS. Keep a copy of it somewhere safe for old backups.
import { loadConfig } from './config';
import { createDb } from './db';
import { HealthCipher } from './vitals/crypto';
import { VitalsService } from './vitals/service';

async function main() {
  const config = loadConfig();
  const cipher = HealthCipher.fromKeys(config.HEALTH_DATA_KEY, config.HEALTH_DATA_KEY_ID, config.HEALTH_DATA_OLD_KEYS);
  if (!cipher) throw new Error('HEALTH_DATA_KEY is not set, so there is nothing to rotate');
  const db = createDb(config.DATABASE_URL, 2);
  try {
    const vitals = new VitalsService(db, cipher);
    let total = 0;
    for (;;) {
      const { resealed, remaining } = await vitals.reseal();
      total += resealed;
      process.stdout.write(`resealed ${total}, remaining ${remaining}\n`);
      if (remaining === 0 || resealed === 0) {
        if (remaining > 0) process.stderr.write('Some rows could not be rewritten: their key is missing from HEALTH_DATA_OLD_KEYS.\n');
        process.exitCode = remaining === 0 ? 0 : 1;
        break;
      }
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
