import type { FastifyInstance } from 'fastify';
import type { AuthResponse, SocialProvider } from '@shared';
import { buildApp, type Built } from '../src/app';
import type { IdTokenVerifier, VerifiedIdentity } from '../src/auth/idToken';
import type { Mailer } from '../src/auth/mailer';
import { loadConfig, type Config } from '../src/config';
import type { VideoTextSource } from '../src/imports/videoText';
import { errors } from '../src/errors';
import type { Db } from '../src/db';
import type { ChatEvent } from '@shared';
import type { ChatEvents } from '../src/chat/events';
import type { HubOptions } from '../src/chat/hub';
import { makeFakeAi, type FakeAi } from './aiHelpers';
import { FakeWeb } from './webHelpers';
import type { PushMessage, PushSender } from '../src/chat/push';
import type { Storage } from '../src/storage/storage';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env['DATABASE_URL_TEST'] ?? '',
    JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
    LOG_LEVEL: 'silent',
    // Tests make many requests from one address; the limiter has its own tests with a small limit.
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
    // A fixed key made only for tests.
    HEALTH_DATA_KEY: Buffer.alloc(32, 7).toString('base64'),
    ...overrides,
  });
}

export class CaptureMailer implements Mailer {
  readonly resets: { to: string; resetUrl: string }[] = [];
  async sendPasswordReset(input: { to: string; resetUrl: string }): Promise<void> {
    this.resets.push(input);
  }
  /** The token from the most recent reset email. */
  lastToken(): string {
    const last = this.resets.at(-1);
    if (!last) throw new Error('no reset email was sent');
    return new URL(last.resetUrl).searchParams.get('token') ?? '';
  }
}

/** Stands in for Google and Apple: the test registers what each token means. */
export class FakeVerifier implements IdTokenVerifier {
  configured = true;
  private readonly tokens = new Map<string, VerifiedIdentity>();

  allow(token: string, identity: Partial<VerifiedIdentity> & { providerUserId: string; provider: 'GOOGLE' | 'APPLE' | 'FIREBASE' }): void {
    this.tokens.set(token, { email: null, emailVerified: false, name: null, ...identity });
  }
  isConfigured(_provider: SocialProvider): boolean {
    return this.configured;
  }
  async verify(_provider: SocialProvider, idToken: string): Promise<VerifiedIdentity> {
    const found = this.tokens.get(idToken);
    if (!found) throw errors.providerRejected();
    return found;
  }
}

/** An in-memory file store. A test plays the phone with `put`, which is what uploading to the presigned link does. */
export class FakeStorage implements Storage {
  readonly files = new Map<string, { size: number; contentType: string }>();
  /** The bytes of files a test stored with real content (the rest read as zeros of the right size). */
  readonly bytes = new Map<string, Buffer>();
  readonly deleted: string[] = [];
  /** Keys whose deletion should fail, to see that a failure does not stop the rest. */
  readonly failDelete = new Set<string>();

  put(key: string, size: number, contentType: string, content?: Buffer): void {
    this.files.set(key, { size, contentType });
    if (content) this.bytes.set(key, content);
  }
  async read(key: string) {
    const file = this.files.get(key);
    return file ? (this.bytes.get(key) ?? Buffer.alloc(file.size)) : null;
  }
  async presignUpload(input: { key: string; contentType: string; expiresSeconds: number }) {
    return { url: `https://upload.test/${input.key}?expires=${input.expiresSeconds}`, headers: { 'Content-Type': input.contentType } };
  }
  async head(key: string) {
    return this.files.get(key) ?? null;
  }
  async delete(key: string) {
    if (this.failDelete.has(key)) throw new Error('storage unavailable');
    this.files.delete(key);
    this.deleted.push(key);
  }
  publicUrl(key: string) {
    return `https://media.test/${key}`;
  }
  keyFromPublicUrl(url: string) {
    return url.startsWith('https://media.test/') ? url.slice('https://media.test/'.length) : null;
  }
}

/** Remembers what chat announced, so a test can check who was told what. */
export class CaptureEvents implements ChatEvents {
  readonly published: { userIds: string[]; event: ChatEvent }[] = [];
  publish(userIds: string[], event: ChatEvent): void {
    this.published.push({ userIds, event });
  }
  ofType<T extends ChatEvent['type']>(type: T) {
    return this.published.filter((p): p is { userIds: string[]; event: Extract<ChatEvent, { type: T }> } => p.event.type === type);
  }
}

/** Remembers the notifications that would have been sent. `invalid` lists tokens to report as no longer working. */
export class FakePushSender implements PushSender {
  readonly sent: PushMessage[] = [];
  readonly invalid = new Set<string>();
  async send(messages: PushMessage[]) {
    this.sent.push(...messages);
    return { invalidTokens: messages.map((m) => m.to).filter((to) => this.invalid.has(to)) };
  }
}

export interface TestApp {
  /** The pretend internet the importer reads pages from. */
  web: FakeWeb;
  /** The stand-in AI services the app was built with. */
  ai: FakeAi;
  /** Starts listening on a free local port (once) and returns the ws:// address of the live connection. */
  wsUrl(): Promise<string>;
  push: FakePushSender;
  events: CaptureEvents;
  storage: FakeStorage;
  games: Built['games'];
  moderation: Built['moderation'];
  jobs: Built['jobs'];
  app: FastifyInstance;
  db: Db;
  mail: CaptureMailer;
  verifier: FakeVerifier;
  /** Moves the server's clock forward. */
  advance(ms: number): void;
  /** Empties every table, so each test starts from nothing. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function makeApp(configOverrides: Record<string, string> = {}, options: { storage?: Storage | null; hub?: Partial<HubOptions>; videoText?: VideoTextSource | null } = {}): Promise<TestApp> {
  const push = new FakePushSender();
  const ai = makeFakeAi();
  const web = new FakeWeb();
  const storage = new FakeStorage();
  const events = new CaptureEvents();
  const mail = new CaptureMailer();
  const verifier = new FakeVerifier();
  let offset = 0;
  const built = await buildApp({
    config: testConfig(configOverrides),
    mailer: mail,
    verifier,
    storage: options.storage === undefined ? storage : options.storage,
    chatEvents: events,
    pushSender: push,
    aiProviders: ai.all,
    importRequester: web.requester,
    videoText: options.videoText ?? null,
    ...(options.hub ? { hub: options.hub } : {}),
    now: () => new Date(Date.now() + offset),
  });
  await built.app.ready();
  const reset = async () => {
    // Tables that belong to a user go with the user; staff-owned content has no owner, so it is listed here.
    await built.db.$executeRaw`TRUNCATE "User", "Cookbook", "Ad", "AdInquiry", "WebhookEvent", "Conversation", "Report", "Community", "AiUsage", "ImportCache", "DailyPuzzle" CASCADE`;
    events.published.length = 0;
    push.sent.length = 0;
    push.invalid.clear();
    ai.reset();
    web.reset();
    storage.files.clear();
    storage.deleted.length = 0;
    storage.failDelete.clear();
    offset = 0;
    mail.resets.length = 0;
  };
  await reset();
  let listening: Promise<string> | null = null;
  return {
    web,
    ai,
    wsUrl: () => {
      listening ??= built.app.listen({ port: 0, host: '127.0.0.1' }).then((address) => address.replace('http', 'ws') + '/v1/ws');
      return listening;
    },
    push,
    events,
    storage,
    games: built.games,
    moderation: built.moderation,
    jobs: built.jobs,
    app: built.app,
    db: built.db,
    mail,
    verifier,
    advance: (ms) => {
      offset += ms;
    },
    reset,
    close: () => built.app.close(),
  };
}

export const PASSWORD = 'correct horse battery';

let counter = 0;
export const uniqueEmail = (): string => `person${Date.now()}-${counter++}@example.com`;

export async function register(
  t: TestApp,
  overrides: { email?: string; password?: string; displayName?: string } = {},
): Promise<AuthResponse> {
  const res = await t.app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: overrides.email ?? uniqueEmail(),
      password: overrides.password ?? PASSWORD,
      displayName: overrides.displayName ?? 'Ama Okafor',
      acceptedTermsVersion: '2026-11-01',
    },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return res.json<AuthResponse>();
}

export const bearer = (auth: AuthResponse): Record<string, string> => ({
  authorization: `Bearer ${auth.tokens.accessToken}`,
});

export const DAY_MS = 86_400_000;
