// The health store in server mode: consent first, then readings and meals through the server, nothing kept on the phone.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
type Route = (method: string, path: string, body: Record<string, unknown> | undefined) => Response | undefined;
let routes: Route[] = [];
let calls: string[] = [];
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};
const consentRefusal = reply(403, { error: { code: 'forbidden', message: 'Agree first', details: { consent: 'health' } } });

type Mod = { health: typeof import('@/stores/healthStore'); api: typeof import('@/lib/api'); storage: { setItem: jest.Mock } };
let m: Mod;

beforeEach(async () => {
  routes = [];
  calls = [];
  global.fetch = jest.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body && typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push(`${method} ${url.pathname}`);
    for (const r of routes) {
      const out = r(method, url.pathname, body);
      if (out) return out;
    }
    return reply(404, { error: { code: 'not_found', message: 'no route' } });
  }) as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  jest.isolateModules(() => {
    m = { api: require('@/lib/api'), health: require('@/stores/healthStore'), storage: require('@react-native-async-storage/async-storage') };
  });
  await m.api.api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

const store = () => m.health.useHealthStore.getState();
const glucose = { id: 'r-srv', kind: 'glucose', mmol: 6.1, timing: 'fasting', at: '2026-11-15T07:00:00.000Z', source: 'manual' };
const meal = { id: 'meal-srv', title: 'Rice', mealType: 'Lunch', at: '2026-11-15T12:00:00.000Z', carbsG: 60, portionLabel: '1 cup', group: 'Rice bowls' };

describe('consent', () => {
  it('starts with no sample data, and asks for consent before loading anything', async () => {
    expect(store().readings).toEqual([]);
    routes = [(mm, p) => (mm === 'GET' && p === '/v1/health/consent' ? reply(200, { granted: false, version: null, grantedAt: null }) : undefined)];
    await store().loadFromServer();
    expect(store().consent).toBe('needed');
    expect(calls).toEqual(['GET /v1/health/consent']); // no readings were even asked for
  });

  it('loads readings and meals once consent is given', async () => {
    routes = [
      (mm, p) => (p === '/v1/health/consent' ? reply(200, { granted: true, version: 'v', grantedAt: 'x' }) : undefined),
      (mm, p) => (mm === 'GET' && p === '/v1/health/readings' ? reply(200, { items: [glucose], nextCursor: null }) : undefined),
      (mm, p) => (mm === 'GET' && p === '/v1/health/meals' ? reply(200, { items: [meal] }) : undefined),
    ];
    await store().loadFromServer();
    expect(store()).toMatchObject({ consent: 'granted', readings: [{ id: 'r-srv', mmol: 6.1 }], meals: [{ id: 'meal-srv' }] });
  });

  it('agrees, then loads', async () => {
    routes = [
      (mm, p) => (mm === 'PUT' && p === '/v1/health/consent' ? reply(200, { granted: true, version: 'v', grantedAt: 'x' }) : undefined),
      (mm, p) => (mm === 'GET' && p === '/v1/health/consent' ? reply(200, { granted: true, version: 'v', grantedAt: 'x' }) : undefined),
      (mm, p) => (mm === 'GET' && p === '/v1/health/readings' ? reply(200, { items: [], nextCursor: null }) : undefined),
      (mm, p) => (mm === 'GET' && p === '/v1/health/meals' ? reply(200, { items: [] }) : undefined),
    ];
    await store().grantConsent();
    expect(store().consent).toBe('granted');
    expect(calls[0]).toBe('PUT /v1/health/consent');
  });

  it('withdraws (clearing the screen), and erases everything', async () => {
    m.health.useHealthStore.setState({ consent: 'granted', readings: [glucose as never], meals: [meal as never] });
    routes = [
      (mm, p) => (mm === 'DELETE' && p === '/v1/health/consent' ? reply(200, { granted: false, version: null, grantedAt: null }) : undefined),
      (mm, p) => (mm === 'DELETE' && p === '/v1/health/data' ? reply(200, { readings: 1, meals: 1 }) : undefined),
    ];
    await store().eraseAll();
    expect(store()).toMatchObject({ readings: [], meals: [] });
    m.health.useHealthStore.setState({ consent: 'granted', readings: [glucose as never] });
    await store().withdrawConsent();
    expect(store()).toMatchObject({ consent: 'needed', readings: [] });
  });
});

describe('logging', () => {
  it('shows a reading at once and swaps in the server\'s copy', async () => {
    routes = [(mm, p, b) => (mm === 'POST' && p === '/v1/health/readings' ? reply(201, { ...glucose, mmol: b?.['mmol'] }) : undefined)];
    const local = store().logReading({ kind: 'glucose', mmol: 5.5, timing: 'fasting' });
    expect(store().readings[0]?.id).toBe(local.id);
    await settle();
    expect(store().readings.map((r) => r.id)).toEqual(['r-srv']);
    expect(store().readings[0]).toMatchObject({ mmol: 5.5 });
  });

  it('takes a reading back, and asks for consent, when the server says to agree first', async () => {
    routes = [(mm, p) => (mm === 'POST' && p === '/v1/health/readings' ? consentRefusal : undefined)];
    store().logReading({ kind: 'bp', systolic: 120, diastolic: 80 });
    await settle();
    expect(store().readings).toEqual([]);
    expect(store().consent).toBe('needed');
  });

  it('waits for a new meal to be saved before sending the readings that belong to it', async () => {
    routes = [
      (mm, p) => (mm === 'POST' && p === '/v1/health/meals' ? reply(201, meal) : undefined),
      (mm, p, b) => (mm === 'POST' && p === '/v1/health/readings' ? reply(201, { ...glucose, mealId: b?.['mealId'] }) : undefined),
    ];
    store().logMeal({ id: 'local-meal', title: 'Rice', mealType: 'Lunch', at: meal.at, carbsG: 60, portionLabel: '1 cup', group: 'Rice bowls' });
    store().logReading({ kind: 'glucose', mmol: 5.4, timing: 'before-meal', mealId: 'local-meal' });
    await settle();
    expect(calls).toEqual(['POST /v1/health/meals', 'POST /v1/health/readings']);
    expect(store().meals.map((x) => x.id)).toEqual(['meal-srv']);
    expect(store().readings[0]).toMatchObject({ id: 'r-srv', mealId: 'meal-srv' });
  });

  it('removes a reading, and puts it back if the server keeps it', async () => {
    m.health.useHealthStore.setState({ consent: 'granted', readings: [glucose as never] });
    routes = [(mm, p) => (mm === 'DELETE' && p === '/v1/health/readings/r-srv' ? reply(500, { error: { code: 'internal', message: 'x' } }) : undefined)];
    store().removeReading('r-srv');
    expect(store().readings).toEqual([]);
    await settle();
    expect(store().readings.map((r) => r.id)).toEqual(['r-srv']);
  });

  it('forgets everything when signing out, and never writes health data to the phone', async () => {
    routes = [(mm, p) => (mm === 'POST' && p === '/v1/health/readings' ? reply(201, glucose) : undefined)];
    store().logReading({ kind: 'cholesterol', ldl: 3.1 });
    await settle();
    const wrote = m.storage.setItem.mock.calls.filter(([k]) => String(k).includes('health'));
    for (const [, value] of wrote) expect(String(value)).not.toContain('r-srv');
    store().clearLocal();
    expect(store()).toMatchObject({ consent: 'unknown', readings: [], meals: [] });
  });
});
