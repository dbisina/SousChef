// The feed store and the chat store in server mode, against a pretend server and a hand-driven live connection.
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined, deleteItemAsync: async () => undefined }));
jest.mock('@/lib/session', () => ({ currentUserId: () => 'u-me' }));

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
