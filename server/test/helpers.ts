import type { FastifyInstance } from 'fastify';
import type { AuthResponse, SocialProvider } from '@shared';
import { buildApp } from '../src/app';
import type { IdTokenVerifier, VerifiedIdentity } from '../src/auth/idToken';
import type { Mailer } from '../src/auth/mailer';
import { loadConfig, type Config } from '../src/config';
import { errors } from '../src/errors';
import type { Db } from '../src/db';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env['DATABASE_URL_TEST'] ?? '',
    JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
    LOG_LEVEL: 'silent',
    // Tests make many requests from one address; the limiter has its own tests with a small limit.
    RATE_LIMIT_MAX: '100000',
    AUTH_RATE_LIMIT_MAX: '100000',
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

  allow(token: string, identity: Partial<VerifiedIdentity> & { providerUserId: string; provider: 'GOOGLE' | 'APPLE' }): void {
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

export interface TestApp {
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

export async function makeApp(configOverrides: Record<string, string> = {}): Promise<TestApp> {
  const mail = new CaptureMailer();
  const verifier = new FakeVerifier();
  let offset = 0;
  const built = await buildApp({
    config: testConfig(configOverrides),
    mailer: mail,
    verifier,
    now: () => new Date(Date.now() + offset),
  });
  await built.app.ready();
  const reset = async () => {
    // Tables that belong to a user go with the user; staff-owned content has no owner, so it is listed here.
    await built.db.$executeRaw`TRUNCATE "User", "Cookbook", "Ad", "AdInquiry" CASCADE`;
    offset = 0;
    mail.resets.length = 0;
  };
  await reset();
  return {
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
