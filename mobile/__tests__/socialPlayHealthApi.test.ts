// The social, games and health requests, against a pretend server.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));

import { api, ApiError, resetApiForTests } from '@/lib/api';
import * as health from '@/services/healthApi';
import * as play from '@/services/playApi';
import * as social from '@/services/socialApi';
import { fetchServerFeed } from '@/services/feedServer';

const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null }) as Response;
const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
let server: jest.Mock;
const sent = (i: number) => {
  const [url, init] = server.mock.calls[i] as [string, RequestInit];
  return { method: init.method, path: new URL(String(url)).pathname, search: new URL(String(url)).search, body: init.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  resetApiForTests();
  server = jest.fn();
  global.fetch = server as unknown as typeof fetch;
  await api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe('social', () => {
  it('reads each feed a page at a time', async () => {
    server.mockResolvedValue(reply(200, { items: [], nextCursor: null }));
    await social.apiFeed('for-you');
    await social.apiFeed('following', { limit: 5, cursor: 'c1' });
    expect(sent(0)).toMatchObject({ path: '/v1/feed/for-you', search: '?limit=20' });
    expect(sent(1)).toMatchObject({ path: '/v1/feed/following', search: '?limit=5&cursor=c1' });
  });

  it('asks the server for the people you follow in pages the server accepts (it refuses more than 50)', async () => {
    server.mockImplementation(async (url: string) => {
      const u = new URL(String(url));
      if (u.pathname.startsWith('/v1/users/') && u.pathname.endsWith('/following') && Number(u.searchParams.get('limit')) > 50) return reply(400, { error: { code: 'validation_error', message: 'Too big' } });
      if (u.pathname.startsWith('/v1/users/') && u.pathname.endsWith('/following')) return reply(200, { items: [{ id: 'u9', handle: 'chef', displayName: 'Chef', photoUrl: null, isChef: false, isVerifiedChef: false, kind: 'person' }], nextCursor: null });
      if (u.pathname === '/v1/stories') return reply(200, { groups: [] });
      return reply(200, { items: [], nextCursor: null });
    });
    const feed = await fetchServerFeed('me1');
    expect(feed.followingIds).toEqual(['u9']);
  });

  it('likes, saves and comments', async () => {
    server.mockResolvedValue(reply(200, { active: true, count: 3 }));
    await social.apiSetPostLiked('p1', true);
    await social.apiSetPostLiked('p1', false);
    await social.apiSetPostSaved('p1', true);
    await social.apiSetCommentLiked('p1', 'c1', true);
    server.mockResolvedValue(reply(201, { id: 'c2' }));
    await social.apiAddComment('p1', { text: 'Yum', parentId: 'c1' });
    expect([0, 1, 2, 3, 4].map((i) => `${sent(i).method} ${sent(i).path}`)).toEqual([
      'PUT /v1/posts/p1/like', 'DELETE /v1/posts/p1/like', 'PUT /v1/posts/p1/save', 'PUT /v1/posts/p1/comments/c1/like', 'POST /v1/posts/p1/comments',
    ]);
    expect(sent(4).body).toEqual({ text: 'Yum', parentId: 'c1' });
  });

  it('posts, follows, searches and tells stories', async () => {
    server.mockResolvedValue(reply(201, { id: 'p9' }));
    await social.apiCreatePost({ kind: 'made-this', title: 'Jollof', photoUploadId: 'up1' });
    server.mockResolvedValue(reply(200, { following: true, followerCount: 4 }));
    await social.apiSetFollowing('u2', true);
    await social.apiSetFollowing('u2', false);
    server.mockResolvedValue(reply(200, { items: [{ id: 'u3' }] }));
    expect(await social.apiSearchPeople('a')).toEqual([]); // too short to bother the server
    expect(await social.apiSearchPeople(' ama ')).toEqual([{ id: 'u3' }]);
    server.mockResolvedValue(reply(200, { groups: [{ author: { id: 'u2' }, stories: [], hasUnseen: true, latestAt: 'x' }] }));
    expect((await social.apiStoryTray())[0]?.hasUnseen).toBe(true);
    server.mockResolvedValue(reply(200, { group: null }));
    expect(await social.apiUserStories('u2')).toBeNull();
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/posts', body: { photoUploadId: 'up1' } });
    expect(sent(1)).toMatchObject({ method: 'PUT', path: '/v1/users/u2/follow' });
    expect(sent(2)).toMatchObject({ method: 'DELETE', path: '/v1/users/u2/follow' });
    expect(sent(3).search).toBe('?q=ama&limit=20');
  });

  it('never lets counting a view fail the screen', async () => {
    server.mockRejectedValue(new TypeError('offline'));
    await expect(social.apiViewPost('p1')).resolves.toBeUndefined();
    await expect(social.apiViewStory('s1')).resolves.toBeUndefined();
  });

  it('reports', async () => {
    server.mockResolvedValue(reply(202));
    await social.apiReport({ targetType: 'post', targetId: 'p1', reason: 'spam' });
    expect(sent(0)).toMatchObject({ method: 'POST', path: '/v1/reports', body: { targetType: 'post', targetId: 'p1', reason: 'spam' } });
  });
});

describe('games', () => {
  it('plays Daily Dish with the player\'s own date', async () => {
    const evening = new Date(2026, 10, 15, 23, 30); // local time, 15 November
    server.mockResolvedValue(reply(200, { status: 'playing' }));
    await play.apiDailyDish(evening);
    await play.apiDailyClue(evening);
    await play.apiDailyGuess('Jollof Rice', evening);
    server.mockResolvedValueOnce(reply(200, { items: [{ score: 80 }] }));
    expect(await play.apiDailyLeaderboard(evening)).toEqual([{ score: 80 }]);
    expect(sent(0).search).toBe('?date=2026-11-15');
    expect(sent(1).body).toEqual({ date: '2026-11-15' });
    expect(sent(2).body).toEqual({ guess: 'Jollof Rice', date: '2026-11-15' });
  });

  it('runs a Mystery Kitchen room', async () => {
    server.mockResolvedValue(reply(200, { code: '4821', phase: 'lobby' }));
    await play.apiCreateRoom({ mode: 'group', difficulty: 'hard' });
    await play.apiJoinRoom('4821');
    await play.apiRoom('4821');
    await play.apiStartRoom('4821');
    await play.apiBuyHint('4821');
    await play.apiSubmitPlate('4821', { uploadId: 'up1' });
    server.mockResolvedValue(reply(200, { left: true }));
    await play.apiLeaveRoom('4821');
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => `${sent(i).method} ${sent(i).path}`)).toEqual([
      'POST /v1/play/rooms', 'POST /v1/play/rooms/join', 'GET /v1/play/rooms/4821', 'POST /v1/play/rooms/4821/start', 'POST /v1/play/rooms/4821/hint', 'POST /v1/play/rooms/4821/plate', 'POST /v1/play/rooms/4821/leave',
    ]);
    expect(sent(0).body).toEqual({ mode: 'group', difficulty: 'hard' });
    expect(sent(1).body).toEqual({ code: '4821' });
  });
});

describe('health', () => {
  it('recognises the "agree first" refusal', async () => {
    server.mockResolvedValueOnce(reply(403, { error: { code: 'forbidden', message: 'Agree to the health data terms first', details: { consent: 'health' } } }));
    const err = await health.apiReadings().then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(health.needsHealthConsent(err)).toBe(true);
    expect(health.needsHealthConsent(new ApiError(403, 'forbidden', 'Not allowed'))).toBe(false);
    expect(health.needsHealthConsent(new Error('x'))).toBe(false);
  });

  it('agrees, withdraws, records and erases', async () => {
    server.mockResolvedValue(reply(200, { granted: true, version: '2026-11-01', grantedAt: 'x' }));
    await health.apiGrantHealthConsent();
    await health.apiWithdrawHealthConsent();
    server.mockResolvedValue(reply(201, { id: 'r1' }));
    await health.apiAddReading({ kind: 'glucose', mmol: 6.1, timing: 'fasting', at: '2026-11-15T07:00:00.000Z' });
    server.mockResolvedValue(reply(200, { readings: 3, meals: 1 }));
    expect(await health.apiEraseHealthData()).toEqual({ readings: 3, meals: 1 });
    expect(sent(0)).toMatchObject({ method: 'PUT', path: '/v1/health/consent', body: { version: '2026-11-01' } });
    expect(sent(1)).toMatchObject({ method: 'DELETE', path: '/v1/health/consent' });
    expect(sent(2)).toMatchObject({ method: 'POST', path: '/v1/health/readings', body: { mmol: 6.1 } });
    expect(sent(3)).toMatchObject({ method: 'DELETE', path: '/v1/health/data' });
  });

  it('gathers a long history page by page, and asks for the doctor report by range', async () => {
    server
      .mockResolvedValueOnce(reply(200, { items: [{ id: 'a' }], nextCursor: 'n1' }))
      .mockResolvedValueOnce(reply(200, { items: [{ id: 'b' }], nextCursor: null }));
    expect((await health.apiAllReadings({ kind: 'glucose' })).map((r) => r.id)).toEqual(['a', 'b']);
    expect(sent(0).search).toBe('?kind=glucose&limit=200');
    expect(sent(1).search).toContain('cursor=n1');
    server.mockResolvedValueOnce(reply(200, { range: '90d' }));
    await health.apiDoctorReport('90d');
    expect(sent(2).search).toBe('?range=90d');
  });
});
