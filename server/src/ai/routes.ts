import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MEAL_TYPES, type GenerateMealPlanRequest, type SubstituteRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
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
}) satisfies z.ZodType<GenerateMealPlanRequest>;

export function aiToolsRoutes(app: FastifyInstance, tools: AiToolsService, auth: AuthService, config: Config): void {
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
}
