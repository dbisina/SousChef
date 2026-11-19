import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import { errors } from '../errors';
import type { PromoService } from './service';

const tier = z.enum(['premium', 'pro']);
const days = z.number().int().min(1).max(730);
const note = z.string().trim().max(200).optional();
const idParam = z.object({ id: z.uuid() });

const grantSchema = z.object({ email: z.string().trim().email().max(254), tier, days, note });
const codeSchema = z.object({
  tier,
  days,
  maxUses: z.number().int().min(1).max(100_000),
  expiresAt: z.iso.datetime().optional(),
  note,
});
const activeSchema = z.object({ active: z.boolean() });
const saleSchema = z.object({
  tier: tier.optional(),
  percentOff: z.number().int().min(1).max(90),
  label: z.string().trim().min(2).max(80),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
const redeemSchema = z.object({ code: z.string().trim().min(4).max(40) });

export function promoRoutes(app: FastifyInstance, promos: PromoService, auth: AuthService, config: Config): void {
  const { requireViewer, requireAdmin } = viewerResolvers(auth);
  // People guess at codes, so redeeming is limited as tightly as signing in.
  const strict = { config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };
  const noStore = (reply: { header: (k: string, v: string) => unknown }) => void reply.header('cache-control', 'no-store');

  /* ---- people ---- */

  app.post('/v1/me/redeem', strict, async (request) => {
    const { userId } = await requireViewer(request);
    // Apple does not allow unlocking paid plans with a code the app checks itself: iPhones use Apple's own code sheet.
    if (String(request.headers['x-platform'] ?? '').toLowerCase() === 'ios') {
      throw errors.forbidden("On iPhone, redeem with Apple's code sheet instead");
    }
    return promos.redeem(userId, parse(redeemSchema, request.body).code);
  });

  app.get('/v1/sales/current', async () => ({ sale: await promos.currentSale() }));

  /* ---- staff ---- */

  app.post('/v1/admin/promos/grant', async (request, reply) => {
    const admin = await requireAdmin(request);
    return reply.code(201).send(await promos.grant(admin.userId, parse(grantSchema, request.body)));
  });

  app.get('/v1/admin/promo-grants', async (request, reply) => {
    await requireAdmin(request);
    noStore(reply);
    return { items: await promos.grants() };
  });

  app.delete('/v1/admin/promo-grants/:id', async (request, reply) => {
    await requireAdmin(request);
    await promos.revokeGrant(parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.get('/v1/admin/promo-codes', async (request, reply) => {
    await requireAdmin(request);
    noStore(reply);
    return { items: await promos.codes() };
  });

  app.post('/v1/admin/promo-codes', async (request, reply) => {
    const admin = await requireAdmin(request);
    noStore(reply);
    return reply.code(201).send(await promos.createCode(admin.userId, parse(codeSchema, request.body)));
  });

  app.patch('/v1/admin/promo-codes/:id', async (request) => {
    await requireAdmin(request);
    return promos.setCodeActive(parse(idParam, request.params).id, parse(activeSchema, request.body).active);
  });

  app.get('/v1/admin/sales', async (request) => {
    await requireAdmin(request);
    return { items: await promos.sales() };
  });

  app.post('/v1/admin/sales', async (request, reply) => {
    const admin = await requireAdmin(request);
    return reply.code(201).send(await promos.createSale(admin.userId, parse(saleSchema, request.body)));
  });

  app.post('/v1/admin/sales/:id/end', async (request) => {
    await requireAdmin(request);
    return promos.endSale(parse(idParam, request.params).id);
  });
}
