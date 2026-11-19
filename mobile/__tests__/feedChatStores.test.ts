// The feed store and the chat store in server mode, against a pretend server and a hand-driven live connection.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
let mockGuest = false;
jest.mock('@/lib/session', () => ({ currentUserId: () => 'u-me', isGuestSession: () => mockGuest }));

const mockSocket = { start: jest.fn(), stop: jest.fn(), ack: jest.fn(), sendTyping: jest.fn(), onlineIds: new Set<string>() };
let mockHandlers: Record<string, (...a: never[]) => void> = {};
jest.mock('@/services/chatApi', () => {
  const actual = jest.requireActual('@/services/chatApi');
  return { ...actual, createChatSocket: (h: Record<string, (...a: never[]) => void>) => { mockHandlers = h; return mockSocket; } };
});

type Stores = {
  social: typeof import('@/stores/socialStore');
  message: typeof import('@/stores/messageStore');
  api: typeof import('@/lib/api');
};

const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: 'r1' };
const person = (id: string, name: string, photoUrl: string | null = null) => ({ id, handle: name.toLowerCase(), displayName: name, photoUrl, isChef: false, isVerifiedChef: id === 'u-ben', kind: 'person' as const });
const ME = person('u-me', 'Ama');
const BEN = person('u-ben', 'Ben', 'https://m.test/ben.jpg');

const post = (over: Record<string, unknown> = {}) => ({
  id: 'p1', author: BEN, kind: 'made-this', title: 'Jollof', caption: 'Sunday', meta: '35 min', photoUrl: 'https://m.test/p1.jpg', videoUrl: null, recipeId: null, communityId: null, challengeId: null,
  likeCount: 3, commentCount: 1, saveCount: 0, viewCount: 9, createdAt: '2026-11-10T10:00:00.000Z', viewer: { liked: true, saved: false }, ...over,
});
const convo = (over: Record<string, unknown> = {}) => ({
  id: 'c1', kind: 'direct', title: 'Ben', photoUrl: null, members: [ME, BEN], isAdmin: false, muted: false, unread: 2, lastSeq: 5,
  lastMessage: { id: 'm5', senderId: 'u-ben', kind: 'text', preview: 'hi there', at: '2026-11-10T11:00:00.000Z' }, lastAt: '2026-11-10T11:00:00.000Z', createdAt: '2026-11-01T00:00:00.000Z', ...over,
});
const msg = (over: Record<string, unknown> = {}) => ({
  id: 'm5', conversationId: 'c1', seq: 5, sender: BEN, clientId: 'cl-5', createdAt: '2026-11-10T11:00:00.000Z', deleted: false, replyTo: null, reactions: [], status: null, kind: 'text', text: 'hi there', ...over,
});

const reply = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body ?? null, blob: async () => new Blob(['px'], { type: 'image/jpeg' }) }) as Response;
type Route = (method: string, path: string, body: Record<string, unknown> | undefined) => Response | undefined;
let routes: Route[] = [];
let calls: string[] = [];
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};

function load(): Stores {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  let stores!: Stores;
  jest.isolateModules(() => {
    stores = {
      api: require('@/lib/api'),
      social: require('@/stores/socialStore'),
      message: require('@/stores/messageStore'),
    };
  });
  return stores;
}

let s: Stores;
beforeEach(async () => {
  routes = [];
  calls = [];
  mockHandlers = {};
  Object.values(mockSocket).forEach((f) => typeof f === 'function' && (f as jest.Mock).mockClear());
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
  s = load();
  await s.api.api().setTokens(tokens);
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

const feedRoutes = (): Route => (m, p) => {
  if (m === 'GET' && p === '/v1/feed/following') return reply(200, { items: [post()], nextCursor: null });
  if (m === 'GET' && p === '/v1/feed/for-you')
    return reply(200, { items: [post({ id: 'p2', author: ME, videoUrl: 'https://m.test/v.mp4', kind: 'video', viewer: { liked: false, saved: true }, createdAt: '2026-11-11T10:00:00.000Z' }), post()], nextCursor: null });
  if (m === 'GET' && p === '/v1/stories') return reply(200, { groups: [{ author: BEN, stories: [{ id: 's1', author: BEN, photoUrl: 'https://m.test/s1.jpg', recipeId: null, createdAt: 'x', expiresAt: 'y', viewCount: null, seen: false }], hasUnseen: true, latestAt: 'x' }] });
  if (m === 'GET' && p === '/v1/users/u-me/following') return reply(200, { items: [BEN], nextCursor: null });
  return undefined;
};

describe('the feed', () => {
  it('starts empty in server mode instead of showing sample posts', () => {
    expect(s.social.useSocialStore.getState().posts).toEqual([]);
  });

  it('loads posts, people, reels, stories and what you have liked, saved and followed', async () => {
    routes = [feedRoutes()];
    await s.social.useSocialStore.getState().loadFromServer();
    const st = s.social.useSocialStore.getState();
    expect(st.posts.map((p) => p.id)).toEqual(['p2', 'p1']); // newest first, no duplicates
    expect(st.posts[0]).toMatchObject({ authorId: 'me', photo: 'https://m.test/p1.jpg' }); // my own posts are "me"
    expect(st.posts[1]).toMatchObject({ authorId: 'u-ben', likes: 3, saves: 0, meta: '35 min' });
    expect(st.reels.map((r) => r.id)).toEqual(['p2']);
    expect(st.stories).toMatchObject([{ id: 's1', authorId: 'u-ben', photo: 'https://m.test/s1.jpg' }]);
    expect(st.authors.find((a) => a.id === 'u-ben')).toMatchObject({ displayName: 'Ben', avatar: 'https://m.test/ben.jpg', verified: true });
    expect(st.authors.find((a) => a.id === 'me')?.displayName).toBe('Ama');
    expect(st.likedPostIds).toEqual(['p1']);
    expect(st.savedPostIds).toEqual(['p2']);
    expect(st.followingIds).toEqual(['u-ben']);
  });

  it('shows a guest the picked-for-you posts, asking only for what works without an account', async () => {
    mockGuest = true;
    try {
      routes = [feedRoutes()];
      await s.social.useSocialStore.getState().loadFromServer();
      expect(s.social.useSocialStore.getState().posts.map((p) => p.id)).toEqual(['p2', 'p1']);
      expect(calls).toContain('GET /v1/feed/for-you');
      expect(calls).not.toContain('GET /v1/feed/following');
      expect(calls).not.toContain('GET /v1/stories');
    } finally {
      mockGuest = false;
    }
  });

  it('asks a guest to sign up instead of liking, and makes no server call', async () => {
    routes = [feedRoutes()];
    await s.social.useSocialStore.getState().loadFromServer();
    const before = calls.length;
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => undefined);
    mockGuest = true;
    try {
      s.social.useSocialStore.getState().toggleLikePost('p2');
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(s.social.useSocialStore.getState().likedPostIds).toEqual(['p1']);
      expect(s.social.useSocialStore.getState().addComment('p2', 'yum')).toBeNull();
      await settle();
      expect(calls.length).toBe(before);
    } finally {
      mockGuest = false;
      alertSpy.mockRestore();
    }
  });

  it('keeps what it has when the server cannot be reached', async () => {
    routes = [feedRoutes()];
    await s.social.useSocialStore.getState().loadFromServer();
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('offline'));
    await s.social.useSocialStore.getState().loadFromServer();
    expect(s.social.useSocialStore.getState().posts).toHaveLength(2);
  });

  it('likes at once, then shows the count the server gives back', async () => {
    routes = [feedRoutes(), (m, p) => (m === 'PUT' && p === '/v1/posts/p1/like' ? reply(200, { active: true, count: 12 }) : undefined)];
    await s.social.useSocialStore.getState().loadFromServer();
    s.social.useSocialStore.setState({ likedPostIds: [] });
    s.social.useSocialStore.getState().toggleLikePost('p1');
    expect(s.social.useSocialStore.getState().likedPostIds).toContain('p1'); // at once
    expect(s.social.useSocialStore.getState().posts.find((p) => p.id === 'p1')?.likes).toBe(4); // a guess, until the server answers
    await settle();
    expect(s.social.useSocialStore.getState().posts.find((p) => p.id === 'p1')?.likes).toBe(12);
  });

  it('reloads from the server when a like is refused, so the screen is not left wrong', async () => {
    routes = [feedRoutes()];
    await s.social.useSocialStore.getState().loadFromServer();
    calls.length = 0;
    s.social.useSocialStore.getState().toggleLikePost('p2'); // no route: 404
    await settle();
    expect(calls).toContain('GET /v1/feed/for-you');
    expect(s.social.useSocialStore.getState().likedPostIds).not.toContain('p2');
  });

  it('follows and unfollows on the server, but never "me"', async () => {
    routes = [(m, p) => (p === '/v1/users/u-ben/follow' ? reply(200, { following: m === 'PUT', followerCount: 1 }) : undefined)];
    s.social.useSocialStore.getState().toggleFollow('u-ben');
    s.social.useSocialStore.getState().toggleFollow('u-ben');
    s.social.useSocialStore.getState().toggleFollow('me');
    await settle();
    expect(calls).toEqual(['PUT /v1/users/u-ben/follow', 'DELETE /v1/users/u-ben/follow']);
  });

  it('shows a comment at once and swaps in the server\'s copy', async () => {
    routes = [(m, p, b) => (m === 'POST' && p === '/v1/posts/p1/comments' ? reply(201, { id: 'c-real', postId: 'p1', author: ME, parentId: null, text: (b?.['text'] as string) ?? '', voice: null, likeCount: 0, replyCount: 0, createdAt: '2026-11-12T00:00:00.000Z', deleted: false, viewer: { liked: false } }) : undefined)];
    const local = s.social.useSocialStore.getState().addComment('p1', ' Looks great ');
    expect(local?.text).toBe('Looks great');
    await settle();
    const comments = s.social.useSocialStore.getState().comments;
    expect(comments).toMatchObject([{ id: 'c-real', authorId: 'me', text: 'Looks great', isAuthor: true }]);
  });

  it('takes a comment back when the server refuses it', async () => {
    s.social.useSocialStore.setState({ posts: [{ id: 'p1', commentCount: 0 } as never] });
    s.social.useSocialStore.getState().addComment('p1', 'Hi');
    await settle();
    expect(s.social.useSocialStore.getState().comments).toEqual([]);
    expect(s.social.useSocialStore.getState().posts[0]?.commentCount).toBe(0);
  });

  it('posts a photo from the phone: uploads it, creates the post, and swaps in the real one', async () => {
    routes = [
      (m, p) => (m === 'GET' && p === '/photo.jpg' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads' ? reply(201, { id: 'up1', uploadUrl: 'https://files.test/up1', headers: { 'Content-Type': 'image/jpeg' }, publicUrl: 'https://m.test/up1.jpg', expiresAt: 'x' }) : undefined),
      (m, p) => (m === 'PUT' && p === '/up1' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads/up1/complete' ? reply(200, { id: 'up1', url: 'https://m.test/up1.jpg', status: 'ready' }) : undefined),
      (m, p, b) => (m === 'POST' && p === '/v1/posts' ? reply(201, post({ id: 'real1', author: ME, title: b?.['title'], photoUrl: 'https://m.test/up1.jpg' })) : undefined),
    ];
    const local = s.social.useSocialStore.getState().createPost({ kind: 'made-this', photo: 'file:///photo.jpg', caption: 'Dinner' });
    expect(s.social.useSocialStore.getState().posts[0]?.id).toBe(local.id); // at once
    await settle();
    expect(s.social.useSocialStore.getState().posts.map((p) => p.id)).toEqual(['real1']);
    expect(calls).toEqual(['GET /photo.jpg', 'POST /v1/uploads', 'PUT /up1', 'POST /v1/uploads/up1/complete', 'POST /v1/posts']);
  });

  it('takes the post back off the feed if it cannot be shared, and refuses a sample photo', async () => {
    s.social.useSocialStore.getState().createPost({ kind: 'recipe', photo: 'gnocchi', caption: 'x' });
    expect(s.social.useSocialStore.getState().posts).toHaveLength(1);
    await settle();
    expect(s.social.useSocialStore.getState().posts).toEqual([]);
    expect(calls).toEqual([]); // nothing was sent
  });
});

describe('chat', () => {
  const chatRoutes = (): Route => (m, p) => {
    if (m === 'GET' && p === '/v1/conversations') return reply(200, { items: [convo()], nextCursor: null });
    if (m === 'GET' && p === '/v1/conversations/c1/messages') return reply(200, { items: [msg({ id: 'm4', seq: 4, sender: ME, text: 'hello', status: 'delivered', clientId: 'cl-4' }), msg()], hasMore: false });
    return undefined;
  };
  const chat = () => s.message.useMessageStore.getState();

  it('starts empty in server mode', () => {
    expect(chat().conversations).toEqual([]);
    expect(chat().messages).toEqual([]);
  });

  it('loads conversations and recent messages, learns who the people are, and goes live', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    expect(chat().conversations).toMatchObject([{ id: 'c1', kind: 'friend', title: 'Ben', participantIds: ['u-ben'], lastPreview: 'hi there', unread: 2 }]);
    expect(chat().messages.map((m) => [m.id, m.senderId, m.status])).toEqual([['m4', 'me', 'delivered'], ['m5', 'u-ben', undefined]]);
    expect(s.social.useSocialStore.getState().authors.find((a) => a.id === 'u-ben')?.displayName).toBe('Ben');
    expect(mockSocket.start).toHaveBeenCalledTimes(1);
    await chat().loadFromServer();
    expect(mockSocket.start).toHaveBeenCalledTimes(1); // one connection, however often it reloads
  });

  it('sends a text at once and swaps in the server\'s message', async () => {
    routes = [chatRoutes(), (m, p, b) => (m === 'POST' && p === '/v1/conversations/c1/messages' ? reply(201, msg({ id: 'm6', seq: 6, sender: ME, clientId: b?.['clientId'], text: b?.['text'], status: 'sent' })) : undefined)];
    await chat().loadFromServer();
    const local = chat().sendMessage('c1', { kind: 'text', text: ' yo ' });
    expect(local?.senderId).toBe('me');
    expect(chat().messages.at(-1)?.id).toBe(local?.id);
    await settle();
    expect(chat().messages.at(-1)).toMatchObject({ id: 'm6', kind: 'text', text: 'yo', status: 'sent' });
    expect(chat().messages.filter((m) => m.senderId === 'me')).toHaveLength(2);
  });

  it('takes a message back when it cannot be sent, and does not send empty ones or recordings that do not exist', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    const before = chat().messages.length;
    chat().sendMessage('c1', { kind: 'text', text: 'will fail' });
    expect(chat().messages).toHaveLength(before + 1);
    await settle();
    expect(chat().messages).toHaveLength(before);
    expect(chat().sendMessage('c1', { kind: 'text', text: '  ' })).toBeNull();
    expect(chat().sendMessage('c1', { kind: 'voice', durationSec: 3, waveform: [1, 2] })).toBeNull();
  });

  it('shows a new message from someone else, counts it unread and tells the server it arrived', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    mockHandlers['onEvent']?.({ type: 'message.new', message: msg({ id: 'm7', seq: 7, text: 'you there?', clientId: 'cl-7' }) } as never);
    expect(chat().messages.at(-1)).toMatchObject({ id: 'm7', text: 'you there?' });
    expect(chat().conversations[0]).toMatchObject({ lastPreview: 'you there?', unread: 3 });
    expect(mockSocket.ack).toHaveBeenCalledWith('c1', 7);
    mockHandlers['onEvent']?.({ type: 'message.new', message: msg({ id: 'm7', seq: 7 }) } as never);
    expect(chat().messages.filter((m) => m.id === 'm7')).toHaveLength(1); // the same event twice shows once
  });

  it('does not show your own message twice when the server echoes it', async () => {
    routes = [chatRoutes()]; // the send itself fails (no route), which must not remove the echoed message
    await chat().loadFromServer();
    const local = chat().sendMessage('c1', { kind: 'text', text: 'echo' })!;
    mockHandlers['onEvent']?.({ type: 'message.new', message: msg({ id: 'm8', seq: 8, sender: ME, clientId: local.id, text: 'echo' }) } as never);
    const mine = chat().messages.filter((m) => m.senderId === 'me' && m.kind === 'text' && (m as { text: string }).text === 'echo');
    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe('m8');
    expect(chat().conversations[0]?.unread).toBe(2); // your own message is not "unread"
  });

  it('ticks your messages delivered and read as the other person catches up', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    mockHandlers['onEvent']?.({ type: 'receipt', conversationId: 'c1', userId: 'u-ben', read: 4 } as never);
    expect(chat().messages.find((m) => m.id === 'm4')?.status).toBe('read');
    expect(chat().messages.find((m) => m.id === 'm5')?.status).toBeUndefined(); // theirs: no ticks
  });

  it('empties a deleted message and follows presence', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    mockHandlers['onEvent']?.({ type: 'message.deleted', conversationId: 'c1', messageId: 'm5' } as never);
    expect(chat().messages.find((m) => m.id === 'm5')).toMatchObject({ kind: 'text', text: '' });
    mockHandlers['onPresence']?.('u-ben' as never, true as never);
    expect(chat().conversations[0]?.online).toBe(true);
  });

  it('reads a conversation up to its newest message', async () => {
    routes = [chatRoutes(), (m, p) => (m === 'POST' && p === '/v1/conversations/c1/read' ? reply(204) : undefined)];
    await chat().loadFromServer();
    chat().markRead('c1');
    expect(chat().conversations[0]?.unread).toBe(0);
    await settle();
    expect(calls).toContain('POST /v1/conversations/c1/read');
  });

  it('opens a chat with a person through the server', async () => {
    routes = [(m, p) => (m === 'POST' && p === '/v1/conversations' ? reply(201, convo({ id: 'c9', unread: 0 })) : undefined)];
    expect(await chat().startConversationOnServer('u-ben')).toBe('c9');
    expect(chat().conversations.map((c) => c.id)).toEqual(['c9']);
    routes = [];
    expect(await chat().startConversationOnServer('u-x')).toBeNull();
  });

  it('catches up after a reconnect and forgets everything on sign-out', async () => {
    routes = [chatRoutes()];
    await chat().loadFromServer();
    routes.push((m, p, _b) => (m === 'GET' && p === '/v1/conversations/c1/messages' ? reply(200, { items: [msg({ id: 'm9', seq: 9, text: 'missed it' })], hasMore: false }) : undefined));
    routes.reverse(); // the catch-up answer first
    mockHandlers['onResync']?.();
    await settle();
    expect(chat().messages.some((m) => m.id === 'm9')).toBe(true);
    chat().stopLive();
    expect(mockSocket.stop).toHaveBeenCalled();
    expect(chat().conversations).toEqual([]);
    expect(chat().messages).toEqual([]);
  });
});

describe('communities and stories', () => {
  const comm = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, description: '', photoUrl: 'https://m.test/c.jpg', visibility: 'public', memberCount: 12, createdAt: 'x', ...over });
  const communityRoutes = (): Route => (m, p) => {
    if (m === 'GET' && p === '/v1/me/communities') return reply(200, { items: [comm('c1', 'Jollof Club')], nextCursor: null });
    if (m === 'GET' && p === '/v1/communities') return reply(200, { items: [comm('c1', 'Jollof Club'), comm('c2', 'Bakers', { visibility: 'private', photoUrl: null })], nextCursor: null });
    if (m === 'GET' && p === '/v1/communities/c1/posts') return reply(200, { items: [post({ id: 'cp1', communityId: 'c1', createdAt: '2026-11-12T10:00:00.000Z' })], nextCursor: null });
    if (m === 'GET' && p === '/v1/communities/c1/challenges')
      return reply(200, { items: [{ id: 'ch1', communityId: 'c1', title: 'Best stew', description: '', photoUrl: null, endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), entries: 4, active: true }, { id: 'ch0', communityId: 'c1', title: 'Old', description: '', photoUrl: null, endsAt: '2020-01-01T00:00:00.000Z', entries: 1, active: false }] });
    if (m === 'GET' && p === '/v1/communities/c1/events') return reply(200, { items: [{ id: 'ev1', communityId: 'c1', title: 'Cook-along', detail: 'Zoom', startsAt: '2026-12-01T18:00:00.000Z' }] });
    return undefined;
  };

  it('loads communities, which you are in, and their posts, challenges and events', async () => {
    routes = [feedRoutes(), communityRoutes()];
    await s.social.useSocialStore.getState().loadFromServer();
    const st = s.social.useSocialStore.getState();
    expect(st.communities.map((c) => [c.id, c.name, c.visibility])).toEqual([['c1', 'Jollof Club', 'public'], ['c2', 'Bakers', 'private']]);
    expect(st.joinedCommunityIds).toEqual(['c1']);
    expect(st.posts.some((p) => p.id === 'cp1' && p.communityId === 'c1')).toBe(true);
    expect(st.challenges).toMatchObject([{ id: 'ch1', title: 'Best stew', entries: 4, endsLabel: '3 days left' }]); // the ended one is left out
    expect(st.events).toMatchObject([{ id: 'ev1', date: '2026-12-01T18:00:00.000Z', detail: 'Zoom' }]);
  });

  it('joins and leaves on the server, then reloads to show the truth (a private one may only be "pending")', async () => {
    routes = [feedRoutes(), communityRoutes(), (m, p) => (m === 'POST' && p === '/v1/communities/c2/join' ? reply(200, { status: 'pending' }) : undefined), (m, p) => (m === 'DELETE' && p === '/v1/communities/c1/membership' ? reply(204) : undefined)];
    await s.social.useSocialStore.getState().loadFromServer();
    s.social.useSocialStore.getState().toggleJoinCommunity('c2');
    await settle();
    expect(calls).toContain('POST /v1/communities/c2/join');
    expect(s.social.useSocialStore.getState().joinedCommunityIds).not.toContain('c2'); // pending is not joined
    s.social.useSocialStore.getState().toggleJoinCommunity('c1');
    await settle();
    expect(calls).toContain('DELETE /v1/communities/c1/membership');
  });

  it('shares a photo as a story: uploads it, posts it, and shows it first', async () => {
    routes = [
      (m, p) => (m === 'GET' && p === '/story.jpg' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads' ? reply(201, { id: 'up9', uploadUrl: 'https://files.test/up9', headers: {}, publicUrl: 'https://m.test/up9.jpg', expiresAt: 'x' }) : undefined),
      (m, p) => (m === 'PUT' && p === '/up9' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads/up9/complete' ? reply(200, { id: 'up9', url: 'https://m.test/up9.jpg', status: 'ready' }) : undefined),
      (m, p, b) => (m === 'POST' && p === '/v1/stories' && b?.['photoUploadId'] === 'up9' ? reply(201, { id: 'st9', author: ME, photoUrl: 'https://m.test/up9.jpg', recipeId: null, createdAt: '2026-11-15T10:00:00.000Z', expiresAt: 'y', viewCount: 0, seen: null }) : undefined),
    ];
    expect(await s.social.useSocialStore.getState().postStory('file:///story.jpg')).toBe(true);
    expect(s.social.useSocialStore.getState().stories[0]).toMatchObject({ id: 'st9', authorId: 'me', photo: 'https://m.test/up9.jpg' });
  });

  it('says so when a story cannot be posted', async () => {
    expect(await s.social.useSocialStore.getState().postStory('file:///story.jpg')).toBe(false);
    expect(s.social.useSocialStore.getState().stories).toEqual([]);
  });
});

describe('chat pictures', () => {
  it('sends a picture: shows it at once, uploads it, and swaps in the server\'s message', async () => {
    routes = [
      (m, p) => (m === 'GET' && p === '/pic.jpg' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads' ? reply(201, { id: 'upc', uploadUrl: 'https://files.test/upc', headers: {}, publicUrl: 'https://m.test/upc.jpg', expiresAt: 'x' }) : undefined),
      (m, p) => (m === 'PUT' && p === '/upc' ? reply(200) : undefined),
      (m, p) => (m === 'POST' && p === '/v1/uploads/upc/complete' ? reply(200, { id: 'upc', url: 'https://m.test/upc.jpg', status: 'ready' }) : undefined),
      (m, p, b) => (m === 'POST' && p === '/v1/conversations/c1/messages' && b?.['uploadId'] === 'upc' ? reply(201, msg({ id: 'm20', seq: 20, sender: ME, kind: 'image', url: 'https://m.test/upc.jpg', caption: '', clientId: b?.['clientId'], status: 'sent', text: undefined })) : undefined),
    ];
    const local = s.message.useMessageStore.getState().sendMessage('c1', { kind: 'image', uri: 'file:///pic.jpg' });
    expect(local).toMatchObject({ kind: 'image', url: 'file:///pic.jpg', senderId: 'me' });
    expect(s.message.useMessageStore.getState().conversations).toEqual([]); // (no conversation loaded in this test)
    await settle();
    expect(s.message.useMessageStore.getState().messages).toMatchObject([{ id: 'm20', kind: 'image', url: 'https://m.test/upc.jpg' }]);
  });

  it('shows a picture from someone else', async () => {
    routes = [(m, p) => (m === 'GET' && p === '/v1/conversations' ? reply(200, { items: [convo()], nextCursor: null }) : m === 'GET' && p === '/v1/conversations/c1/messages' ? reply(200, { items: [msg({ id: 'm30', kind: 'image', url: 'https://m.test/x.jpg', caption: 'Look!', text: undefined })], hasMore: false }) : undefined)];
    await s.message.useMessageStore.getState().loadFromServer();
    expect(s.message.useMessageStore.getState().messages[0]).toMatchObject({ kind: 'image', url: 'https://m.test/x.jpg', caption: 'Look!' });
  });
});
