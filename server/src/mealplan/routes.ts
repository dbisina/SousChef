import type { FastifyInstance } from 'fastify';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import {
  idParam,
  logWasteSchema,
  planListQuery,
  planMealParams,
  planShoppingParams,
  plannedMealSchema,
  saveMealPlanSchema,
  shoppingCheckSchema,
  wasteListQuery,
  weekStartParam,
} from './schemas';
import type { MealPlanService, WasteService } from './service';
import { errors } from '../errors';

/** Meal plans and the food-waste log, all under /v1/me/. Every route needs a sign-in. */
export function mealPlanRoutes(app: FastifyInstance, plans: MealPlanService, waste: WasteService, auth: AuthService): void {
  const { requireViewer } = viewerResolvers(auth);

  /* ---- meal plans ---- */

  app.get('/v1/me/meal-plans', async (request) => {
    const { userId } = await requireViewer(request);
    const { limit, cursor } = parse(planListQuery, request.query);
    return plans.list(userId, limit, cursor);
  });

  /** This week's plan, or `{ plan: null }` when none has been made yet. */
  app.get('/v1/me/meal-plans/current', async (request) => {
    const { userId } = await requireViewer(request);
    return { plan: await plans.current(userId) };
  });

  app.get('/v1/me/meal-plans/:weekStart', async (request) => {
    const { userId } = await requireViewer(request);
    const plan = await plans.get(userId, parse(weekStartParam, request.params).weekStart);
    if (!plan) throw errors.notFound('Meal plan not found');
    return plan;
  });

  app.put('/v1/me/meal-plans/:weekStart', async (request) => {
    const { userId } = await requireViewer(request);
    return plans.save(userId, parse(weekStartParam, request.params).weekStart, parse(saveMealPlanSchema, request.body));
  });

  app.delete('/v1/me/meal-plans/:weekStart', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await plans.remove(userId, parse(weekStartParam, request.params).weekStart);
    return reply.code(204).send();
  });

  app.put('/v1/me/meal-plans/:weekStart/days/:date/:mealType', async (request) => {
    const { userId } = await requireViewer(request);
    const p = parse(planMealParams, request.params);
    return plans.setMeal(userId, p.weekStart, p.date, p.mealType, parse(plannedMealSchema, request.body));
  });

  app.delete('/v1/me/meal-plans/:weekStart/days/:date/:mealType', async (request) => {
    const { userId } = await requireViewer(request);
    const p = parse(planMealParams, request.params);
    return plans.setMeal(userId, p.weekStart, p.date, p.mealType, null);
  });

  app.put('/v1/me/meal-plans/:weekStart/shopping/:itemId/checked', async (request) => {
    const { userId } = await requireViewer(request);
    const p = parse(planShoppingParams, request.params);
    return plans.setChecked(userId, p.weekStart, p.itemId, parse(shoppingCheckSchema, request.body).checked);
  });

  /* ---- food waste ---- */

  app.post('/v1/me/waste', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await waste.log(userId, parse(logWasteSchema, request.body)));
  });

  app.get('/v1/me/waste', async (request) => {
    const { userId } = await requireViewer(request);
    const { limit, cursor } = parse(wasteListQuery, request.query);
    return waste.list(userId, limit, cursor);
  });

  app.get('/v1/me/waste/stats', async (request) => {
    const { userId } = await requireViewer(request);
    return waste.stats(userId);
  });

  app.delete('/v1/me/waste/:id', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await waste.remove(userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });
}
