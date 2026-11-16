import { randomInt } from 'node:crypto';
import { INVITES_PER_REWARD, type InviteStatus, type RedeemInviteResponse } from '@shared';
import type { Db } from '../db';
import { isUniqueViolation } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

const DAY_MS = 86_400_000;
/** Only recent accounts can use a code: it is for bringing new people in. */
const NEW_ACCOUNT_DAYS = 7;
const PROMO_DAYS = 30;
/** A person can earn at most this many rewards, ever. Keeps the free Pro time bounded. */
export const MAX_REWARDS = 3;
/** No 0/O or 1/I/L, which get misread when a code is read aloud or typed. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const newCode = (): string => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export class InviteService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Your code and progress. The code is made the first time it is asked for. */
  async mine(userId: string): Promise<InviteStatus> {
    const code = await this.codeFor(userId);
    await this.settle(userId);
    const [qualified, pending, rewards, until] = await Promise.all([
      this.db.invite.count({ where: { inviterId: userId, qualifiedAt: { not: null } } }),
      this.db.invite.count({ where: { inviterId: userId, qualifiedAt: null } }),
      this.db.promoGrant.count({ where: { userId, key: { startsWith: 'invite-batch:' } } }),
      this.db.promoGrant.findFirst({ where: { userId, endsAt: { gt: this.now() } }, orderBy: { endsAt: 'desc' }, select: { endsAt: true } }),
    ]);
    return {
      code,
      qualified,
      pending,
      target: INVITES_PER_REWARD,
      untilNextReward: INVITES_PER_REWARD - (qualified % INVITES_PER_REWARD),
      rewardsEarned: rewards,
      proUntil: until?.endsAt.toISOString() ?? null,
    };
  }

  /** A new person enters a friend's code. It counts for the friend once they do something real. */
  async redeem(inviteeId: string, rawCode: string): Promise<RedeemInviteResponse> {
    const code = rawCode.trim().toUpperCase();
    const owner = await this.db.inviteCode.findUnique({ where: { code }, include: { user: { select: authorSelect } } });
    if (!owner) throw errors.notFound('That invite code does not exist');
    if (owner.userId === inviteeId) throw errors.validation({ code: 'You cannot use your own code' });

    const me = await this.db.user.findUniqueOrThrow({ where: { id: inviteeId }, select: { createdAt: true } });
    if (this.now().getTime() - me.createdAt.getTime() > NEW_ACCOUNT_DAYS * DAY_MS) {
      throw errors.validation({ code: 'Invite codes are for people who have just joined' });
    }
    try {
      await this.db.invite.create({ data: { inviterId: owner.userId, inviteeId, code, createdAt: this.now() } });
    } catch (e) {
      if (isUniqueViolation(e, 'inviteeId')) throw errors.validation({ code: 'You have already used an invite code' });
      throw e;
    }
    return { inviter: toAuthor(owner.user) };
  }

  /**
   * Counts invites that have become real and hands out rewards. Safe to run any number of times. Each full set of ten
   * friends earns the inviter, and those ten friends, a month of Pro (up to three sets per inviter).
   */
  async settle(inviterId: string): Promise<void> {
    const now = this.now();
    const open = await this.db.invite.findMany({ where: { inviterId, qualifiedAt: null }, select: { id: true, inviteeId: true } });
    for (const invite of open) {
      if (await this.isReal(invite.inviteeId)) {
        await this.db.invite.updateMany({ where: { id: invite.id, qualifiedAt: null }, data: { qualifiedAt: now } });
      }
    }

    const qualified = await this.db.invite.findMany({
      where: { inviterId, qualifiedAt: { not: null } },
      orderBy: [{ qualifiedAt: 'asc' }, { id: 'asc' }],
      select: { inviteeId: true },
    });
    const sets = Math.min(Math.floor(qualified.length / INVITES_PER_REWARD), MAX_REWARDS);
    for (let n = 1; n <= sets; n++) {
      const friends = qualified.slice((n - 1) * INVITES_PER_REWARD, n * INVITES_PER_REWARD).map((q) => q.inviteeId);
      await this.grant(inviterId, `invite-batch:${n}`);
      for (const friend of friends) await this.grant(friend, `invite-friend:${inviterId}:${n}`);
    }
  }

  /** Settles everyone with friends still waiting to count. For the background job runner. Returns how many were checked. */
  async settleAll(limit = 200): Promise<number> {
    const waiting = await this.db.invite.findMany({ where: { qualifiedAt: null }, distinct: ['inviterId'], select: { inviterId: true }, take: limit });
    for (const w of waiting) await this.settle(w.inviterId);
    return waiting.length;
  }

  /* ---- helpers ---- */

  private async codeFor(userId: string): Promise<string> {
    const existing = await this.db.inviteCode.findUnique({ where: { userId } });
    if (existing) return existing.code;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return (await this.db.inviteCode.create({ data: { userId, code: newCode() } })).code;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        // Either this person's code was made at the same moment (use it) or the random code clashed (try another).
        const made = await this.db.inviteCode.findUnique({ where: { userId } });
        if (made) return made.code;
      }
    }
    throw new Error('could not make an invite code');
  }

  /**
   * A friend counts once they have actually used the app: saved a recipe, put one on their want-to-cook list, posted,
   * or published a recipe. This does not stop someone making their own extra accounts to farm the reward (that needs
   * email or phone verification, which does not exist yet); the cap of three rewards a person is what bounds it.
   */
  private async isReal(inviteeId: string): Promise<boolean> {
    const [saves, wants, posts, recipes] = await Promise.all([
      this.db.recipeSave.count({ where: { userId: inviteeId }, take: 1 }),
      this.db.wantToCookItem.count({ where: { userId: inviteeId }, take: 1 }),
      this.db.post.count({ where: { authorId: inviteeId }, take: 1 }),
      this.db.recipe.count({ where: { authorId: inviteeId, status: 'PUBLISHED' }, take: 1 }),
    ]);
    return saves + wants + posts + recipes > 0;
  }

  /** A month of Pro, starting when their current free time (if any) runs out. Granting the same key again does nothing. */
  private async grant(userId: string, key: string): Promise<void> {
    if (await this.db.promoGrant.findUnique({ where: { userId_key: { userId, key } }, select: { id: true } })) return;
    const now = this.now();
    const running = await this.db.promoGrant.findFirst({ where: { userId, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' }, select: { endsAt: true } });
    const startsAt = running ? running.endsAt : now;
    await this.db.promoGrant.createMany({
      data: [{ userId, tier: 'pro', key, startsAt, endsAt: new Date(startsAt.getTime() + PROMO_DAYS * DAY_MS) }],
      skipDuplicates: true,
    });
  }
}
