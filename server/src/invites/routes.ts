import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateHouseAccountRequest, CreateHousePostRequest, RedeemInviteRequest } from '@shared';
import { POST_KINDS } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { HouseService } from './house';
import type { InviteService } from './service';

const text = (max: number) => z.string().trim().max(max);
const url = z.url({ protocol: /^https?$/ }).max(2048);

const redeemSchema = z.object({ code: text(16).min(4) }) satisfies z.ZodType<RedeemInviteRequest>;
const houseAccountSchema = z.object({
  displayName: text(50).min(2, 'Give the account a name'),
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/, 'Use 3 to 20 lowercase letters, numbers or underscores').optional(),
  bio: text(300).optional(),
  photoUrl: url.optional(),
}) satisfies z.ZodType<CreateHouseAccountRequest>;
const housePostSchema = z.object({
  kind: z.enum(POST_KINDS),
  title: text(120).min(1),
  caption: text(2000).optional(),
  meta: text(120).optional(),
  recipeId: z.uuid().optional(),
  photoUrl: url,
  videoUrl: url.optional(),
}) satisfies z.ZodType<CreateHousePostRequest>;
const idParam = z.object({ id: z.uuid() });

export function inviteRoutes(app: FastifyInstance, invites: InviteService, house: HouseService, auth: AuthService, config: Config): void {
  const { requireViewer, requireAdmin } = viewerResolvers(auth);
  // People guess at codes, so redeeming is limited as tightly as signing in.
  const strict = { config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.get('/v1/me/invite', async (request) => invites.mine((await requireViewer(request)).userId));

  app.post('/v1/invites/redeem', strict, async (request) => {
    const { userId } = await requireViewer(request);
    return invites.redeem(userId, parse(redeemSchema, request.body).code);
  });

  /* ---- staff only: house accounts ---- */

  app.get('/v1/admin/house-accounts', async (request) => {
    await requireAdmin(request);
    return { items: await house.list() };
  });

  app.post('/v1/admin/house-accounts', async (request, reply) => {
    await requireAdmin(request);
    return reply.code(201).send(await house.create(parse(houseAccountSchema, request.body)));
  });

  app.delete('/v1/admin/house-accounts/:id', async (request, reply) => {
    await requireAdmin(request);
    await house.remove(parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.post('/v1/admin/house-accounts/:id/posts', async (request, reply) => {
    await requireAdmin(request);
    return reply.code(201).send(await house.post(parse(idParam, request.params).id, parse(housePostSchema, request.body)));
  });

  /** The kill switch: take every house post out of sight, or put them back. */
  app.post('/v1/admin/house/off', async (request) => {
    await requireAdmin(request);
    return house.setVisible(false);
  });
  app.post('/v1/admin/house/on', async (request) => {
    await requireAdmin(request);
    return house.setVisible(true);
  });
}
