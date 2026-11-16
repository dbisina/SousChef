import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateMealRequest, CreateReadingRequest, GrantHealthConsentRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { VitalsService } from './service';

const iso = z.iso.datetime({ offset: true });
const idParam = z.object({ id: z.uuid() });
const source = z.enum(['manual', 'apple-health', 'sample']).optional();
const base = { at: iso, source, mealId: z.uuid().optional() };

const readingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('glucose'), ...base, mmol: z.number(), timing: z.enum(['fasting', 'before-meal', '1h-after', '2h-after', 'bedtime']) }),
  z.object({ kind: z.literal('bp'), ...base, systolic: z.number().int(), diastolic: z.number().int() }),
  z.object({ kind: z.literal('cholesterol'), ...base, ldl: z.number() }),
]) as unknown as z.ZodType<CreateReadingRequest>;

const text = (max: number) => z.string().trim().min(1).max(max);
const mealSchema = z.object({
  title: text(120),
  mealType: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']),
  at: iso,
  carbsG: z.number().min(0).max(1000),
  portionLabel: text(80),
  group: text(80),
  variant: text(80).optional(),
}) satisfies z.ZodType<CreateMealRequest>;

const consentSchema = z.object({ version: text(40) }) satisfies z.ZodType<GrantHealthConsentRequest>;
const listSchema = z.object({
  from: iso.optional(),
  to: iso.optional(),
  kind: z.enum(['glucose', 'bp', 'cholesterol']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().max(200).optional(),
});
const mealListSchema = z.object({ from: iso.optional(), to: iso.optional(), limit: z.coerce.number().int().min(1).max(200).optional() });
const reportSchema = z.object({ range: z.enum(['2w', '30d', '90d']).default('30d') });

export function vitalsRoutes(app: FastifyInstance, vitals: VitalsService, auth: AuthService): void {
  const { requireViewer } = viewerResolvers(auth);
  const me = async (request: Parameters<typeof requireViewer>[0]) => (await requireViewer(request)).userId;
  // Health answers must never be kept by a shared cache.
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/v1/health')) reply.header('cache-control', 'no-store');
  });

  app.get('/v1/health/consent', async (request) => vitals.consent(await me(request)));
  app.put('/v1/health/consent', async (request) => vitals.grantConsent(await me(request), parse(consentSchema, request.body).version));
  app.delete('/v1/health/consent', async (request) => vitals.withdrawConsent(await me(request)));

  app.post('/v1/health/readings', async (request, reply) => reply.code(201).send(await vitals.addReading(await me(request), parse(readingSchema, request.body))));
  app.get('/v1/health/readings', async (request) => vitals.listReadings(await me(request), parse(listSchema, request.query)));
  app.delete('/v1/health/readings/:id', async (request, reply) => {
    await vitals.deleteReading(await me(request), parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.post('/v1/health/meals', async (request, reply) => reply.code(201).send(await vitals.addMeal(await me(request), parse(mealSchema, request.body))));
  app.get('/v1/health/meals', async (request) => ({ items: await vitals.listMeals(await me(request), parse(mealListSchema, request.query)) }));
  app.get('/v1/health/meals/:id/response', async (request) => vitals.mealResponse(await me(request), parse(idParam, request.params).id));
  app.delete('/v1/health/meals/:id', async (request, reply) => {
    await vitals.deleteMeal(await me(request), parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.get('/v1/health/report', async (request) => vitals.report(await me(request), parse(reportSchema, request.query).range));
  app.get('/v1/health/export', async (request, reply) => {
    const data = await vitals.export(await me(request));
    return reply.header('content-disposition', 'attachment; filename="souschef-health-export.json"').send(data);
  });
  app.delete('/v1/health/data', async (request) => vitals.erase(await me(request)));
}
