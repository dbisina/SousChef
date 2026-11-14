export interface Mailer {
  sendPasswordReset(input: { to: string; resetUrl: string }): Promise<void>;
}

interface LogLike {
  info(obj: object, msg: string): void;
}

/**
 * Stand-in until an email provider is chosen: writes to the log instead of sending. The link itself is only logged
 * outside production, so a production log never holds a working reset link.
 */
export class LogMailer implements Mailer {
  constructor(
    private readonly log: LogLike,
    private readonly production: boolean,
  ) {}

  async sendPasswordReset({ to, resetUrl }: { to: string; resetUrl: string }): Promise<void> {
    this.log.info(this.production ? { to } : { to, resetUrl }, 'password reset email (not sent: no mail provider configured)');
  }
}
