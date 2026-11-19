import { randomInt } from 'node:crypto';
import type {
  CreatePromoCodeRequest,
  CreateSaleRequest,
  GrantPlanRequest,
  PromoCodeAdmin,
  PromoGrantAdmin,
  PromoTier,
  RedeemPromoCodeResponse,
  SaleView,
} from '@shared';
import type { Db } from '../db';
import { isUniqueViolation } from '../db';
import { errors } from '../errors';

const DAY_MS = 86_400_000;
/** No 0/O or 1/I/L, which get misread when a code is read aloud or typed. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = (): string => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const asTier = (tier: string): PromoTier => (tier === 'pro' ? 'pro' : 'premium');

/** What people typed may have spaces, dashes or lower case. */
export const normaliseCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export class PromoService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /* ---- time on a plan ---- */

  /** Adds free time after any time they already have running, so two grants never overlap or waste days. */
  private async addTime(userId: string, tier: PromoTier, days: number, key: string, note: string | null): Promise<{ endsAt: Date; fresh: boolean }> {
    const now = this.now();
    const running = await this.db.promoGrant.findFirst({ where: { userId, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' }, select: { endsAt: true } });
    const startsAt = running ? running.endsAt : now;
    const endsAt = new Date(startsAt.getTime() + days * DAY_MS);
    const made = await this.db.promoGrant.createMany({ data: [{ userId, tier, key, startsAt, endsAt, note }], skipDuplicates: true });
    return { endsAt, fresh: made.count > 0 };
  }

  /** Staff give a plan to one person, found by email. */
  async grant(adminId: string, input: GrantPlanRequest): Promise<PromoGrantAdmin> {
    const user = await this.db.user.findFirst({ where: { email: { equals: input.email.trim(), mode: 'insensitive' } }, select: { id: true } });
    if (!user) throw errors.notFound('No account has that email yet. Ask them to sign up first');
    // A fresh key each time: staff can give the same person more time on purpose.
    const key = `admin:${adminId}:${this.now().getTime()}:${randomInt(1_000_000)}`;
    await this.addTime(user.id, input.tier, input.days, key, input.note?.trim() || null);
    const row = await this.db.promoGrant.findUniqueOrThrow({
      where: { userId_key: { userId: user.id, key } },
      include: { user: { select: { email: true, handle: true } } },
    });
    return this.grantView(row);
  }

  async grants(): Promise<PromoGrantAdmin[]> {
    const rows = await this.db.promoGrant.findMany({
      where: { endsAt: { gt: this.now() }, OR: [{ key: { startsWith: 'admin:' } }, { key: { startsWith: 'code:' } }] },
      orderBy: { endsAt: 'desc' },
      take: 200,
      include: { user: { select: { email: true, handle: true } } },
    });
    return rows.map((r) => this.grantView(r));
  }

  async revokeGrant(id: string): Promise<void> {
    const gone = await this.db.promoGrant.deleteMany({ where: { id } });
    if (gone.count === 0) throw errors.notFound('That grant is gone already');
  }

  private grantView(row: {
    id: string;
    userId: string;
    tier: string;
    startsAt: Date;
    endsAt: Date;
    key: string;
    note: string | null;
    user: { email: string | null; handle: string };
  }): PromoGrantAdmin {
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      handle: row.user.handle,
      tier: asTier(row.tier),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      key: row.key,
      note: row.note,
    };
  }

  /* ---- codes ---- */

  async createCode(adminId: string, input: CreatePromoCodeRequest): Promise<PromoCodeAdmin> {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= this.now()) throw errors.validation({ expiresAt: 'The end date must be in the future' });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await this.db.promoCode.create({
          data: { code: newCode(), tier: input.tier, days: input.days, maxUses: input.maxUses, expiresAt, note: input.note?.trim() || null, createdBy: adminId },
        });
        return this.codeView(row);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err; // a clash on the random code: draw another
      }
    }
    throw errors.conflict('Could not make a code. Try again');
  }

  async codes(): Promise<PromoCodeAdmin[]> {
    const rows = await this.db.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((r) => this.codeView(r));
  }

  async setCodeActive(id: string, active: boolean): Promise<PromoCodeAdmin> {
    const row = await this.db.promoCode.update({ where: { id }, data: { active } }).catch(() => null);
    if (!row) throw errors.notFound('That code is gone');
    return this.codeView(row);
  }

  private codeView(row: { id: string; code: string; tier: string; days: number; maxUses: number; usedCount: number; expiresAt: Date | null; note: string | null; active: boolean; createdAt: Date }): PromoCodeAdmin {
    return {
      id: row.id,
      code: row.code,
      tier: asTier(row.tier),
      days: row.days,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      note: row.note,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** A person types a code. One use per person; the code's own limit is enforced in a single statement so two people cannot both take the last use. */
  async redeem(userId: string, raw: string): Promise<RedeemPromoCodeResponse> {
    const code = normaliseCode(raw);
    const row = await this.db.promoCode.findUnique({ where: { code } });
    const now = this.now();
    if (!row || !row.active || (row.expiresAt && row.expiresAt <= now)) throw errors.notFound('That code is not valid');
    if (row.usedCount >= row.maxUses) throw errors.conflict('That code has been used up');

    const key = `code:${row.id}`;
    return this.db.$transaction(async (tx) => {
      const taken = await tx.promoRedemption.createMany({ data: [{ codeId: row.id, userId }], skipDuplicates: true });
      if (taken.count === 0) throw errors.conflict('You have used this code already');
      const bumped = await tx.$executeRaw`UPDATE "PromoCode" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${row.id}::uuid AND "usedCount" < "maxUses"`;
      if (bumped === 0) throw errors.conflict('That code has been used up');

      const running = await tx.promoGrant.findFirst({ where: { userId, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' }, select: { endsAt: true } });
      const startsAt = running ? running.endsAt : now;
      const endsAt = new Date(startsAt.getTime() + row.days * DAY_MS);
      await tx.promoGrant.create({ data: { userId, tier: row.tier, key, startsAt, endsAt, note: row.note } });
      return { tier: asTier(row.tier), endsAt: endsAt.toISOString() };
    });
  }

  /* ---- sales ---- */

  async createSale(adminId: string, input: CreateSaleRequest): Promise<SaleView> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) throw errors.validation({ endsAt: 'The sale must end after it starts' });
    const row = await this.db.sale.create({
      data: { tier: input.tier ?? null, percentOff: input.percentOff, label: input.label.trim(), startsAt, endsAt, createdBy: adminId },
    });
    return this.saleView(row);
  }

  async sales(): Promise<SaleView[]> {
    const rows = await this.db.sale.findMany({ orderBy: { startsAt: 'desc' }, take: 100 });
    return rows.map((r) => this.saleView(r));
  }

  async endSale(id: string): Promise<SaleView> {
    const row = await this.db.sale.update({ where: { id }, data: { active: false } }).catch(() => null);
    if (!row) throw errors.notFound('That sale is gone');
    return this.saleView(row);
  }

  /** The sale the plans screen should mention now, or null. If two overlap, the bigger discount wins. */
  async currentSale(): Promise<SaleView | null> {
    const now = this.now();
    const row = await this.db.sale.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { percentOff: 'desc' } });
    return row ? this.saleView(row) : null;
  }

  private saleView(row: { id: string; tier: string | null; percentOff: number; label: string; startsAt: Date; endsAt: Date; active: boolean }): SaleView {
    return {
      id: row.id,
      tier: row.tier ? asTier(row.tier) : null,
      percentOff: row.percentOff,
      label: row.label,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      active: row.active,
    };
  }
}
