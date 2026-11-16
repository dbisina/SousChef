import { createHash } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';

export interface Job {
  name: string;
  /** How often it should run, in milliseconds. */
  everyMs: number;
  /** Returns a short description of what it did, for the log. */
  run(): Promise<string | void>;
}

export interface JobResult {
  name: string;
  status: 'ran' | 'skipped' | 'failed';
  detail?: string;
}

/** Turns a job name into the number PostgreSQL's advisory lock wants. The same name always gives the same number. */
export function lockKey(name: string): bigint {
  return createHash('sha256').update(`souschef:job:${name}`).digest().readBigInt64BE(0);
}

/**
 * Runs background work on a timer inside the server: clearing out what has expired, settling invites, finishing games,
 * checking new posts. Safe with more than one server running: each run first takes a PostgreSQL advisory lock for the job
 * and skips if another server holds it, so work is never done twice at once. A job that fails is logged and tried again at
 * its next time; one failing job never stops the others.
 */
export class JobRunner {
  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<unknown> = Promise.resolve();
  private readonly nextRun = new Map<string, number>();

  constructor(
    private readonly db: Db,
    private readonly jobs: Job[],
    private readonly log: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>,
    private readonly now: () => Date = () => new Date(),
  ) {
    // Spread the first runs out so they do not all hit the database in the same second after a start.
    jobs.forEach((job, i) => this.nextRun.set(job.name, now().getTime() + 5_000 + i * 2_000));
  }

  /** Starts checking for due jobs every `tickMs`. */
  start(tickMs = 10_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.ticking = this.ticking.then(() => this.runDue()).catch((err) => this.log.error({ err }, 'job tick failed'));
    }, tickMs);
    this.timer.unref();
  }

  /** Stops the timer and waits for a run in progress to finish. */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.ticking;
  }

  /** Runs every job whose time has come, one after another. */
  async runDue(): Promise<JobResult[]> {
    const results: JobResult[] = [];
    for (const job of this.jobs) {
      if (this.now().getTime() < (this.nextRun.get(job.name) ?? 0)) continue;
      results.push(await this.execute(job));
    }
    return results;
  }

  /** Runs one job now, whatever its schedule says (for staff and tests). */
  async runNow(name: string): Promise<JobResult> {
    const job = this.jobs.find((j) => j.name === name);
    if (!job) throw new Error(`no job called ${name}`);
    return this.execute(job);
  }

  get names(): string[] {
    return this.jobs.map((j) => j.name);
  }

  private async execute(job: Job): Promise<JobResult> {
    this.nextRun.set(job.name, this.now().getTime() + job.everyMs);
    try {
      const outcome = await this.db.$transaction(
        async (tx): Promise<{ ran: false } | { ran: true; detail: string }> => {
          const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${lockKey(job.name)}) AS locked`;
          if (!rows[0]?.locked) return { ran: false };
          return { ran: true, detail: (await job.run()) ?? '' };
        },
        { timeout: 120_000, maxWait: 5_000 },
      );
      if (!outcome.ran) return { name: job.name, status: 'skipped' };
      if (outcome.detail) this.log.info({ job: job.name }, outcome.detail);
      return { name: job.name, status: 'ran', ...(outcome.detail ? { detail: outcome.detail } : {}) };
    } catch (err) {
      this.log.warn({ err, job: job.name }, 'job failed, will try again at its next time');
      return { name: job.name, status: 'failed', detail: err instanceof Error ? err.message : String(err) };
    }
  }
}
