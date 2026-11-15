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
import { storageFromConfig, type Storage } from './storage/storage';
import { uploadRoutes } from './uploads/routes';
import { UploadService } from './uploads/service';
import { adRoutes } from './ads/routes';
import { AdService } from './ads/service';
import websocket from '@fastify/websocket';
import { noEvents, type ChatEvents } from './chat/events';
import { ChatHub, defaultHubOptions, tee, type HubOptions } from './chat/hub';
import { ExpoPushSender, PushNotifier, type PushSender } from './chat/push';
import { chatRoutes } from './chat/routes';
import { ChatService } from './chat/service';
import { communityRoutes } from './communities/routes';
import { CommunityService } from './communities/service';
import { cookbookRoutes } from './cookbooks/routes';
import { CookbookService } from './cookbooks/service';
import { kitchenRoutes } from './kitchen/routes';
import { PantryService, ShoppingService, WantToCookService } from './kitchen/services';
import { mealPlanRoutes } from './mealplan/routes';
import { MealPlanService, WasteService } from './mealplan/service';
import { recipeRoutes } from './recipes/routes';
import { FollowService } from './social/follows';
import { PostService } from './social/posts';
import { HouseService } from './invites/house';
import { inviteRoutes } from './invites/routes';
import { InviteService } from './invites/service';
import { ReportService } from './social/reports';
import { socialRoutes } from './social/routes';
import { StoryService } from './social/stories';
import { storyRoutes } from './social/storyRoutes';
import { subscriptionRoutes } from './subscriptions/routes';
import { EntitlementService } from './subscriptions/service';
import { RecipeService } from './recipes/service';

export interface BuildOptions {
  config: Config;
  /** Tests pass their own; production builds them from the config. */
  db?: Db;
  mailer?: Mailer;
  verifier?: IdTokenVerifier;
  /** The file store. Tests pass a fake; leave unset to build one from the S3_* settings (or none). */
  storage?: Storage | null;
  /** An extra listener for chat events (tests use it to see what was announced). */
  chatEvents?: ChatEvents;
  /** Live connection timings; tests shorten them. */
  hub?: Partial<HubOptions>;
  /** Sends phone notifications. Unset: Expo's service, except under test where there is none. */
  pushSender?: PushSender | null;
  /** The clock. Tests move it to check expiry. */
  now?: () => Date;
}

export interface Built {
  app: FastifyInstance;
  db: Db;
  auth: AuthService;
  uploads: UploadService;
  chat: ChatService;
  hub: ChatHub;
  stories: StoryService;
  invites: InviteService;
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
  const storage = options.storage === undefined ? storageFromConfig(config, options.now) : options.storage;
  const uploads = new UploadService(db, storage, app.log, options.now);
  const auth = new AuthService({ db, config, mailer, verifier, uploads, ...(options.now ? { now: options.now } : {}) });

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
  const entitlements = new EntitlementService(db, options.now);
  subscriptionRoutes(app, entitlements, auth, config);
  uploadRoutes(app, uploads, auth, config);
  // Live chat: a WebSocket gateway plus Expo notifications for people who are not connected.
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });
  const hub = new ChatHub(db, auth, app.log, { ...defaultHubOptions, ...options.hub }, options.now);
  const chat = new ChatService(db, uploads, tee(hub, options.chatEvents ?? noEvents), options.now);
  const pushSender = options.pushSender === undefined ? (config.NODE_ENV === 'test' ? null : new ExpoPushSender(app.log, fetch, config.EXPO_ACCESS_TOKEN || undefined)) : options.pushSender;
  hub.attach(chat, pushSender ? new PushNotifier(db, pushSender, app.log) : null);
  hub.start();
  app.get('/v1/ws', { websocket: true }, (socket) => hub.accept(socket));
  chatRoutes(app, chat, auth);
  const postService = new PostService(db, uploads, options.now);
  socialRoutes(app, new FollowService(db), postService, auth, config);
  communityRoutes(app, new CommunityService(db, uploads, tee(hub, options.chatEvents ?? noEvents), options.now), postService, auth);
  const invites = new InviteService(db, options.now);
  inviteRoutes(app, invites, new HouseService(db, options.now), auth, config);
  const stories = new StoryService(db, uploads, options.now);
  storyRoutes(app, stories, new ReportService(db, chat, options.now), auth, config);
  recipeRoutes(app, new RecipeService(db, entitlements), auth);
  const pantry = new PantryService(db, options.now);
  const shopping = new ShoppingService(db);
  kitchenRoutes(app, { pantry, shopping, wantToCook: new WantToCookService(db, pantry, shopping, options.now) }, auth);
  cookbookRoutes(app, new CookbookService(db), auth);
  adRoutes(app, new AdService(db, options.now), auth, config, entitlements);
  mealPlanRoutes(app, new MealPlanService(db, options.now), new WasteService(db, options.now), auth);

  app.addHook('onClose', async () => {
    hub.stop();
    if (!options.db) await db.$disconnect();
  });

  return { app, db, auth, uploads, chat, hub, stories, invites };
}
