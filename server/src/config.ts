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

const schema = z
  .object({
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

    /**
     * The value RevenueCat sends in the Authorization header of its webhook (set it to 'Bearer <this secret>' in the
     * RevenueCat dashboard). Empty turns the webhook off.
     */
    REVENUECAT_WEBHOOK_SECRET: z
      .string()
      .default('')
      .refine((v) => v === '' || v.length >= 16, 'REVENUECAT_WEBHOOK_SECRET must be empty or at least 16 characters'),
    /** Optional Expo access token, for projects that turned on enhanced push security. Empty is fine. */
    EXPO_ACCESS_TOKEN: z.string().default(''),

    /**
     * AI services. A service whose key is empty is off. Model names and prices change often, so they are settings, and the
     * prices only feed the spending estimate (check them against each provider's price list).
     */
    AI_GEMINI_API_KEY: z.string().default(''),
    AI_GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    AI_DEEPSEEK_API_KEY: z.string().default(''),
    AI_DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    AI_DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
    AI_NEBIUS_API_KEY: z.string().default(''),
    /** No default: pick the model (for example the safety model) in the Nebius console. */
    AI_NEBIUS_MODEL: z.string().default(''),
    AI_NEBIUS_BASE_URL: z.string().default('https://api.studio.nebius.com/v1'),
    /** Imports (each can open a web page and call an AI service) allowed per minute per address. */
    IMPORT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
    /** All AI calls together stop when this much has been spent in a month (US dollars). */
    AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(5),
    AI_PRICE_GEMINI_IN: z.coerce.number().min(0).default(0.3),
    AI_PRICE_GEMINI_OUT: z.coerce.number().min(0).default(2.5),
    AI_PRICE_DEEPSEEK_IN: z.coerce.number().min(0).default(0.28),
    AI_PRICE_DEEPSEEK_OUT: z.coerce.number().min(0).default(0.42),
    AI_PRICE_NEBIUS_IN: z.coerce.number().min(0).default(0.2),
    AI_PRICE_NEBIUS_OUT: z.coerce.number().min(0).default(0.6),

    /** File store for uploads (Cloudflare R2 or any S3-compatible bucket). Set all of the S3_* values and STORAGE_PUBLIC_URL, or none. */
    S3_ENDPOINT: z.string().default(''),
    S3_BUCKET: z.string().default(''),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_REGION: z.string().default('auto'),
    /** The public address of the bucket, e.g. https://media.souschef.app (no trailing slash). */
    STORAGE_PUBLIC_URL: z.string().default(''),

    /**
     * The key that encrypts health readings and meals at rest: 32 random bytes written as base64
     * (`openssl rand -base64 32`). Empty turns health tracking off. Losing the key makes the stored readings unreadable, so
     * keep a copy somewhere safe and apart from the database backups.
     */
    HEALTH_DATA_KEY: z
      .string()
      .default('')
      .refine((v) => v === '' || Buffer.from(v, 'base64').length === 32, 'HEALTH_DATA_KEY must be 32 bytes written as base64'),
  })
  .superRefine((env, ctx) => {
    const storage = [env.S3_ENDPOINT, env.S3_BUCKET, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY, env.STORAGE_PUBLIC_URL];
    const set = storage.filter((v) => v !== '').length;
    if (set > 0 && set < storage.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_ENDPOINT'],
        message: 'Set all of S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and STORAGE_PUBLIC_URL, or none of them',
      });
    }
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
