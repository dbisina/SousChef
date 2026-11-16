import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { HealthExport } from '@shared';
import { loadConfig } from '../src/config';
import { HealthCipher, parseOldKeys } from '../src/vitals/crypto';
import { VitalsService } from '../src/vitals/service';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

const keyA = Buffer.alloc(32, 7).toString('base64'); // what the test app uses as its current key (id 1)
const keyB = Buffer.alloc(32, 9).toString('base64');

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

describe('the key ring', () => {
  it('opens old data with the old key, seals new data with the current key, and reseals old data', () => {
    const old = HealthCipher.fromKeys(keyA, 1, '') as HealthCipher;
    const sealedOld = old.seal({ mmol: 6.1 }, 'u:r');
    expect(HealthCipher.keyIdOf(sealedOld)).toBe(1);

    const next = HealthCipher.fromKeys(keyB, 2, `1:${keyA}`) as HealthCipher;
    expect(next.open(sealedOld, 'u:r')).toEqual({ mmol: 6.1 });
    const fresh = next.seal({ mmol: 7 }, 'u:r');
    expect(HealthCipher.keyIdOf(fresh)).toBe(2);
    const moved = next.reseal(sealedOld, 'u:r');
    expect(HealthCipher.keyIdOf(moved)).toBe(2);
    expect(next.open(moved, 'u:r')).toEqual({ mmol: 6.1 });
  });

  it('cannot open data sealed with a key that is not in the ring, and a resealed value no longer opens with only the old key', () => {
    const old = HealthCipher.fromKeys(keyA, 1, '') as HealthCipher;
    const next = HealthCipher.fromKeys(keyB, 2, `1:${keyA}`) as HealthCipher;
    const onlyNew = HealthCipher.fromKeys(keyB, 2, '') as HealthCipher;
    const sealedOld = old.seal({ a: 1 }, 'x');
    expect(() => onlyNew.open(sealedOld, 'x')).toThrow(); // old key was removed too early
    expect(() => old.open(next.reseal(sealedOld, 'x'), 'x')).toThrow();
    expect(() => next.open(sealedOld, 'other-label')).toThrow(); // still bound to its row
  });

  it('checks the key settings', () => {
    expect(parseOldKeys(`1:${keyA}, 3:${keyB}`).size).toBe(2);
    expect(() => parseOldKeys('nonsense')).toThrow();
    expect(() => parseOldKeys(`0:${keyA}`)).toThrow();
    expect(() => HealthCipher.fromKeys(keyB, 300, '')).toThrow();
    expect(() => HealthCipher.fromKeys(keyB, 2, `1:${Buffer.alloc(8).toString('base64')}`)).toThrow();
    expect(HealthCipher.fromKeys('', 1, '')).toBeNull();
  });

  it('is read from the settings, and bad settings stop the server starting', () => {
    const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32), HEALTH_DATA_KEY: keyB };
    const ok = loadConfig({ ...base, HEALTH_DATA_KEY_ID: '2', HEALTH_DATA_OLD_KEYS: `1:${keyA}` });
    expect(ok.HEALTH_DATA_KEY_ID).toBe(2);
    expect(() => loadConfig({ ...base, HEALTH_DATA_OLD_KEYS: 'garbage' })).toThrow();
    expect(() => loadConfig({ ...base, HEALTH_DATA_KEY_ID: '0' })).toThrow();
  });
});

describe('rewriting stored data with the new key', () => {
  async function seeded() {
    const who = await register(t);
    expect((await call(t, 'PUT', '/v1/health/consent', who, { version: '2026-11-01' })).statusCode).toBe(200);
    const at = new Date(Date.now() - 3_600_000).toISOString();
    const meal = (await call(t, 'POST', '/v1/health/meals', who, { title: 'Rice', mealType: 'Lunch', at, carbsG: 60, portionLabel: '1 plate', group: 'Rice bowls' })).json<{ id: string }>();
    for (const mmol of [5.5, 8.1]) await call(t, 'POST', '/v1/health/readings', who, { kind: 'glucose', mmol, timing: 'before-meal', at, mealId: meal.id });
    return who;
  }
  const firstBytes = async (table: 'HealthReading' | 'HealthMeal') => (await t.db.$queryRawUnsafe<{ b: number }[]>(`SELECT get_byte(payload, 0) AS b FROM "${table}"`)).map((r) => Number(r.b));

  it('moves every reading and meal to the new key, in small batches, and can be run again safely', async () => {
    const who = await seeded();
    expect(await firstBytes('HealthReading')).toEqual([1, 1]);
    const next = new VitalsService(t.db, HealthCipher.fromKeys(keyB, 2, `1:${keyA}`));

    // before rewriting, the new setup still reads old data
    expect((await next.export(who.user.id)).readings).toHaveLength(2);

    const first = await next.reseal(1);
    expect(first.resealed).toBe(2); // one reading and one meal per batch of 1
    expect(first.remaining).toBe(1);
    const second = await next.reseal(10);
    expect(second).toEqual({ resealed: 1, remaining: 0 });
    expect(await next.reseal()).toEqual({ resealed: 0, remaining: 0 });

    expect(await firstBytes('HealthReading')).toEqual([2, 2]);
    expect(await firstBytes('HealthMeal')).toEqual([2]);
    // the numbers survive, and only the new key is needed now
    const after = new VitalsService(t.db, HealthCipher.fromKeys(keyB, 2, ''));
    const out: HealthExport = await after.export(who.user.id);
    expect(out.readings.flatMap((r) => ('mmol' in r ? [r.mmol] : [])).sort()).toEqual([5.5, 8.1]);
    expect(out.meals[0]?.carbsG).toBe(60);
  });

  it('reports rows it cannot rewrite when an old key is missing, instead of losing them', async () => {
    await seeded();
    const noOld = new VitalsService(t.db, HealthCipher.fromKeys(keyB, 2, ''));
    await expect(noOld.reseal()).rejects.toThrow(); // the key that sealed them is gone: nothing is changed
    expect(await firstBytes('HealthReading')).toEqual([1, 1]);
  });
});
