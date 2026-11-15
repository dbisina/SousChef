import { randomInt } from 'node:crypto';
import type {
  AuthResponse,
  AuthTokens,
  DeleteAccountRequest,
  LoginRequest,
  Me,
  RegisterDeviceRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SocialLoginRequest,
  UpdateProfileRequest,
} from '@shared';
import type { User } from '../../generated/prisma/client';
import type { Config } from '../config';
import { isUniqueViolation, type Db } from '../db';
import { errors } from '../errors';
import { recipesTouchedBy, recomputeRecipeCounters } from '../recipes/counters';
import { recomputeSocialCounters, socialTouchedBy } from '../social/counters';
import type { UploadService } from '../uploads/service';
import type { IdTokenVerifier } from './idToken';
import type { Mailer } from './mailer';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './password';
import { hashToken, newOpaqueToken, signAccessToken, verifyAccessToken, type AccessClaims } from './tokens';

export interface AuthDeps {
  db: Db;
  config: Config;
  mailer: Mailer;
  verifier: IdTokenVerifier;
  /** Removes a deleted account's uploaded files. */
  uploads?: UploadService;
  now?: () => Date;
}

/** A refresh token presented again this soon after it was used is treated as a retry, not as theft. */
const RETRY_GRACE_MS = 10_000;
const MAX_DEVICES_PER_USER = 10;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** "Ama Okafor!" becomes "ama_okafor": lowercase letters, digits and underscores, 3 to 20 characters. */
export function slugifyHandle(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
    .replace(/_+$/g, '');
  return slug.length >= 3 ? slug : `${slug}chef`.slice(0, 20);
}

const DAY_MS = 86_400_000;

export class AuthService {
  private readonly db: Db;
  private readonly config: Config;
  private readonly mailer: Mailer;
  private readonly verifier: IdTokenVerifier;
  private readonly uploads: UploadService | undefined;
  private readonly now: () => Date;

  constructor(deps: AuthDeps) {
    this.uploads = deps.uploads;
    this.db = deps.db;
    this.config = deps.config;
    this.mailer = deps.mailer;
    this.verifier = deps.verifier;
    this.now = deps.now ?? (() => new Date());
  }

  /* ------------------------------------------------------------------ sign up and in */

  async register(input: RegisterRequest): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    if (await this.db.user.findUnique({ where: { email }, select: { id: true } })) throw errors.emailTaken();

    const passwordHash = await hashPassword(input.password);
    const user = await this.createUser({
      email,
      passwordHash,
      displayName: input.displayName.trim(),
      termsVersion: input.acceptedTermsVersion,
    });
    return this.issue(user, input.device?.name);
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({ where: { email: normalizeEmail(input.email) } });
    if (!user?.passwordHash) {
      await verifyAgainstDummy(input.password);
      throw errors.invalidCredentials();
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) throw errors.invalidCredentials();
    return this.issue(user, input.device?.name);
  }

  async socialLogin(input: SocialLoginRequest): Promise<AuthResponse> {
    if (!this.verifier.isConfigured(input.provider)) throw errors.providerNotConfigured();
    const identity = await this.verifier.verify(input.provider, input.idToken);

    const linked = await this.db.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.providerUserId } },
      include: { user: true },
    });
    if (linked) return this.issue(linked.user, input.device?.name);

    // The same person may already have an email account. Only a provider-verified email is trusted enough to link.
    if (identity.email && identity.emailVerified) {
      const existing = await this.db.user.findUnique({ where: { email: identity.email } });
      if (existing) {
        await this.db.authIdentity.create({
          data: {
            userId: existing.id,
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            email: identity.email,
          },
        });
        return this.issue(existing, input.device?.name);
      }
    }

    if (!input.acceptedTermsVersion) throw errors.termsRequired();
    const displayName = (input.displayName ?? identity.name ?? identity.email?.split('@')[0] ?? 'Chef').trim() || 'Chef';
    const user = await this.createUser({
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName,
      termsVersion: input.acceptedTermsVersion,
      identity: { provider: identity.provider, providerUserId: identity.providerUserId, email: identity.email },
    });
    return this.issue(user, input.device?.name);
  }

  /* ------------------------------------------------------------------ sessions */

  /**
   * Trades a refresh token for a new pair. Each refresh token works once. Presenting one that was already used (after a
   * short retry window) means it leaked, so every session in its family is revoked and the person must sign in again.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const now = this.now();
    const session = await this.db.session.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
    if (!session || session.revokedAt) throw errors.invalidToken();

    if (session.rotatedAt) {
      if (now.getTime() - session.rotatedAt.getTime() > RETRY_GRACE_MS) {
        await this.revokeFamily(session.familyId);
        throw errors.tokenReuse();
      }
      throw errors.invalidToken();
    }
    if (session.expiresAt <= now) throw errors.invalidToken();

    // Claim the token. If two requests race, only one updates the row; the other is treated as a retry.
    const claimed = await this.db.session.updateMany({ where: { id: session.id, rotatedAt: null }, data: { rotatedAt: now } });
    if (claimed.count === 0) throw errors.invalidToken();

    return this.issue(session.user, session.deviceName ?? undefined, session.familyId);
  }

  /** Ends the session the refresh token belongs to. Always succeeds, so a stale token cannot be probed. */
  async logout(refreshToken: string): Promise<void> {
    const session = await this.db.session.findUnique({ where: { tokenHash: hashToken(refreshToken) }, select: { familyId: true } });
    if (session) await this.revokeFamily(session.familyId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: this.now() } });
  }

  /** Checks a bearer token and that its session was not ended. Returns null for anything invalid. */
  async authenticate(bearer: string | undefined): Promise<AccessClaims | null> {
    if (!bearer?.startsWith('Bearer ')) return null;
    const now = this.now();
    const claims = await verifyAccessToken(this.config.JWT_SECRET, bearer.slice(7), now);
    if (!claims) return null;
    const session = await this.db.session.findUnique({
      where: { id: claims.sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= now) return null;
    return claims;
  }

  /* ------------------------------------------------------------------ password reset */

  /** Always looks the same from outside, whether or not the email has an account. */
  async forgotPassword(emailInput: string): Promise<void> {
    const email = normalizeEmail(emailInput);
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user?.email) return;

    const now = this.now();
    await this.db.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    const token = newOpaqueToken();
    await this.db.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + this.config.PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    });
    const url = new URL(this.config.APP_RESET_URL);
    url.searchParams.set('token', token);
    await this.mailer.sendPasswordReset({ to: user.email, resetUrl: url.toString() });
  }

  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const now = this.now();
    const reset = await this.db.passwordReset.findUnique({ where: { tokenHash: hashToken(input.token) } });
    if (!reset || reset.usedAt || reset.expiresAt <= now) throw errors.invalidToken();

    const passwordHash = await hashPassword(input.password);
    // Claim the reset first so the same link cannot be used twice, even concurrently.
    const claimed = await this.db.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) throw errors.invalidToken();

    await this.db.$transaction([
      this.db.user.update({
        where: { id: reset.userId },
        // Following the emailed link proves the person controls the address.
        data: { passwordHash, emailVerifiedAt: now },
      }),
      // A reset is usually done because something is wrong: end every session.
      this.db.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
  }

  /* ------------------------------------------------------------------ account */

  async me(userId: string): Promise<Me> {
    const user = await this.db.user.findUnique({ where: { id: userId }, include: { identities: true } });
    if (!user) throw errors.unauthorized();
    return this.toMe(user, user.identities.map((i) => i.provider));
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<Me> {
    try {
      await this.db.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
          ...(input.handle !== undefined ? { handle: input.handle } : {}),
          ...(input.bio !== undefined ? { bio: input.bio.trim() } : {}),
          ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
          ...(input.isChef !== undefined ? { isChef: input.isChef } : {}),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e, 'handle')) throw errors.handleTaken();
      throw e;
    }
    return this.me(userId);
  }

  async deleteAccount(userId: string, input: DeleteAccountRequest): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) throw errors.unauthorized();
    if (user.passwordHash) {
      if (!input.password || !(await verifyPassword(user.passwordHash, input.password))) throw errors.invalidCredentials();
    } else if (input.confirm !== 'DELETE') {
      throw errors.validation({ confirm: 'Type DELETE to confirm' });
    }
    // Remember which recipes this person had touched: their likes, saves, comments and ratings vanish with the account,
    // so those recipes' totals are recounted afterwards.
    const touched = await recipesTouchedBy(this.db, userId);
    const social = await socialTouchedBy(this.db, userId);
    const files = (await this.uploads?.keysFor(userId)) ?? [];
    // Sessions, devices, identities, consents, resets and everything they wrote are removed with the user (onDelete: Cascade).
    await this.db.user.delete({ where: { id: userId } });
    await recomputeRecipeCounters(this.db, touched);
    await recomputeSocialCounters(this.db, social);
    await this.uploads?.deleteKeys(files);
  }

  async registerDevice(userId: string, input: RegisterDeviceRequest): Promise<void> {
    const now = this.now();
    // A push token belongs to one phone: if it was registered by someone else (shared phone), it moves to this user.
    await this.db.device.upsert({
      where: { pushToken: input.pushToken },
      create: { userId, pushToken: input.pushToken, platform: input.platform, appVersion: input.appVersion ?? null, lastSeenAt: now },
      update: { userId, platform: input.platform, appVersion: input.appVersion ?? null, lastSeenAt: now },
    });
    const devices = await this.db.device.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' }, select: { id: true } });
    if (devices.length > MAX_DEVICES_PER_USER) {
      await this.db.device.deleteMany({ where: { id: { in: devices.slice(MAX_DEVICES_PER_USER).map((d) => d.id) } } });
    }
  }

  async removeDevice(userId: string, pushToken: string): Promise<void> {
    await this.db.device.deleteMany({ where: { userId, pushToken } });
  }

  /* ------------------------------------------------------------------ internals */

  private async createUser(input: {
    email: string | null;
    emailVerified?: boolean;
    passwordHash?: string;
    displayName: string;
    termsVersion: string;
    identity?: { provider: 'GOOGLE' | 'APPLE'; providerUserId: string; email: string | null };
  }): Promise<User> {
    const base = slugifyHandle(input.displayName);
    for (let attempt = 0; attempt < 6; attempt++) {
      const handle = attempt === 0 ? base : `${base.slice(0, 15)}_${randomInt(1000, 10000)}`;
      try {
        return await this.db.user.create({
          data: {
            email: input.email,
            emailVerifiedAt: input.emailVerified ? this.now() : null,
            passwordHash: input.passwordHash ?? null,
            displayName: input.displayName,
            handle,
            consents: {
              create: [
                { kind: 'TERMS', version: input.termsVersion },
                { kind: 'PRIVACY', version: input.termsVersion },
              ],
            },
            ...(input.identity ? { identities: { create: input.identity } } : {}),
          },
        });
      } catch (e) {
        if (isUniqueViolation(e, 'handle')) continue;
        if (isUniqueViolation(e, 'email')) throw errors.emailTaken();
        throw e;
      }
    }
    throw new Error('could not find a free handle');
  }

  /** Creates the next session and the access and refresh tokens that go with it. */
  private async issue(user: User, deviceName?: string, familyId?: string): Promise<AuthResponse> {
    const now = this.now();
    const refreshToken = newOpaqueToken();
    const session = await this.db.session.create({
      data: {
        userId: user.id,
        ...(familyId ? { familyId } : { familyId: crypto.randomUUID() }),
        tokenHash: hashToken(refreshToken),
        deviceName: deviceName ?? null,
        expiresAt: new Date(now.getTime() + this.config.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      },
    });
    const access = await signAccessToken(
      this.config.JWT_SECRET,
      this.config.ACCESS_TOKEN_TTL_SECONDS,
      { userId: user.id, sessionId: session.id, role: user.role === 'ADMIN' ? 'admin' : 'user' },
      now,
    );
    const tokens: AuthTokens = {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
    };
    const identities = await this.db.authIdentity.findMany({ where: { userId: user.id }, select: { provider: true } });
    return { user: this.toMe(user, identities.map((i) => i.provider)), tokens };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: this.now() } });
  }

  private toMe(user: User, providers: ('GOOGLE' | 'APPLE')[]): Me {
    return {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      photoUrl: user.photoUrl,
      isChef: user.isChef,
      isVerifiedChef: user.verifiedChefAt !== null,
      kind: user.kind === 'HOUSE' ? 'house' : 'person',
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      role: user.role === 'ADMIN' ? 'admin' : 'user',
      providers: [
        ...(user.passwordHash ? (['password'] as const) : []),
        ...providers.map((p) => (p === 'GOOGLE' ? ('google' as const) : ('apple' as const))),
      ],
      createdAt: user.createdAt.toISOString(),
    };
  }
}
