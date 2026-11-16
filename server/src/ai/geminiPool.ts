import type { FastifyBaseLogger } from 'fastify';
import { GeminiProvider } from './providers';
import { AiProviderError, type AiProvider, type AiRequest, type AiResult } from './types';

export interface GeminiPoolSettings {
  /** The funded key ('' when there is none). Used for private and paid-only requests, and as the overflow when free keys rest. */
  paidKey: string;
  /** Keys without billing. Used in turn for ordinary requests so they cost nothing. */
  freeKeys: string[];
  model: string;
  /** When every free key is resting, may the funded key take an ordinary request? (The monthly budget still caps spend.) */
  spillToPaid: boolean;
  /** Extra tasks that always use the funded key. (Private requests and anything with a video link already do.) */
  paidOnlyTasks: string[];
  baseUrl?: string;
}

const MINUTE = 60_000;
const MAX_REST = 6 * 60 * MINUTE;
const DISABLE_FOR = 24 * 60 * MINUTE;

interface Slot {
  last4: string;
  provider: GeminiProvider;
  /** Do not use before this time (ms). */
  restUntil: number;
  /** In a row: how many times it has failed without a success in between. */
  strikes: number;
}

/** A key that Google refuses (wrong, deleted or suspended), as opposed to a busy moment. */
const isKeyProblem = (err: unknown): boolean =>
  err instanceof AiProviderError && (err.status === 401 || err.status === 403 || (err.status === 400 && /api key/i.test(err.message)));

const last4 = (key: string): string => key.slice(-4);

/**
 * One "gemini" provider backed by several keys. Ordinary requests rotate across the free keys (which cost nothing);
 * a key that is rate limited rests for a while and the next one is used. Anything private, and any task that is
 * listed as paid-only, uses the funded key and never a free one (free-tier content may be used by Google to improve its
 * products). Free-key calls are reported as provider `gemini-free`, which is priced at zero.
 */
export class GeminiPoolProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly paid: GeminiProvider | null;
  private readonly free: Slot[];
  private cursor = 0;

  constructor(
    private readonly settings: GeminiPoolSettings,
    request: typeof fetch = fetch,
    private readonly log: Pick<FastifyBaseLogger, 'warn'> = { warn: () => undefined },
    private readonly clock: () => number = () => Date.now(),
  ) {
    const make = (apiKey: string) => new GeminiProvider({ apiKey, model: settings.model, ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}) }, request);
    this.paid = settings.paidKey ? make(settings.paidKey) : null;
    this.free = settings.freeKeys.map((key) => ({ last4: last4(key), provider: make(key), restUntil: 0, strikes: 0 }));
  }

  get model(): string {
    return this.settings.model;
  }

  /** The funded key must exist for private work; without it the router uses another provider that is allowed to see private data. */
  get allowsPrivate(): boolean {
    return this.paid !== null;
  }

  supports(req: AiRequest): boolean {
    const anyKey = this.paid ?? this.free[0]?.provider;
    if (!anyKey) return false;
    if (this.needsPaid(req) && !this.paid) return false;
    return anyKey.supports(req);
  }

  async complete(req: AiRequest): Promise<AiResult> {
    if (this.needsPaid(req)) return this.callPaid(req);
    if (this.free.length === 0) return this.callPaid(req); // a single funded key behaves exactly as before

    const now = this.clock();
    for (let i = 0; i < this.free.length; i++) {
      const index = (this.cursor + i) % this.free.length;
      const slot = this.free[index] as Slot;
      if (slot.restUntil > now) continue;
      try {
        const result = await slot.provider.complete(req);
        slot.strikes = 0;
        this.cursor = (index + 1) % this.free.length; // the next request starts with the next key
        return { ...result, provider: 'gemini-free' };
      } catch (err) {
        if (err instanceof AiProviderError && !err.retryable && !isKeyProblem(err)) throw err; // the request itself is the problem: do not burn the other keys on it
        this.rest(slot, err);
      }
    }

    if (this.paid && this.settings.spillToPaid) return this.callPaid(req);
    throw new AiProviderError('every free Gemini key is resting right now', true, 429);
  }

  /** Which keys are resting, for tests and logs (only the last four characters are ever shown). */
  status(): { key: string; resting: boolean }[] {
    const now = this.clock();
    return this.free.map((s) => ({ key: `...${s.last4}`, resting: s.restUntil > now }));
  }

  describe(): { funded: boolean; freeKeys: { key: string; resting: boolean }[] } {
    return { funded: this.paid !== null, freeKeys: this.status() };
  }

  /* ---- helpers ---- */

  private needsPaid(req: AiRequest): boolean {
    // Video is heavy for free quotas, so it always goes to the funded key.
    return req.private === true || Boolean(req.videoUrl) || this.settings.paidOnlyTasks.includes(req.task);
  }

  private callPaid(req: AiRequest): Promise<AiResult> {
    if (!this.paid) throw new AiProviderError('this request needs the funded Gemini key, which is not set', true);
    return this.paid.complete(req);
  }

  private rest(slot: Slot, err: unknown): void {
    slot.strikes += 1;
    if (isKeyProblem(err)) {
      slot.restUntil = this.clock() + DISABLE_FOR;
      this.log.warn({ key: `...${slot.last4}`, status: (err as AiProviderError).status }, 'a free Gemini key was refused; leaving it out for a day');
      return;
    }
    const wait = Math.min(MAX_REST, MINUTE * 2 ** (slot.strikes - 1));
    slot.restUntil = this.clock() + wait;
    this.log.warn({ key: `...${slot.last4}`, restMinutes: Math.round(wait / MINUTE) }, 'a free Gemini key is resting');
  }
}
