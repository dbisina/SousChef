import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import { AppError, errors } from '../errors';
import type { EntitlementService } from './service';

const webhookSchema = z.object({
  event: z.object({
    id: z.string().min(1).max(200),
    type: z.string().max(60),
    app_user_id: z.string().max(200).optional(),
    original_app_user_id: z.string().max(200).optional(),
    aliases: z.array(z.string().max(200)).max(50).optional(),
    product_id: z.string().max(200).nullish(),
    entitlement_ids: z.array(z.string().max(100)).max(20).nullish(),
    expiration_at_ms: z.number().nullish(),
    event_timestamp_ms: z.number(),
    store: z.string().max(40).nullish(),
  }),
});

/** Compares two strings without the time taken revealing how many leading characters matched. */
const sameSecret = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function subscriptionRoutes(app: FastifyInstance, entitlements: EntitlementService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);

  /** The signed-in person's plan and what it allows. The phone shows this; the server enforces it. */
  app.get('/v1/me/entitlements', async (request) => {
    const { userId } = await requireViewer(request);
    return entitlements.forUser(userId);
  });

  /**
   * RevenueCat tells us when someone buys, renews, cancels or lapses. In the RevenueCat dashboard set the webhook's
   * Authorization header to "Bearer <REVENUECAT_WEBHOOK_SECRET>". Always answers 200 for a well-formed event from
   * RevenueCat (even one we ignore), because it retries anything else.
   */
  app.post('/v1/webhooks/revenuecat', async (request) => {
    if (!config.REVENUECAT_WEBHOOK_SECRET) {
      throw new AppError(501, 'provider_not_configured', 'Subscriptions are not set up on this server');
    }
    const sent = request.headers.authorization ?? '';
    if (!sameSecret(sent, `Bearer ${config.REVENUECAT_WEBHOOK_SECRET}`)) throw errors.unauthorized('Not allowed');
    const { event } = parse(webhookSchema, request.body);
    return { status: await entitlements.applyRevenueCatEvent(event) };
  });
}
