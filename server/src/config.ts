import { z } from 'zod';

const csv = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Connections kept to PostgreSQL. Each one costs memory on both sides; 10 is plenty for one small server. */
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

  /** Signs access tokens. At least 32 random characters; generate with `openssl rand -base64 48`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(60),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).default(30),

  /** Comma separated OAuth client ids the server accepts ID tokens for. Empty means that provider is off. */
  GOOGLE_CLIENT_IDS: csv,
  /** For Apple this is the app's bundle id. */
  APPLE_CLIENT_IDS: csv,

  /** Where the password reset email sends the person. The token is added as ?token=... */
  APP_RESET_URL: z.string().default('souschef://reset-password'),
  /** The version of the terms and privacy policy people accept while signing up. */
  CURRENT_TERMS_VERSION: z.string().default('2026-11-01'),

  /** True behind Cloudflare: take the client address from its header. Only safe when the server accepts traffic from Cloudflare alone. */
  TRUST_PROXY: bool,
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  /** Sign-in, sign-up, refresh and password reset requests per minute per address: the endpoints people guess at. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
});

export type Config = z.infer<typeof schema>;

/** Reads and checks the environment once at startup, so a bad setting stops the server immediately with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
