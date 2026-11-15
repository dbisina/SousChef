import { ENTITLEMENTS, TIER_FEATURES, type Entitlements, type SubscriptionStatus, type SubscriptionTier } from '@shared';
import type { Db } from '../db';

/** The parts of a RevenueCat webhook event this server uses. */
export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string | undefined;
  original_app_user_id?: string | undefined;
  aliases?: string[] | undefined;
  product_id?: string | null | undefined;
  entitlement_ids?: string[] | null | undefined;
  expiration_at_ms?: number | null | undefined;
  event_timestamp_ms: number;
  store?: string | null | undefined;
}

export type WebhookOutcome = 'applied' | 'duplicate' | 'ignored';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Stored = 'ACTIVE' | 'CANCELLED' | 'BILLING_ISSUE' | 'EXPIRED';
/** What each kind of event does to the plan. Events not listed here (TEST, TRANSFER, ...) change nothing. */
const EFFECT: Record<string, { status: Stored; willRenew: boolean }> = {
  INITIAL_PURCHASE: { status: 'ACTIVE', willRenew: true },
  RENEWAL: { status: 'ACTIVE', willRenew: true },
  UNCANCELLATION: { status: 'ACTIVE', willRenew: true },
  PRODUCT_CHANGE: { status: 'ACTIVE', willRenew: true },
  NON_RENEWING_PURCHASE: { status: 'ACTIVE', willRenew: false },
  CANCELLATION: { status: 'CANCELLED', willRenew: false },
  SUBSCRIPTION_PAUSED: { status: 'CANCELLED', willRenew: false },
  BILLING_ISSUE: { status: 'BILLING_ISSUE', willRenew: true },
  EXPIRATION: { status: 'EXPIRED', willRenew: false },
};

/** Which plan an event is about: by entitlement name first, then by the product's name. */
export function tierOfEvent(event: Pick<RevenueCatEvent, 'entitlement_ids' | 'product_id'>): 'premium' | 'pro' | null {
  const entitlements = event.entitlement_ids ?? [];
  if (entitlements.includes(ENTITLEMENTS.PRO)) return 'pro';
  if (entitlements.includes(ENTITLEMENTS.PREMIUM)) return 'premium';
  const product = (event.product_id ?? '').toLowerCase();
  if (product.startsWith('pro')) return 'pro';
  if (product.startsWith('premium')) return 'premium';
  return null;
}

export class EntitlementService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** What this person has right now. Free when they never paid, or when their paid period has run out. */
  async forUser(userId: string): Promise<Entitlements> {
    const row = await this.db.subscription.findUnique({ where: { userId } });
    if (!row) return this.free('none');
    const entitled = row.status !== 'EXPIRED' && (row.expiresAt === null || row.expiresAt > this.now());
    if (!entitled) return this.free('expired');
    const tier = row.tier === 'pro' ? 'pro' : 'premium';
    return {
      tier,
      features: TIER_FEATURES[tier],
      status: row.status.toLowerCase() as SubscriptionStatus,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      willRenew: row.willRenew,
    };
  }

  private free(status: SubscriptionStatus): Entitlements {
    const tier: SubscriptionTier = 'free';
    return { tier, features: TIER_FEATURES[tier], status, expiresAt: null, willRenew: false };
  }

  /**
   * Applies one webhook event. Safe to call twice with the same event (RevenueCat retries), and an event older than
   * the one already applied is ignored, so late delivery cannot undo a newer change.
   */
  async applyRevenueCatEvent(event: RevenueCatEvent): Promise<WebhookOutcome> {
    const effect = EFFECT[event.type];
    const tier = tierOfEvent(event);
    const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
      (id): id is string => typeof id === 'string' && UUID.test(id),
    );

    return this.db.$transaction(async (tx) => {
      const fresh = await tx.webhookEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
      if (fresh.count === 0) return 'duplicate';
      if (!effect || !tier || candidates.length === 0) return 'ignored';

      // The phone logs in to RevenueCat with our user id; anonymous ids and unknown people are not ours to update.
      const user = await tx.user.findFirst({ where: { id: { in: candidates } }, select: { id: true } });
      if (!user) return 'ignored';

      const at = new Date(event.event_timestamp_ms);
      const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
      // Insert, or update only if this event is not older than the last one applied: one atomic statement.
      const changed = await tx.$executeRaw`
        INSERT INTO "Subscription" ("userId", "tier", "productId", "store", "status", "willRenew", "expiresAt", "lastEventAt", "updatedAt")
        VALUES (${user.id}::uuid, ${tier}, ${event.product_id ?? null}, ${event.store ?? null}, ${effect.status}::"SubscriptionState",
                ${effect.willRenew}, ${expiresAt}::timestamptz, ${at}::timestamptz, now())
        ON CONFLICT ("userId") DO UPDATE SET
          "tier" = EXCLUDED."tier", "productId" = EXCLUDED."productId", "store" = EXCLUDED."store",
          "status" = EXCLUDED."status", "willRenew" = EXCLUDED."willRenew", "expiresAt" = EXCLUDED."expiresAt",
          "lastEventAt" = EXCLUDED."lastEventAt", "updatedAt" = now()
        WHERE "Subscription"."lastEventAt" <= EXCLUDED."lastEventAt"`;
      return changed > 0 ? 'applied' : 'ignored';
    });
  }
}
