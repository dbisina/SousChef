import type { AdminChefVerification, ChefVerificationRequest, ChefVerificationStatus, ChefVerificationView, Page } from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

const withUser = { user: { select: authorSelect } } satisfies Prisma.ChefVerificationInclude;
type Row = Prisma.ChefVerificationGetPayload<{ include: typeof withUser }>;
type Status = Exclude<ChefVerificationStatus, 'none'>;

/**
 * The verified-chef badge. A person on a paid plan asks; staff look at their portfolio and approve or reject. Only an
 * approval sets the badge, and only staff can take it away. The earned (promo) Pro month does not count as paying.
 */
export class ChefVerificationService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async request(userId: string, input: ChefVerificationRequest): Promise<ChefVerificationView> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { verifiedChefAt: true } });
    if (!user) throw errors.unauthorized();
    if (user.verifiedChefAt) throw errors.conflict('You are already a verified chef');
    if (!(await this.paysForPlan(userId))) throw errors.upgradeRequired('premium');
    await this.db.$transaction(async (tx) => {
      // One open request at a time, even if two arrive together.
      await tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      if (await tx.chefVerification.findFirst({ where: { userId, status: 'pending' }, select: { id: true } })) {
        throw errors.conflict('You already have a request waiting for review');
      }
      await tx.chefVerification.create({ data: { userId, note: input.note, portfolioUrl: input.portfolioUrl ?? null, submittedAt: this.now() } });
    });
    return this.mine(userId);
  }

  async mine(userId: string): Promise<ChefVerificationView> {
    const row = await this.db.chefVerification.findFirst({ where: { userId }, orderBy: { submittedAt: 'desc' } });
    if (!row) return { status: 'none', note: null, portfolioUrl: null, submittedAt: null, decidedAt: null, rejectionReason: null };
    return { status: row.status as Status, note: row.note, portfolioUrl: row.portfolioUrl, submittedAt: row.submittedAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null, rejectionReason: row.rejectionReason };
  }

  /* ------------------------------------------------------------------ staff */

  async list(opts: { status?: Status | undefined; limit: number; cursor?: string | undefined }): Promise<Page<AdminChefVerification>> {
    const rows = await this.db.chefVerification.findMany({
      where: opts.status ? { status: opts.status } : {},
      include: withUser,
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }], // longest waiting first
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, opts.limit);
    return { items: page.map(toAdmin), nextCursor: rows.length > opts.limit ? (page.at(-1)?.id ?? null) : null };
  }

  async approve(staff: Viewer, id: string): Promise<AdminChefVerification> {
    return this.decide(staff, id, 'approved', null);
  }

  async reject(staff: Viewer, id: string, reason: string): Promise<AdminChefVerification> {
    return this.decide(staff, id, 'rejected', reason);
  }

  /** Takes the badge away. The person can ask again later. */
  async revoke(staff: Viewer, userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { verifiedChefAt: true } });
    if (!user) throw errors.notFound('Person not found');
    if (!user.verifiedChefAt) throw errors.conflict('That person is not a verified chef');
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { verifiedChefAt: null } }),
      this.db.chefVerification.updateMany({ where: { userId, status: 'approved' }, data: { status: 'revoked', decidedAt: this.now(), decidedById: staff.userId } }),
    ]);
  }

  /* ------------------------------------------------------------------ helpers */

  private async decide(staff: Viewer, id: string, status: 'approved' | 'rejected', reason: string | null): Promise<AdminChefVerification> {
    await this.db.$transaction(async (tx) => {
      const claimed = await tx.chefVerification.updateMany({
        where: { id, status: 'pending' },
        data: { status, decidedAt: this.now(), decidedById: staff.userId, rejectionReason: reason },
      });
      if (claimed.count === 0) {
        if (!(await tx.chefVerification.findUnique({ where: { id }, select: { id: true } }))) throw errors.notFound('Request not found');
        throw errors.conflict('That request was already decided');
      }
      if (status === 'approved') {
        const row = await tx.chefVerification.findUniqueOrThrow({ where: { id }, select: { userId: true } });
        await tx.user.update({ where: { id: row.userId }, data: { isChef: true, verifiedChefAt: this.now() } });
      }
    });
    return toAdmin(await this.db.chefVerification.findUniqueOrThrow({ where: { id }, include: withUser }));
  }

  /** Is there a paid subscription running right now? */
  private async paysForPlan(userId: string): Promise<boolean> {
    const sub = await this.db.subscription.findUnique({ where: { userId } });
    return sub !== null && sub.status !== 'EXPIRED' && (sub.expiresAt === null || sub.expiresAt > this.now());
  }
}

function toAdmin(r: Row): AdminChefVerification {
  return {
    id: r.id,
    user: toAuthor(r.user),
    status: r.status as Status,
    note: r.note,
    portfolioUrl: r.portfolioUrl,
    submittedAt: r.submittedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
  };
}
