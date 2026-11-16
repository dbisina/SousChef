import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDoctorReport,
  glucoseStatus,
  mealRise,
  timeInRange,
  type DoctorReport,
  type HealthConsentState,
  type HealthExport,
  type HealthReading,
  type MealLog,
  type MealResponse,
  type ReadingsPage,
} from '@shared';
import { HealthCipher } from '../src/vitals/crypto';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

type Who = Awaited<ReturnType<typeof register>>;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

async function consenting(): Promise<Who> {
  const who = await register(t);
  const res = await call(t, 'PUT', '/v1/health/consent', who, { version: '2026-11-01' });
  if (res.statusCode !== 200) throw new Error(`consent failed: ${res.statusCode} ${res.body}`);
  return who;
}
const glucose = (who: Who, mmol: number, timing: string, at = hoursAgo(1), extra: object = {}) =>
  call(t, 'POST', '/v1/health/readings', who, { kind: 'glucose', mmol, timing, at, ...extra });
const meal = async (who: Who, overrides: object = {}) => {
  const res = await call(t, 'POST', '/v1/health/meals', who, { title: 'Jollof and chicken', mealType: 'Lunch', at: hoursAgo(3), carbsG: 70, portionLabel: '1 plate', group: 'Rice bowls', ...overrides });
  if (res.statusCode !== 201) throw new Error(`meal failed: ${res.statusCode} ${res.body}`);
  return res.json<MealLog>();
};

describe('the cipher', () => {
  const key = Buffer.alloc(32, 1).toString('base64');
  const cipher = HealthCipher.fromBase64(key) as HealthCipher;

  it('seals and opens a value, and never writes the value in the clear', () => {
    const sealed = cipher.seal({ mmol: 6.2, secret: 'insulin' }, 'u:r');
    expect(sealed.toString('utf8')).not.toContain('insulin');
    expect(cipher.open(sealed, 'u:r')).toEqual({ mmol: 6.2, secret: 'insulin' });
  });

  it('uses a fresh nonce each time', () => {
    expect(cipher.seal({ a: 1 }, 'x').equals(cipher.seal({ a: 1 }, 'x'))).toBe(false);
  });

  it('refuses data that was changed, moved to another row, or sealed with another key', () => {
    const sealed = cipher.seal({ a: 1 }, 'u:r');
    const flipped = Buffer.from(sealed);
    flipped[flipped.length - 1] = (flipped.at(-1) ?? 0) ^ 1;
    expect(() => cipher.open(flipped, 'u:r')).toThrow();
    expect(() => cipher.open(sealed, 'u:other')).toThrow();
    expect(() => (HealthCipher.fromBase64(Buffer.alloc(32, 2).toString('base64')) as HealthCipher).open(sealed, 'u:r')).toThrow();
    expect(() => cipher.open(Buffer.from([1, 2, 3]), 'u:r')).toThrow();
  });

  it('is off without a key and rejects a key of the wrong size', () => {
    expect(HealthCipher.fromBase64('')).toBeNull();
    expect(() => HealthCipher.fromBase64(Buffer.alloc(16).toString('base64'))).toThrow();
  });
});

describe('the rules', () => {
  it('reads glucose against the right target for the timing', () => {
    expect(glucoseStatus(5.5, 'fasting')).toBe('in-range');
    expect(glucoseStatus(3.5, 'fasting')).toBe('low');
    expect(glucoseStatus(7.5, 'before-meal')).toBe('high');
    expect(glucoseStatus(8.4, '2h-after')).toBe('in-range');
    expect(glucoseStatus(8.5, '1h-after')).toBe('high');
    expect(mealRise(5.4, 8.1)).toBe(2.7);
    expect(timeInRange([5, 6, 11, 3], [3.9, 10])).toBe(50);
    expect(timeInRange([])).toBe(0);
  });

  it('builds an empty report without dividing by zero', () => {
    const report = buildDoctorReport('2w', [], [], new Date('2026-11-15T00:00:00Z'));
    expect(report).toMatchObject({ avgGlucose: 0, timeInRangePct: 0, avgBp: null, glucoseReadings: 0, mealsLogged: 0, highestRiseGroup: null });
  });
});

describe('consent and setup', () => {
  it('keeps every health endpoint closed until the person agrees', async () => {
    const who = await register(t);
    expect((await call(t, 'GET', '/v1/health/consent', who)).json<HealthConsentState>()).toEqual({ granted: false, version: null, grantedAt: null });
    for (const [method, url, body] of [
      ['GET', '/v1/health/readings'],
      ['POST', '/v1/health/readings', { kind: 'glucose', mmol: 6, timing: 'fasting', at: hoursAgo(1) }],
      ['GET', '/v1/health/meals'],
      ['GET', '/v1/health/report'],
      ['GET', '/v1/health/export'],
    ] as const) {
      const res = await call(t, method, url, who, body);
      expect(res.statusCode, url).toBe(403);
      expect(res.json().error.details).toEqual({ consent: 'health' });
    }
  });

  it('records the consent, replaces it on a new version, and can withdraw it', async () => {
    const who = await consenting();
    const first = (await call(t, 'GET', '/v1/health/consent', who)).json<HealthConsentState>();
    expect(first).toMatchObject({ granted: true, version: '2026-11-01' });
    expect((await call(t, 'PUT', '/v1/health/consent', who, { version: '2026-11-01' })).json<HealthConsentState>().grantedAt).toBe(first.grantedAt);
    expect((await call(t, 'PUT', '/v1/health/consent', who, { version: '2027-01-01' })).json<HealthConsentState>().version).toBe('2027-01-01');
    expect((await call(t, 'DELETE', '/v1/health/consent', who)).json<HealthConsentState>().granted).toBe(false);
    expect((await call(t, 'GET', '/v1/health/readings', who)).statusCode).toBe(403);
    const rows = await t.db.consent.findMany({ where: { userId: who.user.id, kind: 'HEALTH' } });
    expect(rows).toHaveLength(2); // history is kept
    expect(rows.every((r) => r.withdrawnAt !== null)).toBe(true);
  });

  it('needs a signed-in person', async () => {
    expect((await call(t, 'GET', '/v1/health/consent')).statusCode).toBe(401);
  });

  it('says plainly that it is off when the server has no key', async () => {
    const off = await makeApp({ HEALTH_DATA_KEY: '' });
    try {
      const who = await register(off);
      const res = await call(off, 'PUT', '/v1/health/consent', who, { version: 'v1' });
      expect(res.statusCode).toBe(501);
    } finally {
      await off.close();
    }
  });
});

describe('readings', () => {
  it('stores each kind and gives it back', async () => {
    const who = await consenting();
    const g = (await glucose(who, 6.2, 'fasting')).json<HealthReading>();
    expect(g).toMatchObject({ kind: 'glucose', mmol: 6.2, timing: 'fasting', source: 'manual' });
    const bp = await call(t, 'POST', '/v1/health/readings', who, { kind: 'bp', systolic: 128, diastolic: 82, at: hoursAgo(2), source: 'apple-health' });
    expect(bp.statusCode).toBe(201);
    expect(bp.json()).toMatchObject({ kind: 'bp', systolic: 128, diastolic: 82, source: 'apple-health' });
    const ldl = await call(t, 'POST', '/v1/health/readings', who, { kind: 'cholesterol', ldl: 3.1, at: hoursAgo(3) });
    expect(ldl.json()).toMatchObject({ kind: 'cholesterol', ldl: 3.1 });
    const page = (await call(t, 'GET', '/v1/health/readings', who)).json<ReadingsPage>();
    expect(page.items.map((r) => r.kind)).toEqual(['glucose', 'bp', 'cholesterol']); // newest first
    expect(page.nextCursor).toBeNull();
  });

  it('keeps the numbers out of the database in the clear', async () => {
    const who = await consenting();
    const m = await meal(who, { title: 'Secret stew' });
    const r = (await glucose(who, 7.77, 'before-meal', hoursAgo(1), { mealId: m.id })).json<HealthReading>();
    const rows = await t.db.$queryRaw<{ payload: Buffer }[]>`SELECT payload FROM "HealthReading" WHERE id = ${r.id}::uuid`;
    const text = Buffer.from(rows[0]!.payload).toString('latin1');
    expect(text).not.toContain('7.77');
    expect(text).not.toContain('mmol');
    const meals = await t.db.$queryRaw<{ payload: Buffer }[]>`SELECT payload FROM "HealthMeal" WHERE id = ${m.id}::uuid`;
    expect(Buffer.from(meals[0]!.payload).toString('latin1')).not.toContain('Secret stew');
  });

  it('refuses numbers no human has, times in the future or long ago, and meals that are not yours', async () => {
    const who = await consenting();
    const other = await consenting();
    const theirs = await meal(other);
    const bad = async (payload: object) => (await call(t, 'POST', '/v1/health/readings', who, payload)).statusCode;
    expect(await bad({ kind: 'glucose', mmol: 0.2, timing: 'fasting', at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 99, timing: 'fasting', at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 6, timing: 'brunch', at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'bp', systolic: 80, diastolic: 120, at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'bp', systolic: 500, diastolic: 80, at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'cholesterol', ldl: 0, at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'weight', kg: 70, at: hoursAgo(1) })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 6, timing: 'fasting', at: 'yesterday' })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 6, timing: 'fasting', at: new Date(Date.now() + 3_600_000).toISOString() })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 6, timing: 'fasting', at: daysAgo(365 * 6) })).toBe(400);
    expect(await bad({ kind: 'glucose', mmol: 6, timing: 'fasting', at: hoursAgo(1), mealId: theirs.id })).toBe(400);
  });

  it('pages newest first and filters by kind and by date', async () => {
    const who = await consenting();
    for (let i = 0; i < 5; i++) await glucose(who, 5 + i / 10, 'fasting', hoursAgo(10 + i));
    await call(t, 'POST', '/v1/health/readings', who, { kind: 'bp', systolic: 120, diastolic: 80, at: hoursAgo(1) });

    const first = (await call(t, 'GET', '/v1/health/readings?kind=glucose&limit=2', who)).json<ReadingsPage>();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = (await call(t, 'GET', `/v1/health/readings?kind=glucose&limit=2&cursor=${first.nextCursor}`, who)).json<ReadingsPage>();
    const third = (await call(t, 'GET', `/v1/health/readings?kind=glucose&limit=2&cursor=${second.nextCursor}`, who)).json<ReadingsPage>();
    const all = [...first.items, ...second.items, ...third.items];
    expect(all).toHaveLength(5);
    expect(new Set(all.map((r) => r.id)).size).toBe(5);
    expect(third.nextCursor).toBeNull();
    expect(all.map((r) => r.at)).toEqual([...all.map((r) => r.at)].sort().reverse());

    const recent = (await call(t, 'GET', `/v1/health/readings?from=${encodeURIComponent(hoursAgo(11.5))}`, who)).json<ReadingsPage>();
    expect(recent.items).toHaveLength(3); // the bp reading plus the two newest glucose ones
    expect((await call(t, 'GET', '/v1/health/readings?limit=999', who)).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/health/readings?cursor=garbage', who)).statusCode).toBe(400);
  });

  it('keeps one person\'s readings from another', async () => {
    const ama = await consenting();
    const ben = await consenting();
    const r = (await glucose(ama, 6, 'fasting')).json<HealthReading>();
    expect((await call(t, 'GET', '/v1/health/readings', ben)).json<ReadingsPage>().items).toHaveLength(0);
    expect((await call(t, 'DELETE', `/v1/health/readings/${r.id}`, ben)).statusCode).toBe(404);
    expect((await call(t, 'DELETE', `/v1/health/readings/${r.id}`, ama)).statusCode).toBe(204);
    expect((await call(t, 'DELETE', `/v1/health/readings/${r.id}`, ama)).statusCode).toBe(404);
  });

  it('never lets a reading be answered from another row\'s sealed data', async () => {
    const who = await consenting();
    const a = (await glucose(who, 5, 'fasting', hoursAgo(2))).json<HealthReading>();
    const b = (await glucose(who, 9, 'fasting', hoursAgo(1))).json<HealthReading>();
    await t.db.$executeRaw`UPDATE "HealthReading" SET payload = (SELECT payload FROM "HealthReading" WHERE id = ${a.id}::uuid) WHERE id = ${b.id}::uuid`;
    expect((await call(t, 'GET', '/v1/health/readings', who)).statusCode).toBe(500);
  });

  it('sends no-store so nothing keeps a copy', async () => {
    const who = await consenting();
    expect((await call(t, 'GET', '/v1/health/readings', who)).headers['cache-control']).toBe('no-store');
  });
});

describe('meals, reports and exports', () => {
  it('shows how a meal moved glucose and how similar meals went', async () => {
    const who = await consenting();
    const old = await meal(who, { at: hoursAgo(30), title: 'Rice yesterday', variant: '1 cup of rice' });
    await glucose(who, 5.0, 'before-meal', hoursAgo(31), { mealId: old.id });
    await glucose(who, 8.0, '2h-after', hoursAgo(28), { mealId: old.id });

    const m = await meal(who, { at: hoursAgo(5), variant: '2 cups of rice' });
    await glucose(who, 5.4, 'before-meal', hoursAgo(5.5), { mealId: m.id });
    await glucose(who, 6.6, '1h-after', hoursAgo(4), { mealId: m.id });
    await glucose(who, 9.1, '2h-after', hoursAgo(3), { mealId: m.id });

    const response = (await call(t, 'GET', `/v1/health/meals/${m.id}/response`, who)).json<MealResponse>();
    expect(response.rise).toBe(3.7);
    expect(response.before?.mmol).toBe(5.4);
    expect(response.after?.mmol).toBe(9.1);
    expect(response.similar).toEqual([
      { label: 'Rice bowls', meals: 1, avgRise: 3 },
      { label: 'With 1 cup of rice', meals: 1, avgRise: 3 },
    ]);
    expect((await call(t, 'GET', `/v1/health/meals/${m.id}/response`, await consenting())).statusCode).toBe(404);
  });

  it('adds up a doctor report over the range', async () => {
    const who = await consenting();
    for (const [mmol, d] of [[5, 1], [6, 2], [12, 3], [7, 20]] as const) await glucose(who, mmol, 'fasting', daysAgo(d));
    await call(t, 'POST', '/v1/health/readings', who, { kind: 'bp', systolic: 130, diastolic: 80, at: daysAgo(1) });
    await call(t, 'POST', '/v1/health/readings', who, { kind: 'bp', systolic: 120, diastolic: 70, at: daysAgo(2) });
    await meal(who, { at: daysAgo(1) });

    const twoWeeks = (await call(t, 'GET', '/v1/health/report?range=2w', who)).json<DoctorReport>();
    expect(twoWeeks).toMatchObject({ range: '2w', glucoseReadings: 3, avgGlucose: 7.7, timeInRangePct: 67, avgBp: { systolic: 125, diastolic: 75 }, mealsLogged: 1 });
    const month = (await call(t, 'GET', '/v1/health/report', who)).json<DoctorReport>();
    expect(month).toMatchObject({ range: '30d', glucoseReadings: 4 });
    expect((await call(t, 'GET', '/v1/health/report?range=1y', who)).statusCode).toBe(400);
  });

  it('exports everything readable, only for the owner', async () => {
    const who = await consenting();
    await meal(who);
    await glucose(who, 6.5, 'fasting');
    const res = await call(t, 'GET', '/v1/health/export', who);
    expect(res.headers['content-disposition']).toContain('attachment');
    const data = res.json<HealthExport>();
    expect(data.readings).toHaveLength(1);
    expect(data.meals[0]).toMatchObject({ title: 'Jollof and chicken', carbsG: 70 });
    const empty = (await call(t, 'GET', '/v1/health/export', await consenting())).json<HealthExport>();
    expect(empty).toMatchObject({ readings: [], meals: [] });
  });

  it('unlinks readings when their meal is deleted, but keeps the readings', async () => {
    const who = await consenting();
    const m = await meal(who);
    await glucose(who, 5, 'before-meal', hoursAgo(2), { mealId: m.id });
    expect((await call(t, 'DELETE', `/v1/health/meals/${m.id}`, who)).statusCode).toBe(204);
    const page = (await call(t, 'GET', '/v1/health/readings', who)).json<ReadingsPage>();
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.mealId).toBeUndefined();
    expect((await call(t, 'DELETE', `/v1/health/meals/${m.id}`, who)).statusCode).toBe(404);
  });

  it('validates a meal', async () => {
    const who = await consenting();
    for (const bad of [{ title: '' }, { mealType: 'Brunch' }, { carbsG: -5 }, { at: 'soon' }, { group: '' }]) {
      const res = await call(t, 'POST', '/v1/health/meals', who, { title: 'Soup', mealType: 'Lunch', at: hoursAgo(1), carbsG: 10, portionLabel: '1 bowl', group: 'Soups', ...bad });
      expect(res.statusCode, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe('erasing', () => {
  it('lets a person erase everything even after withdrawing consent', async () => {
    const who = await consenting();
    await meal(who);
    await glucose(who, 6, 'fasting');
    await call(t, 'DELETE', '/v1/health/consent', who);
    const res = await call(t, 'DELETE', '/v1/health/data', who);
    expect(res.json()).toEqual({ readings: 1, meals: 1 });
    expect(await t.db.healthReading.count({ where: { userId: who.user.id } })).toBe(0);
    expect(await t.db.healthMeal.count({ where: { userId: who.user.id } })).toBe(0);
  });

  it('removes health data with the account', async () => {
    const who = await consenting();
    await meal(who);
    await glucose(who, 6, 'fasting');
    await t.db.user.delete({ where: { id: who.user.id } });
    expect(await t.db.healthReading.count()).toBe(0);
    expect(await t.db.healthMeal.count()).toBe(0);
  });
});
