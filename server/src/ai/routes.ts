import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MEAL_TYPES, REWRITE_GOALS, type ChatAssistRequest, type CookChatRequest, type RewriteRecipeRequest, type ScaleNoteRequest, type ScaleRecipeRequest, type CaptionRequest, type GenerateMealPlanRequest, type LeftoversRequest, type PlateCheckRequest, type PlateNutritionRequest, type SearchIntentRequest, type SubstituteRequest, type TonightRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { InsightAiService } from './insightsAi';
import type { KitchenAiService } from './kitchenAi';
import type { ScaleAiService } from './scaleAi';
import type { AiToolsService } from './tools';

const text = (max: number) => z.string().trim().min(1).max(max);
const substituteSchema = z.object({
  ingredient: text(100),
  recipeTitle: text(100).optional(),
  restrictions: z.array(text(40)).max(20).optional(),
  pantry: z.array(text(100)).max(100).optional(),
}) satisfies z.ZodType<SubstituteRequest>;

const planSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(14),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1).max(4),
  servings: z.number().int().min(1).max(20),
  restrictions: z.array(text(40)).max(20).optional(),
  cuisines: z.array(text(40)).max(20).optional(),
  maxPrepTime: z.number().int().min(1).max(600).optional(),
  maxCookTime: z.number().int().min(1).max(600).optional(),
  calorieTarget: z.number().int().min(500).max(6000).optional(),
  prioritizeExpiring: z.boolean(),
  maximizeOverlap: z.boolean(),
  budget: z.object({ amount: z.number().positive().max(10_000_000), currency: z.string().trim().min(3).max(5) }).optional(),
  people: z.array(z.object({ name: text(40), restrictions: z.array(text(40)).max(20) })).min(1).max(8).optional(),
}) satisfies z.ZodType<GenerateMealPlanRequest>;

const restrictionsSchema = z.array(text(40)).max(20).optional();
const scanKitchenSchema = z.object({ uploadIds: z.array(z.uuid()).min(1).max(4), kind: z.enum(['fridge', 'receipt']) });
const tonightSchema = z.object({ maxMinutes: z.number().int().min(5).max(600).optional(), mood: text(60).optional(), restrictions: restrictionsSchema }) satisfies z.ZodType<TonightRequest>;
const leftoversSchema = z.object({ text: text(300), restrictions: restrictionsSchema }) satisfies z.ZodType<LeftoversRequest>;
const plateSchema = z.object({ uploadId: z.uuid(), recipeId: z.uuid().optional() }) satisfies z.ZodType<PlateCheckRequest>;
const plateNutritionSchema = z.object({ uploadId: z.uuid(), hints: z.array(text(60)).max(12).optional() }) satisfies z.ZodType<PlateNutritionRequest>;
const captionSchema = z.object({ uploadId: z.uuid() }) satisfies z.ZodType<CaptionRequest>;
const searchSchema = z.object({ q: text(200) }) satisfies z.ZodType<SearchIntentRequest>;

const rewriteSchema = z.object({ recipeId: z.uuid(), goal: z.enum(REWRITE_GOALS) }) satisfies z.ZodType<RewriteRecipeRequest>;
const cookChatSchema = z.object({
  recipeId: z.uuid(),
  stepIndex: z.number().int().min(0).max(100).optional(),
  question: text(300),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: text(300) })).max(6).optional(),
}) satisfies z.ZodType<CookChatRequest>;
const assistSchema = z.object({ conversationId: z.uuid(), mode: z.enum(['replies', 'summary']) }) satisfies z.ZodType<ChatAssistRequest>;

const idParam = z.object({ id: z.uuid() });
const scaleSchema = z.object({
  servings: z.number().int().min(1).max(100),
  units: z.enum(['original', 'metric', 'us']).optional(),
  temp: z.enum(['original', 'c', 'f']).optional(),
}) satisfies z.ZodType<ScaleRecipeRequest>;
const scaleNoteSchema = z.object({
  servings: z.number().int().min(1).max(100),
  amounts: z.array(z.object({ name: text(100), amount: z.number().positive().max(1_000_000), unit: z.string().trim().max(30) })).min(1).max(60),
  tip: z.string().trim().max(300).optional(),
  cookTimeMin: z.number().int().min(1).max(1440).optional(),
  panNote: z.string().trim().max(120).optional(),
}) satisfies z.ZodType<ScaleNoteRequest>;

export function aiToolsRoutes(app: FastifyInstance, tools: AiToolsService, kitchen: KitchenAiService, insight: InsightAiService, scale: ScaleAiService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);
  // Each call goes to a paid AI service, so the pace is limited on top of the daily allowance.
  const limited = { config: { rateLimit: { max: config.IMPORT_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.post('/v1/ai/substitute', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return tools.substitute(userId, parse(substituteSchema, request.body));
  });

  app.post('/v1/ai/meal-plan', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return tools.mealPlan(userId, parse(planSchema, request.body));
  });

  /* ---- what is in my kitchen ---- */

  /** Photos of a fridge or a receipt -> items to tick. Nothing is saved here. */
  app.post('/v1/ai/pantry-scan', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(scanKitchenSchema, request.body);
    return kitchen.pantryScan(userId, body.uploadIds, body.kind);
  });

  app.post('/v1/ai/tonight', limited, async (request) => kitchen.tonight((await requireViewer(request)).userId, parse(tonightSchema, request.body ?? {})));

  app.post('/v1/ai/leftovers', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(leftoversSchema, request.body);
    return kitchen.leftovers(userId, body.text, body.restrictions);
  });

  app.post('/v1/ai/plate-check', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(plateSchema, request.body);
    return kitchen.plateCheck(userId, body.uploadId, body.recipeId);
  });

  /** Calories and estimated nutrition from a photo of a plate. The photo is deleted after reading. */
  app.post('/v1/ai/plate-nutrition', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(plateNutritionSchema, request.body);
    return kitchen.plateNutrition(userId, body.uploadId, body.hints);
  });

  app.post('/v1/ai/caption', limited, async (request) => kitchen.caption((await requireViewer(request)).userId, parse(captionSchema, request.body).uploadId));

  /* ---- advice from your own numbers, rewriting, and help while cooking ---- */

  app.get('/v1/ai/waste-coach', async (request) => insight.wasteCoach((await requireViewer(request)).userId));

  /** Needs the health consent. Numbers only. */
  app.get('/v1/ai/health-summary', async (request, reply) => {
    void reply.header('cache-control', 'no-store');
    return insight.healthSummary((await requireViewer(request)).userId);
  });

  app.post('/v1/ai/rewrite-recipe', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(rewriteSchema, request.body);
    return insight.rewriteRecipe(userId, body.recipeId, body.goal);
  });

  app.post('/v1/ai/cook-chat', limited, async (request) => insight.cookChat((await requireViewer(request)).userId, parse(cookChatSchema, request.body)));

  app.post('/v1/ai/chat-assist', limited, async (request) => {
    const { userId } = await requireViewer(request);
    const body = parse(assistSchema, request.body);
    return insight.chatAssist(userId, body.conversationId, body.mode);
  });

  /* ---- cooking for more or fewer people, and the notes that teach it ---- */

  app.post('/v1/recipes/:id/scale', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return scale.scale(userId, parse(idParam, request.params).id, parse(scaleSchema, request.body));
  });

  app.get('/v1/recipes/:id/scale-notes', async (request) => {
    const { userId } = await requireViewer(request);
    return { items: await scale.listNotes(userId, parse(idParam, request.params).id) };
  });

  app.put('/v1/recipes/:id/scale-notes', async (request) => {
    const { userId } = await requireViewer(request);
    return scale.saveNote(userId, parse(idParam, request.params).id, parse(scaleNoteSchema, request.body));
  });

  app.delete('/v1/recipes/:id/scale-notes/:servings', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const { id, servings } = parse(idParam.extend({ servings: z.coerce.number().int().min(1).max(100) }), request.params);
    await scale.deleteNote(userId, id, servings);
    return reply.code(204).send();
  });

  app.post('/v1/ai/search-intent', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return (await kitchen.searchIntent(userId, parse(searchSchema, request.body).q)).response;
  });
}
