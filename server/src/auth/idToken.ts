import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { SocialProvider } from '@shared';
import { errors } from '../errors';

export interface VerifiedIdentity {
  provider: 'GOOGLE' | 'APPLE';
  /** The provider's stable id for this person. */
  providerUserId: string;
  email: string | null;
  /** Only a verified email may be used to link to an existing account. */
  emailVerified: boolean;
  name: string | null;
}

export interface IdTokenVerifier {
  isConfigured(provider: SocialProvider): boolean;
  verify(provider: SocialProvider, idToken: string): Promise<VerifiedIdentity>;
}

interface ProviderSetup {
  jwks: JWTVerifyGetKey;
  issuers: string[];
  audiences: string[];
}

const truthy = (v: unknown): boolean => v === true || v === 'true';

/** Checks the signature and claims of a Google or Apple ID token against the provider's published keys. */
export class JoseIdTokenVerifier implements IdTokenVerifier {
  private readonly setups: Record<SocialProvider, ProviderSetup>;

  constructor(googleClientIds: string[], appleClientIds: string[]) {
    this.setups = {
      google: {
        jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
        issuers: ['https://accounts.google.com', 'accounts.google.com'],
        audiences: googleClientIds,
      },
      apple: {
        jwks: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
        issuers: ['https://appleid.apple.com'],
        audiences: appleClientIds,
      },
    };
  }

  isConfigured(provider: SocialProvider): boolean {
    return this.setups[provider].audiences.length > 0;
  }

  async verify(provider: SocialProvider, idToken: string): Promise<VerifiedIdentity> {
    const setup = this.setups[provider];
    if (setup.audiences.length === 0) throw errors.providerNotConfigured();
    try {
      const { payload } = await jwtVerify(idToken, setup.jwks, {
        issuer: setup.issuers,
        audience: setup.audiences,
      });
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('no subject');
      const email = typeof payload['email'] === 'string' ? payload['email'].toLowerCase() : null;
      return {
        provider: provider === 'google' ? 'GOOGLE' : 'APPLE',
        providerUserId: payload.sub,
        email,
        emailVerified: email !== null && truthy(payload['email_verified']),
        name: typeof payload['name'] === 'string' ? payload['name'] : null,
      };
    } catch {
      throw errors.providerRejected();
    }
  }
}
