import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { JoseIdTokenVerifier, type IdTokenVerifier } from './auth/idToken';
import { LogMailer, type Mailer } from './auth/mailer';
import { authRoutes } from './auth/routes';
import { AuthService } from './auth/service';
import type { Config } from './config';
import { createDb, type Db } from './db';
import { AppError } from './errors';
import { healthRoutes } from './health';
import { cookbookRoutes } from './cookbooks/routes';
import { CookbookService } from './cookbooks/service';
import { kitchenRoutes } from './kitchen/routes';
import { PantryService, ShoppingService, WantToCookService } from './kitchen/services';
import { mealPlanRoutes } from './mealplan/routes';
import { MealPlanService, WasteService } from './mealplan/service';
import { recipeRoutes } from './recipes/routes';
import { RecipeService } from './recipes/service';

export interface BuildOptions {
  config: Config;
  /** Tests pass their own; production builds them from the config. */
  db?: Db;
  mailer?: Mailer;
  verifier?: IdTokenVerifier;
  /** The clock. Tests move it to check expiry. */
  now?: () => Date;
}

export interface Built {
  app: FastifyInstance;
  db: Db;
  auth: AuthService;
}

export async function buildApp(options: BuildOptions): Promise<Built> {
  const { config } = options;
  const production = config.NODE_ENV === 'production';

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    trustProxy: config.TRUST_PROXY,
    // Largest accepted request body. JSON only for now; file uploads go straight to R2, not through here.
    bodyLimit: 256 * 1024,
    disableRequestLogging: config.NODE_ENV === 'test',
  });

  const db = options.db ?? createDb(config.DATABASE_URL, config.DB_POOL_MAX);
  const mailer = options.mailer ?? new LogMailer(app.log, production);
  const verifier = options.verifier ?? new JoseIdTokenVerifier(config.GOOGLE_CLIENT_IDS, config.APPLE_CLIENT_IDS);
  const auth = new AuthService({ db, config, mailer, verifier, ...(options.now ? { now: options.now } : {}) });

  await app.register(helmet);
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // Behind Cloudflare the connecting address is in this header.
    keyGenerator: (request) => {
      const forwarded = config.TRUST_PROXY ? request.headers['cf-connecting-ip'] : undefined;
      return typeof forwarded === 'string' ? forwarded : request.ip;
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) return reply.code(error.status).send(error.toBody());
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Try again in a minute.' } });
    }
    if (status && status >= 400 && status < 500) {
      // Malformed JSON, body too large, and similar: the client's mistake, safe to say plainly.
      return reply.code(status).send({ error: { code: 'validation_error', message: 'The request could not be read' } });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Something went wrong on our side' } });
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } }));

  healthRoutes(app, db);
  authRoutes(app, auth, config);
  recipeRoutes(app, new RecipeService(db), auth);
  const pantry = new PantryService(db, options.now);
  const shopping = new ShoppingService(db);
  kitchenRoutes(app, { pantry, shopping, wantToCook: new WantToCookService(db, pantry, shopping, options.now) }, auth);
  cookbookRoutes(app, new CookbookService(db), auth);
  mealPlanRoutes(app, new MealPlanService(db, options.now), new WasteService(db, options.now), auth);

  app.addHook('onClose', async () => {
    if (!options.db) await db.$disconnect();
  });

  return { app, db, auth };
}
