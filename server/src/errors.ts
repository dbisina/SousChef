import type { ApiErrorBody, ErrorCode } from '@shared';

/** An error the client is meant to see. Anything else becomes a plain 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export const errors = {
  validation: (details: Record<string, string>) =>
    new AppError(400, 'validation_error', 'Some fields are not valid', details),
  unauthorized: (message = 'Sign in to continue') => new AppError(401, 'unauthorized', message),
  forbidden: (message = 'You are not allowed to do that') => new AppError(403, 'forbidden', message),
  notFound: (message = 'Not found') => new AppError(404, 'not_found', message),
  conflict: (message: string) => new AppError(409, 'conflict', message),
  /** The server is running but this feature has not been set up on it (no key or account configured). */
  notConfigured: (message: string) => new AppError(501, 'provider_not_configured', message),
  /** The person has not agreed to (or has withdrawn) a consent this feature needs. */
  consentRequired: (kind: string) => new AppError(403, 'forbidden', 'Agree to the health data terms first', { consent: kind }),
  invalidCredentials: () => new AppError(401, 'invalid_credentials', 'Email or password is not right'),
  emailTaken: () => new AppError(409, 'email_taken', 'An account with this email already exists'),
  handleTaken: () => new AppError(409, 'handle_taken', 'That username is taken'),
  invalidToken: () => new AppError(401, 'invalid_token', 'This sign-in has expired. Please sign in again'),
  tokenReuse: () => new AppError(401, 'token_reuse', 'This sign-in was used twice. Please sign in again'),
  termsRequired: () => new AppError(409, 'terms_required', 'Please accept the terms to create your account'),
  providerNotConfigured: () => new AppError(501, 'provider_not_configured', 'This way of signing in is not available'),
  upgradeRequired: (requiredTier: string) =>
    new AppError(403, 'upgrade_required', 'This needs a paid plan', { requiredTier }),
  aiUnavailable: (message = 'This feature is resting for now. Try again later') => new AppError(503, 'ai_unavailable', message),
  limitReached: (message: string) => new AppError(409, 'limit_reached', message),
  providerRejected: () => new AppError(401, 'provider_rejected', 'That sign-in could not be verified'),
};
