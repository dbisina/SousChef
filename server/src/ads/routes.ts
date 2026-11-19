import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AD_BUDGET_RANGES,
  AD_FORMATS,
  AD_PLACEMENTS,
  isIsoDay,
  type AdInquiryRequest,
  type CreateAdRequest,
  type UpdateAdRequest,
} from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { EntitlementService } from '../subscriptions/service';
import type { AdService } from './service';

const text = (max: number) => z.string().trim().max(max);
const url = z.url({ protocol: /^https?$/ }).max(2048);
const isoDateTime = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date');
const placements = z.array(z.enum(AD_PLACEMENTS)).min(1).max(AD_PLACEMENTS.length);
const status = z.enum(['active', 'paused', 'pending_review']);
const cents = z.number().int().min(0).max(1_000_000_000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #22C55E');

const createSchema = z
  .object({
    advertiserName: text(100).min(1),
    advertiserLogoUrl: url.optional(),
    title: text(120).min(1),
    subtitle: text(300),
    imageUrl: url,
    ctaText: text(40).min(1),
    ctaUrl: url,
    placements,
    format: z.enum(AD_FORMATS),
    status: status.optional(),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    budgetCents: cents.optional(),
    cpmCents: cents.optional(),
    accentColor: color.optional(),
    darkMode: z.boolean().optional(),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: 'The end must be after the start', path: ['endsAt'] }) satisfies z.ZodType<CreateAdRequest>;

const updateSchema = z
  .object({
    advertiserName: text(100).min(1).optional(),
    advertiserLogoUrl: url.nullable().optional(),
    title: text(120).min(1).optional(),
    subtitle: text(300).optional(),
    imageUrl: url.optional(),
    ctaText: text(40).min(1).optional(),
    ctaUrl: url.optional(),
    placements: placements.optional(),
    format: z.enum(AD_FORMATS).optional(),
    status: status.optional(),
    startsAt: isoDateTime.optional(),
    endsAt: isoDateTime.optional(),
    budgetCents: cents.optional(),
    cpmCents: cents.optional(),
    accentColor: color.nullable().optional(),
    darkMode: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateAdRequest>;

const inquirySchema = z.object({
  name: text(100).min(1),
  email: text(254).pipe(z.email()),
  company: text(100).min(1),
  website: url.optional(),
  budget: z.enum(AD_BUDGET_RANGES),
  placements,
  startDate: z.string().refine(isIsoDay, 'Use a date like 2026-12-01').optional(),
  message: text(2000).min(1),
}) satisfies z.ZodType<AdInquiryRequest>;

const placementQuery = z.object({ placement: z.enum(AD_PLACEMENTS) });
/** A real ad's id, or `fallback` for enplace's own. */
const adIdParam = z.object({ id: z.union([z.uuid(), z.literal('fallback')]) });
const idParam = z.object({ id: z.uuid() });
const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(30) });
const inquiryListQuery = z.object({
  status: z.enum(['new', 'contacted', 'active', 'declined']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(100).optional(),
});
const inquiryStatusSchema = z.object({ status: z.enum(['new', 'contacted', 'active', 'declined']) });

export function adRoutes(app: FastifyInstance, ads: AdService, auth: AuthService, config: Config, entitlements: EntitlementService): void {
  const { requireAdmin, optionalViewer } = viewerResolvers(auth);
  // Counting a view or click is open to anyone, so it is limited per address; so is the advertiser form.
  const tracking = { config: { rateLimit: { max: Math.min(config.RATE_LIMIT_MAX, 60), timeWindow: '1 minute' } } };
  const strict = { config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  /**
   * The ad to show in a place. enplace's own ad stands in when no campaign is running. People on a plan that is
   * ad-free get `{ ad: null }`.
   */
  app.get('/v1/ads', async (request) => {
    const { placement } = parse(placementQuery, request.query);
    const viewer = await optionalViewer(request);
    if (viewer && (await entitlements.forUser(viewer.userId)).features.adFree) return { ad: null };
    return { ad: await ads.forPlacement(placement) };
  });

  app.post('/v1/ads/:id/impression', tracking, async (request, reply) => {
    await ads.record(parse(adIdParam, request.params).id, 'impression');
    return reply.code(204).send();
  });

  app.post('/v1/ads/:id/click', tracking, async (request, reply) => {
    await ads.record(parse(adIdParam, request.params).id, 'click');
    return reply.code(204).send();
  });

  app.post('/v1/ad-inquiries', strict, async (request, reply) => {
    await ads.submitInquiry(parse(inquirySchema, request.body));
    return reply.code(202).send();
  });

  /* ---- staff only ---- */

  app.get('/v1/admin/ads', async (request) => {
    await requireAdmin(request);
    return { items: await ads.listAll() };
  });

  app.post('/v1/admin/ads', async (request, reply) => {
    await requireAdmin(request);
    return reply.code(201).send(await ads.create(parse(createSchema, request.body)));
  });

  app.patch('/v1/admin/ads/:id', async (request) => {
    await requireAdmin(request);
    return ads.update(parse(idParam, request.params).id, parse(updateSchema, request.body));
  });

  app.delete('/v1/admin/ads/:id', async (request, reply) => {
    await requireAdmin(request);
    await ads.remove(parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.get('/v1/admin/ads/:id/stats', async (request) => {
    await requireAdmin(request);
    return { days: await ads.dailyStats(parse(idParam, request.params).id, parse(statsQuery, request.query).days) };
  });

  app.get('/v1/admin/ad-inquiries', async (request) => {
    await requireAdmin(request);
    const { status: s, limit, cursor } = parse(inquiryListQuery, request.query);
    return ads.listInquiries(s, limit, cursor);
  });

  app.patch('/v1/admin/ad-inquiries/:id', async (request) => {
    await requireAdmin(request);
    return ads.setInquiryStatus(parse(idParam, request.params).id, parse(inquiryStatusSchema, request.body).status);
  });
}
