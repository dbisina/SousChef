import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { AdminService } from './service';

const usageQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });

/** Staff-only numbers for the admin dashboard. Everything else staff do uses the existing /v1/admin/* routes. */
export function adminRoutes(app: FastifyInstance, admin: AdminService, auth: AuthService): void {
  const { requireAdmin } = viewerResolvers(auth);
  // These numbers are for staff eyes only: nothing may keep a copy.
  const noStore = (reply: { header: (k: string, v: string) => unknown }) => void reply.header('cache-control', 'no-store');

  app.get('/v1/admin/stats', async (request, reply) => {
    await requireAdmin(request);
    noStore(reply);
    return admin.stats();
  });

  app.get('/v1/admin/ai/usage', async (request, reply) => {
    await requireAdmin(request);
    noStore(reply);
    return admin.aiUsage(parse(usageQuery, request.query).days);
  });

  app.get('/v1/admin/ai/keys', async (request, reply) => {
    await requireAdmin(request);
    noStore(reply);
    return admin.aiKeys();
  });
}
