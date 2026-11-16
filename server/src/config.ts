import { z } from 'zod';
import { parseOldKeys } from './vitals/crypto';

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
    /** The Firebase project whose sign-in tokens the server accepts (the app signs in with Firebase, the server trades the token for its own). Empty means off. */
    FIREBASE_PROJECT_ID: z.string().trim().default(''),
    /** Web pages allowed to call the API from a browser (exact origins, separated by commas), for the app's web build. Empty means none. */
    CORS_ORIGINS: csv,
    /** Folder holding the built staff dashboard (admin/dist). When set, the API serves it at /admin/. Empty means off. */
    ADMIN_DIR: z.string().trim().default(''),

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
    /**
     * Key pool. AI_GEMINI_API_KEY is the funded key. AI_GEMINI_FREE_KEYS are keys without billing, separated by commas:
     * ordinary requests rotate across them (cost 0) and a rate-limited key rests for a while. Private requests and the
     * paid-only tasks use the funded key only. Free-tier content may be used by Google to improve its products.
     */
    AI_GEMINI_FREE_KEYS: csv,
    /** When every free key is resting, may the funded key take an ordinary request? */
    AI_GEMINI_SPILL_TO_PAID: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
    /** Extra tasks that always use the funded key (names from ai/types.ts), separated by commas. Anything with a video link already does. */
    AI_GEMINI_PAID_ONLY_TASKS: z
      .string()
      .default('')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    /** Providers allowed to see private requests (health numbers, private chats, receipts), separated by commas. */
    AI_PRIVATE_PROVIDERS: z
      .string()
      // Gemini (funded key) and Nebius (pay-per-use, no training on your data by its terms: confirm this before launch).
      .default('gemini,nebius,nebius-vision,nebius-vision-2,nebius-dedicated')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    AI_DEEPSEEK_API_KEY: z.string().default(''),
    AI_DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    AI_DEEPSEEK_BASE_URL: z.string().default('https://api.deepseek.com'),
    AI_NEBIUS_API_KEY: z.string().default(''),
    /** Nebius Token Factory (OpenAI-compatible). Text work and the moderation check. */
    /** Path of the yt-dlp program (empty = off). Reads video captions and subtitles for link imports. */
    /** Web search for "I want to cook X" (Tavily first, then Brave; empty = off, the model writes the recipe instead). */
    TAVILY_API_KEY: z.string().default(''),
    BRAVE_SEARCH_API_KEY: z.string().default(''),
    YT_DLP_PATH: z.string().default(''),
    /** Path of a cookies file (Netscape format) from a logged-in account; lets yt-dlp read Instagram. Empty = anonymous. */
    YT_DLP_COOKIES_PATH: z.string().default(''),
    /** ffmpeg, used with yt-dlp to take pictures from a video whose caption holds no recipe. */
    FFMPEG_PATH: z.string().default('ffmpeg'),
    /** Optional outbound proxy for yt-dlp, for platforms that block data-centre addresses. */
    IMPORT_PROXY_URL: z.string().default(''),
    AI_NEBIUS_MODEL: z.string().default('Qwen/Qwen3-30B-A3B-Instruct-2507'),
    AI_NEBIUS_BASE_URL: z.string().default('https://api.tokenfactory.nebius.com/v1'),
    /** Photo jobs (fridge and receipt scans, plate checks, captions, cookbook pages, post photos). Chosen by trying the catalogue's vision models on real photos. Empty turns one off. */
    AI_NEBIUS_VISION_MODEL: z.string().default('MiniMaxAI/MiniMax-M3.1-Flash'),
    AI_NEBIUS_VISION_MODEL_2: z.string().default('deepseek-ai/DeepSeek-V4.1-Flash-1017'),
    /**
     * A dedicated endpoint (your own GPUs, created in the Nebius console or with POST /v0/dedicated_endpoints). The model is
     * its routing_key, the address is its region's (eu-north1: https://api.tokenfactory.nebius.com/v1, eu-west1:
     * https://api.tokenfactory.eu-west1.nebius.com/v1, us-central1: https://api.tokenfactory.us-central1.nebius.com/v1) and
     * the key is AI_NEBIUS_API_KEY. When set it is tried first for text work.
     */
    AI_NEBIUS_DEDICATED_MODEL: z.string().default(''),
    AI_NEBIUS_DEDICATED_BASE_URL: z.string().default(''),
    AI_NEBIUS_DEDICATED_IMAGES: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    /** The order photo jobs try providers in. Put gemini first once its account is funded. */
    AI_VISION_FIRST: z
      .string()
      .default('nebius-vision,nebius-vision-2,gemini')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    /** Imports (each can open a web page and call an AI service) allowed per minute per address. */
    IMPORT_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
    /** All AI calls together stop when this much has been spent in a month (US dollars). */
    AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(5),
    AI_PRICE_GEMINI_IN: z.coerce.number().min(0).default(0.3),
    AI_PRICE_GEMINI_OUT: z.coerce.number().min(0).default(2.5),
    AI_PRICE_DEEPSEEK_IN: z.coerce.number().min(0).default(0.28),
    AI_PRICE_DEEPSEEK_OUT: z.coerce.number().min(0).default(0.42),
    AI_PRICE_NEBIUS_IN: z.coerce.number().min(0).default(0.1),
    AI_PRICE_NEBIUS_OUT: z.coerce.number().min(0).default(0.3),
    AI_PRICE_NEBIUS_VISION_IN: z.coerce.number().min(0).default(0.15),
    AI_PRICE_NEBIUS_VISION_OUT: z.coerce.number().min(0).default(0.6),
    AI_PRICE_NEBIUS_VISION_2_IN: z.coerce.number().min(0).default(0.3),
    AI_PRICE_NEBIUS_VISION_2_OUT: z.coerce.number().min(0).default(1.2),

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
    /** Background jobs (clearing out expired data, finishing games, checking new posts). Safe on several servers: a lock stops double runs. */
    JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),

    /** Words that cannot be posted, separated by commas. Whole words only, any capitals. Empty: none beyond the spam rules. */
    BANNED_TERMS: z.string().default(''),

    HEALTH_DATA_KEY: z
      .string()
      .default('')
      .refine((v) => v === '' || Buffer.from(v, 'base64').length === 32, 'HEALTH_DATA_KEY must be 32 bytes written as base64'),
    /** Which key HEALTH_DATA_KEY is. Raise it when you rotate (the id is stored with each value). */
    HEALTH_DATA_KEY_ID: z.coerce.number().int().min(1).max(255).default(1),
    /** Older keys still needed to read old data while it is being rewritten: "1:base64key,2:base64key". */
    HEALTH_DATA_OLD_KEYS: z
      .string()
      .default('')
      .refine((v) => {
        try {
          return [...parseOldKeys(v).values()].every((k) => Buffer.from(k, 'base64').length === 32);
        } catch {
          return false;
        }
      }, 'HEALTH_DATA_OLD_KEYS must look like "1:base64key,2:base64key", each key 32 bytes as base64'),
  })
  .superRefine((env, ctx) => {
    const free = env.AI_GEMINI_FREE_KEYS;
    if (free.length > 20) ctx.addIssue({ code: 'custom', path: ['AI_GEMINI_FREE_KEYS'], message: 'At most 20 free Gemini keys' });
    if (new Set(free).size !== free.length) ctx.addIssue({ code: 'custom', path: ['AI_GEMINI_FREE_KEYS'], message: 'The same key is listed twice' });
    if (env.AI_GEMINI_API_KEY && free.includes(env.AI_GEMINI_API_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['AI_GEMINI_FREE_KEYS'], message: 'The funded key (AI_GEMINI_API_KEY) must not also be listed as a free key' });
    }
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
