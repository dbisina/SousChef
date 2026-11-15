// Connected to a server, the app must show real data or an empty state: never invented people, recipes, plans or orders.
// This test keeps new screens from quietly bringing sample data back in.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'services', 'stores'];

/**
 * The only files that may import the bundled sample data (data/sample/* and data/seedData). Each one either only runs when
 * there is no server (local mode services and stores) or is gated on SERVER_MODE where it reaches the screen. A new file
 * on this list needs a reason.
 */
const ALLOWED = new Set([
  'services/feedService.ts', // local mode feed
  'services/healthService.ts', // local mode health
  'services/messageService.ts', // local mode chat
  'services/orderService.ts', // local mode orders (hidden when connected)
  'services/playService.ts', // local mode games
  'stores/playStore.ts', // starting streak in local mode only
  'lib/people.ts', // fallback lookup that never matches a server id
  'app/(tabs)/you.tsx', // the "You" label when nobody is signed in
  'app/post/[id].tsx', // same
  'app/messages/index.tsx', // sample people only without a server
  'components/feed/HomeFeed.tsx', // the sponsored dish, only rendered when ordering is on
  'app/admin/seed.tsx', // the old Firestore seeding tool
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('sample data stays out of the server-connected app', () => {
  it('is imported only by the files that are known to be safe', () => {
    const offenders: string[] = [];
    for (const dir of SOURCE_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        const text = readFileSync(file, 'utf8');
        if (/from ['"]@\/data\/(sample\/|seedData)/.test(text) && !ALLOWED.has(rel)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every allowed file still exists (a stale list hides new problems)', () => {
    for (const rel of ALLOWED) expect(() => statSync(path.join(ROOT, rel))).not.toThrow();
  });
});

describe('features that need a server side', () => {
  const load = (apiUrl: string | undefined) => {
    const before = process.env.EXPO_PUBLIC_API_URL;
    if (apiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = apiUrl;
    let mod: typeof import('@/constants/features') | undefined;
    jest.isolateModules(() => {
      mod = require('@/constants/features');
    });
    if (before === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = before;
    return mod as typeof import('@/constants/features');
  };

  it('hides restaurants and orders when the app is connected to a server', () => {
    const connected = load('https://api.test');
    expect(connected.SERVER_MODE).toBe(true);
    expect(connected.FEATURES.ordering).toBe(false);
    expect(connected.FEATURES).toMatchObject({ feed: true, messages: true, play: true, health: true });
  });

  it('keeps them for the local preview', () => {
    const local = load(undefined);
    expect(local.SERVER_MODE).toBe(false);
    expect(local.FEATURES.ordering).toBe(true);
  });
});

describe('the builds point at the server', () => {
  it('sets the server address and Firebase sign-in for preview and production builds', () => {
    const eas = JSON.parse(readFileSync(path.join(ROOT, 'eas.json'), 'utf8')) as { build: Record<string, { env?: Record<string, string> }> };
    for (const profile of ['preview', 'production']) {
      expect(eas.build[profile]?.env?.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
      expect(eas.build[profile]?.env?.EXPO_PUBLIC_AUTH_VIA).toBe('firebase');
      // only public settings belong here: nothing that looks like a secret
      expect(JSON.stringify(eas.build[profile]?.env)).not.toMatch(/sk-|secret|password|private/i);
    }
  });
});
