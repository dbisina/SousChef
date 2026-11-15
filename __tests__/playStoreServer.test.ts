// Daily Dish and Mystery Kitchen in server mode: the server holds the answers, the clock and the scores.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
jest.mock('@/lib/session', () => ({ currentUserId: () => 'u-me' }));

const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null, blob: async () => new Blob(['px'], { type: 'image/jpeg' }) }) as Response;
type Route = (method: string, path: string, body: Record<string, unknown> | undefined) => Response | undefined;
let routes: Route[] = [];
let calls: string[] = [];
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};

type Mod = { play: typeof import('@/stores/playStore'); api: typeof import('@/lib/api'); map: typeof import('@/services/playServer') };
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
    return reply(404, { error: { code: 'not_found', message: 'Not found here' } });
  }) as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  jest.isolateModules(() => {
    m = { api: require('@/lib/api'), play: require('@/stores/playStore'), map: require('@/services/playServer') };
  });
  await m.api.api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

const store = () => m.play.usePlayStore.getState();
const daily = (over: Record<string, unknown> = {}) => ({
  date: '2026-11-15', puzzleNumber: 7, status: 'playing', clues: ['Grain dish', null, null, null, null, null], cluesShown: 1, cluesTotal: 6, guesses: [], maxGuesses: 6, score: 0, answer: null, photoUrl: null, streak: { current: 3, best: 5 }, ...over,
});
const person = (id: string, name: string, photoUrl: string | null = null) => ({ id, handle: name.toLowerCase(), displayName: name, photoUrl, isChef: false, isVerifiedChef: false, kind: 'person' as const });
const room = (over: Record<string, unknown> = {}) => ({
  code: '4821', mode: 'group', phase: 'lobby', difficulty: 'hard', totalSec: 1200, secondsLeft: 1200, host: person('u-me', 'Ama'),
  players: [{ user: person('u-me', 'Ama'), submitted: false }, { user: person('u-ben', 'Ben', 'https://m.test/b.jpg'), submitted: false }],
  basket: null, twist: null, hints: [], hintsLeft: 0, submitted: false, canStart: true, dish: null, results: null, ...over,
});

describe('Daily Dish', () => {
  it('starts with no sample streak and loads today\'s game', async () => {
    expect(store().streak).toEqual({ current: 0, best: 0, lastSolvedDate: '' });
    routes = [(mm, p) => (mm === 'GET' && p === '/v1/play/daily' ? reply(200, daily()) : undefined)];
    await store().loadDaily(new Date(2026, 10, 15));
    expect(store().daily).toEqual({ puzzleNumber: 7, cluesShown: 1, guesses: [], status: 'playing' });
    expect(store().streak).toMatchObject({ current: 3, best: 5 });
    const puzzle = m.play.selectDailyPuzzle(store());
    expect(puzzle.clues[0]).toBe('Grain dish');
    expect(puzzle.answer).toBe(''); // the answer is not on the phone until the game is over
  });

  it('shows a guess at once and lets the server say whether it won', async () => {
    routes = [
      (mm, p) => (mm === 'GET' && p === '/v1/play/daily' ? reply(200, daily()) : undefined),
      (mm, p, b) => (mm === 'POST' && p === '/v1/play/daily/guess' ? reply(200, daily({ status: 'solved', guesses: [b?.['guess']], answer: 'Jollof Rice', score: 85, streak: { current: 4, best: 5 } })) : undefined),
    ];
    await store().loadDaily();
    const shown = store().guessDaily('jollof rice');
    expect(shown?.guesses).toEqual(['jollof rice']); // at once
    expect(store().daily?.status).toBe('playing');
    await settle();
    expect(store().daily?.status).toBe('solved');
    expect(m.play.selectDailyPuzzle(store()).answer).toBe('Jollof Rice');
    expect(m.play.selectDailyScore(store())).toBe(85);
    expect(store().streak.current).toBe(4);
  });

  it('puts the guess list back if the server cannot take it, and buys clues from the server', async () => {
    routes = [
      (mm, p) => (mm === 'GET' && p === '/v1/play/daily' ? reply(200, daily()) : undefined),
      (mm, p) => (mm === 'POST' && p === '/v1/play/daily/clue' ? reply(200, daily({ cluesShown: 2, clues: ['Grain dish', 'Red', null, null, null, null] })) : undefined),
    ];
    await store().loadDaily();
    store().guessDaily('rice'); // no route: refused
    await settle();
    expect(store().daily?.guesses).toEqual([]);
    store().revealNextClue();
    await settle();
    expect(store().daily?.cluesShown).toBe(2);
    expect(m.play.selectDailyPuzzle(store()).clues.slice(0, 2)).toEqual(['Grain dish', 'Red']);
  });

  it('ignores blank guesses and guesses after the game is over', () => {
    store().guessDaily('   ');
    expect(calls).toEqual([]);
  });
});

describe('Mystery Kitchen', () => {
  it('maps a room: players, host, the clock, the basket, hints you bought, and the twist', () => {
    const view = room({ phase: 'cooking', secondsLeft: 900, basket: ['rice', 'tomato'], twist: 'Use one pan', hints: ['Grain dish'], hintsLeft: 2 });
    const r = m.map.toRound(view as never, 'u-me', 1_000_000);
    expect(r).toMatchObject({ roomCode: '4821', phase: 'cooking', difficulty: 'Hard', totalSec: 1200, hintsUnlocked: 1, twist: { text: 'Use one pan' } });
    expect(r.startedAt).toBe(1_000_000 - 300 * 1000); // 5 minutes of 20 have gone
    expect(r.players).toMatchObject([{ id: 'u-me', isYou: true, isHost: true }, { id: 'u-ben', avatar: 'https://m.test/b.jpg' }]);
    expect(r.secret.ingredients.map((i) => i.label)).toEqual(['rice', 'tomato']);
    expect(r.secret.hints).toEqual(['Grain dish', '', '']); // locked hints are empty slots
    expect(r.secret.name).toBe(''); // the dish is secret until the end
  });

  it('maps the results of a finished room', () => {
    const view = room({ phase: 'done', dish: 'Jollof Rice', results: [{ rank: 1, user: person('u-ben', 'Ben'), score: 90, judgeScore: 90, hintsUsed: 0, feedback: 'Lovely', photoUrl: 'https://m.test/plate.jpg', judgedBy: 'ai' }] });
    const r = m.map.toRound(view as never, 'u-me', 0);
    expect(r.phase).toBe('reveal');
    expect(r.secret.name).toBe('Jollof Rice');
    expect(r.submissions).toEqual([{ playerId: 'u-ben', judgeScore: 90, hintsUsed: 0, timeLeftSec: 0, score: 90, plate: 'https://m.test/plate.jpg', comment: 'Lovely' }]);
  });

  it('hosts a room: a stand-in at once, the real room when the server answers', async () => {
    routes = [(mm, p) => (mm === 'POST' && p === '/v1/play/rooms' ? reply(201, room()) : undefined)];
    const stand = store().hostRound();
    expect(stand.roomCode).toBe('');
    expect(store().round?.roomCode).toBe('');
    await settle();
    expect(store().round?.roomCode).toBe('4821');
    expect(store().round?.players).toHaveLength(2);
  });

  it('keeps a stand-in and shows the reason when a room cannot be joined (instead of hosting a new one by mistake)', async () => {
    routes = [(mm, p) => (mm === 'POST' && p === '/v1/play/rooms/join' ? reply(404, { error: { code: 'not_found', message: 'There is no open game with that code' } }) : undefined)];
    store().joinRound(' 9999 ');
    await settle();
    expect(store().round).not.toBeNull();
    expect(store().playError).toBe('There is no open game with that code');
    expect(calls).toEqual(['POST /v1/play/rooms/join']);
  });

  it('starts, buys a hint, and hands in a plate through the server', async () => {
    routes = [
      (mm, p) => (mm === 'POST' && p === '/v1/play/rooms/4821/start' ? reply(200, room({ phase: 'cooking', basket: ['rice'], twist: 'x', hints: [], hintsLeft: 3 })) : undefined),
      (mm, p) => (mm === 'POST' && p === '/v1/play/rooms/4821/hint' ? reply(200, room({ phase: 'cooking', basket: ['rice'], twist: 'x', hints: ['Grain'], hintsLeft: 2 })) : undefined),
      (mm, p) => (mm === 'GET' && p === '/plate.jpg' ? reply(200) : undefined),
      (mm, p) => (mm === 'POST' && p === '/v1/uploads' ? reply(201, { id: 'up1', uploadUrl: 'https://files.test/up1', headers: {}, publicUrl: 'https://m.test/up1.jpg', expiresAt: 'x' }) : undefined),
      (mm, p) => (mm === 'PUT' && p === '/up1' ? reply(200) : undefined),
      (mm, p) => (mm === 'POST' && p === '/v1/uploads/up1/complete' ? reply(200, { id: 'up1', url: 'https://m.test/up1.jpg', status: 'ready' }) : undefined),
      (mm, p, b) => (mm === 'POST' && p === '/v1/play/rooms/4821/plate' && b?.['uploadId'] === 'up1' ? reply(200, room({ phase: 'done', dish: 'Jollof Rice', results: [] })) : undefined),
    ];
    m.play.usePlayStore.setState({ round: m.map.placeholderRound('4821') });
    store().startRound();
    await settle();
    expect(store().round).toMatchObject({ phase: 'cooking', hintsUnlocked: 0 });
    expect(store().useHint()).toBeNull(); // the hint arrives with the room, not as a return value
    await settle();
    expect(store().round?.hintsUnlocked).toBe(1);
    store().submitPlate(undefined, undefined); // no photo: nothing is sent
    await settle();
    expect(calls.some((c) => c.includes('/plate'))).toBe(false);
    store().submitPlate(undefined, 'file:///plate.jpg');
    await settle();
    expect(store().round?.phase).toBe('reveal');
    expect(store().round?.secret.name).toBe('Jollof Rice');
  });

  it('follows the room when the server announces a change, and leaves when it closes', async () => {
    m.play.usePlayStore.setState({ round: m.map.placeholderRound('4821') });
    routes = [(mm, p) => (mm === 'GET' && p === '/v1/play/rooms/4821' ? reply(200, room({ phase: 'cooking', basket: ['rice'], twist: 'x', hints: [], hintsLeft: 3 })) : undefined)];
    await store().refreshRound('4821');
    expect(store().round?.phase).toBe('cooking');
    await store().refreshRound('1111'); // not our room: ignored
    expect(store().round?.roomCode).toBe('4821');
    routes = [];
    await store().refreshRound('4821'); // the room is gone
    expect(store().round).toBeNull();
  });

  it('leaving a lobby tells the server; a game in progress is not left', async () => {
    routes = [(mm, p) => (mm === 'POST' && p === '/v1/play/rooms/4821/leave' ? reply(200, { left: true }) : undefined)];
    m.play.usePlayStore.setState({ round: m.map.placeholderRound('4821') });
    store().leaveRound();
    await settle();
    expect(calls).toEqual(['POST /v1/play/rooms/4821/leave']);
    expect(store().round).toBeNull();
    calls.length = 0;
    m.play.usePlayStore.setState({ round: { ...m.map.placeholderRound('4821'), phase: 'cooking' } });
    store().leaveRound();
    await settle();
    expect(calls).toEqual([]);
  });
});
