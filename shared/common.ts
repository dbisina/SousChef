/** Machine-readable error codes. The app switches on these, never on the message text. */
export type ErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'invalid_credentials'
  | 'email_taken'
  | 'handle_taken'
  | 'invalid_token'
  | 'token_reuse'
  | 'terms_required'
  | 'provider_not_configured'
  | 'provider_rejected'
  | 'limit_reached'
  | 'upgrade_required'
  | 'internal';

/** Every error response from the API has this body. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Safe to show to a person, English only for now. */
    message: string;
    /** Field problems for `validation_error`: path to message. */
    details?: Record<string, string>;
  };
}

export interface HealthResponse {
  status: 'ok';
  /** Seconds since the process started. */
  uptime: number;
}
