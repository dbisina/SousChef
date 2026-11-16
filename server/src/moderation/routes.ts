import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChefVerificationRequest, RejectChefRequest, SuspendRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { ChefVerificationService } from './chef';
import type { ModerationService } from './service';

const idParam = z.object({ id: z.uuid() });
const reasonText = z.string().trim().min(3).max(500);
const suspendSchema = z.object({ reason: reasonText }) satisfies z.ZodType<SuspendRequest>;
const rejectSchema = z.object({ reason: reasonText }) satisfies z.ZodType<RejectChefRequest>;
const requestSchema = z.object({
  note: z.string().trim().min(10, 'Tell us a little about your cooking').max(1000),
  portfolioUrl: z.url({ protocol: /^https?$/ }).max(2048).optional(),
}) satisfies z.ZodType<ChefVerificationRequest>;
const listSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
});

export function moderationRoutes(app: FastifyInstance, moderation: ModerationService, chef: ChefVerificationService, auth: AuthService): void {
  const { requireViewer, requireAdmin } = viewerResolvers(auth);

  /* ---- staff: people and the automatic check ---- */

  app.post('/v1/admin/users/:id/suspend', async (request, reply) => {
    const staff = await requireAdmin(request);
    await moderation.suspend(staff, parse(idParam, request.params).id, parse(suspendSchema, request.body).reason);
    return reply.code(204).send();
  });

  app.post('/v1/admin/users/:id/unsuspend', async (request, reply) => {
    await requireAdmin(request);
    await moderation.unsuspend(parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  /** Runs the model check on waiting posts now (the job runner does this on a schedule). */
  app.post('/v1/admin/moderation/run', async (request) => {
    await requireAdmin(request);
    return moderation.reviewPending();
  });

  /* ---- the verified-chef badge ---- */

  app.get('/v1/chef/verification', async (request) => chef.mine((await requireViewer(request)).userId));

  app.post('/v1/chef/verification', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await chef.request(userId, parse(requestSchema, request.body)));
  });

  app.get('/v1/admin/chef-verifications', async (request) => {
    await requireAdmin(request);
    const q = parse(listSchema, request.query);
    return chef.list({ status: q.status, limit: q.limit, cursor: q.cursor });
  });

  app.post('/v1/admin/chef-verifications/:id/approve', async (request) => chef.approve(await requireAdmin(request), parse(idParam, request.params).id));

  app.post('/v1/admin/chef-verifications/:id/reject', async (request) => {
    const staff = await requireAdmin(request);
    return chef.reject(staff, parse(idParam, request.params).id, parse(rejectSchema, request.body).reason);
  });

  app.post('/v1/admin/users/:id/chef/revoke', async (request, reply) => {
    const staff = await requireAdmin(request);
    await chef.revoke(staff, parse(idParam, request.params).id);
    return reply.code(204).send();
  });
}
