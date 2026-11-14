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
  invalidCredentials: () => new AppError(401, 'invalid_credentials', 'Email or password is not right'),
  emailTaken: () => new AppError(409, 'email_taken', 'An account with this email already exists'),
  handleTaken: () => new AppError(409, 'handle_taken', 'That username is taken'),
  invalidToken: () => new AppError(401, 'invalid_token', 'This sign-in has expired. Please sign in again'),
  tokenReuse: () => new AppError(401, 'token_reuse', 'This sign-in was used twice. Please sign in again'),
  termsRequired: () => new AppError(409, 'terms_required', 'Please accept the terms to create your account'),
  providerNotConfigured: () => new AppError(501, 'provider_not_configured', 'This way of signing in is not available'),
  providerRejected: () => new AppError(401, 'provider_rejected', 'That sign-in could not be verified'),
};
