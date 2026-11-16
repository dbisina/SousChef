import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { REPORT_REASONS, REPORT_TARGETS, type CreateReportRequest, type CreateStoryRequest, type ReportAction } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { ReportService } from './reports';
import type { StoryService } from './stories';

const createStorySchema = z.object({ photoUploadId: z.uuid(), recipeId: z.uuid().optional() }) satisfies z.ZodType<CreateStoryRequest>;
const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
}) satisfies z.ZodType<CreateReportRequest>;
const actionSchema = z.object({ action: z.enum(['hide', 'restore', 'dismiss']) }) satisfies z.ZodType<{ action: ReportAction }>;

const idParam = z.object({ id: z.uuid() });
const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30), cursor: z.string().max(100).optional() });
const reportListQuery = z.object({
  status: z.enum(['open', 'actioned', 'dismissed']).optional(),
  type: z.enum(REPORT_TARGETS).optional(),
  limit: pageQuery.shape.limit,
  cursor: pageQuery.shape.cursor,
});

/** Stories, reporting, and the staff moderation queue. */
export function storyRoutes(app: FastifyInstance, stories: StoryService, reports: ReportService, auth: AuthService, config: Config): void {
  const { requireViewer, requireAdmin } = viewerResolvers(auth);
  // Opening a story counts a view, so it is limited per address like the other counting routes.
  const tracking = { config: { rateLimit: { max: Math.min(config.RATE_LIMIT_MAX, 120), timeWindow: '1 minute' } } };

  app.post('/v1/stories', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await stories.create(userId, parse(createStorySchema, request.body)));
  });

  /** The row of circles at the top of the feed. */
  app.get('/v1/stories', async (request) => ({ groups: await stories.tray(await requireViewer(request)) }));

  app.get('/v1/users/:id/stories', async (request) => ({ group: await stories.byUser(parse(idParam, request.params).id, await requireViewer(request)) }));

  app.post('/v1/stories/:id/view', tracking, async (request, reply) => {
    await stories.view(parse(idParam, request.params).id, await requireViewer(request));
    return reply.code(204).send();
  });

  app.get('/v1/stories/:id/viewers', async (request) => {
    const viewer = await requireViewer(request);
    const { limit, cursor } = parse(pageQuery, request.query);
    return stories.viewers(parse(idParam, request.params).id, viewer, limit, cursor);
  });

  app.delete('/v1/stories/:id', async (request, reply) => {
    await stories.remove(parse(idParam, request.params).id, await requireViewer(request));
    return reply.code(204).send();
  });

  /* ---- reporting ---- */

  app.post('/v1/reports', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await reports.create(userId, parse(createReportSchema, request.body));
    return reply.code(202).send();
  });

  app.get('/v1/admin/reports', async (request) => {
    await requireAdmin(request);
    return reports.list(parse(reportListQuery, request.query));
  });

  app.post('/v1/admin/reports/:id/action', async (request) => {
    const staff = await requireAdmin(request);
    return reports.resolve(parse(idParam, request.params).id, staff, parse(actionSchema, request.body).action);
  });
}
