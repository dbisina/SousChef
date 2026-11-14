import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@shared';

const ISSUER = 'souschef';
const AUDIENCE = 'souschef-app';

export interface AccessClaims {
  userId: string;
  sessionId: string;
  role: UserRole;
}

const keyFor = (secret: string) => new TextEncoder().encode(secret);

/** A short-lived signed token the app sends with every request. */
export async function signAccessToken(
  secret: string,
  ttlSeconds: number,
  claims: AccessClaims,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const exp = issuedAt + ttlSeconds;
  const token = await new SignJWT({ sid: claims.sessionId, role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(keyFor(secret));
  return { token, expiresAt: new Date(exp * 1000) };
}

/** Returns the claims, or null when the token is missing, malformed, forged or expired. */
export async function verifyAccessToken(secret: string, token: string, now: Date): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, keyFor(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    const sid = payload['sid'];
    const role = payload['role'];
    if (typeof payload.sub !== 'string' || typeof sid !== 'string' || (role !== 'user' && role !== 'admin')) return null;
    return { userId: payload.sub, sessionId: sid, role };
  } catch {
    return null;
  }
}

/** 256 random bits, URL safe. Refresh and password reset tokens are this; only their hash is stored. */
export const newOpaqueToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
