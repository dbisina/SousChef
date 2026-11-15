import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';
import type { Db } from '../db';
import { errors } from '../errors';
import { AiProviderError, type AiProvider, type AiRequest, type AiResult, type AiTask } from './types';

export interface Price {
  /** US dollars per million input / output tokens. */
  inPerMillion: number;
  outPerMillion: number;
}

export interface RouterSettings {
  providers: AiProvider[];
  /** For each task, which providers to try and in what order (by name). A provider that is not set up is skipped. */
  routes: Record<AiTask, string[]>;
  prices: Record<string, Price>;
  /** The most all AI calls together may cost in a calendar month (US dollars). When reached, calls are refused. */
  monthlyBudgetUsd: number;
}

export interface RunOptions {
  userId?: string | undefined;
  /** At most this many calls of `key` (default: the task) per person per UTC day. */
  dailyLimit?: { perDay: number; key?: string };
}

const startOfMonth = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const startOfDay = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Pulls a JSON value out of a model's reply, which may be wrapped in a code fence or have a sentence around it. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? (fenced[1] as string).trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.search(/[{[]/);
    const last = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (first >= 0 && last > first) return JSON.parse(candidate.slice(first, last + 1));
    throw new Error('no JSON in the reply');
  }
}

/**
 * Sends each AI request to the right service, falls back to the next when one is down or rate limited, refuses
 * everything once the month's budget is spent, enforces per-person daily limits, and records what every call cost.
 * The budget is the hard stop that keeps the bill inside what was planned.
 */
export class AiRouter {
  constructor(
    private readonly db: Db,
    private readonly settings: RouterSettings,
    private readonly log: Pick<FastifyBaseLogger, 'warn'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** True when at least one provider can serve this task. */
  available(task: AiTask): boolean {
    return this.candidates({ task, prompt: '' }).length > 0;
  }

  async run(request: AiRequest, options: RunOptions = {}): Promise<AiResult> {
    const providers = this.candidates(request);
    if (providers.length === 0) throw errors.aiUnavailable('This feature is not set up on this server');
    await this.checkBudget();
    if (options.userId && options.dailyLimit) await this.checkDaily(options.userId, options.dailyLimit.key ?? request.task, options.dailyLimit.perDay);

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const result = await provider.complete(request);
        await this.record(result, request.task, options.userId);
        return result;
      } catch (err) {
        lastError = err;
        if (err instanceof AiProviderError && !err.retryable) throw errors.aiUnavailable('The AI could not handle that request');
        this.log.warn({ err, provider: provider.name, task: request.task }, 'AI provider failed, trying the next');
      }
    }
    this.log.warn({ err: lastError, task: request.task }, 'every AI provider failed');
    throw errors.aiUnavailable();
  }

  /** Like `run`, but the reply must be JSON that fits `schema`. A reply that does not fit is asked for once more. */
  async runJson<S extends z.ZodType>(request: AiRequest, schema: S, options: RunOptions = {}): Promise<z.output<S>> {
    let prompt = request.prompt;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.run({ ...request, prompt, json: true }, options);
      try {
        const parsed = schema.safeParse(extractJson(result.text));
        if (parsed.success) return parsed.data;
      } catch {
        // fall through to the retry
      }
      prompt = `${request.prompt}\n\nYour last reply was not valid. Reply with only the JSON object described, nothing else.`;
    }
    throw errors.aiUnavailable('The AI gave an answer that could not be used');
  }

  /** What has been spent this month, in US dollars (an estimate from token counts and configured prices). */
  async spentThisMonth(): Promise<number> {
    const row = await this.db.aiUsage.aggregate({ where: { createdAt: { gte: startOfMonth(this.now()) } }, _sum: { costMicros: true } });
    return (row._sum.costMicros ?? 0) / 1_000_000;
  }

  /* ---- helpers ---- */

  private candidates(request: AiRequest): AiProvider[] {
    const byName = new Map(this.settings.providers.map((p) => [p.name, p]));
    return (this.settings.routes[request.task] ?? []).map((n) => byName.get(n)).filter((p): p is AiProvider => p !== undefined && p.supports(request));
  }

  private async checkBudget(): Promise<void> {
    if ((await this.spentThisMonth()) >= this.settings.monthlyBudgetUsd) {
      this.log.warn({ budget: this.settings.monthlyBudgetUsd }, 'monthly AI budget reached; refusing AI calls');
      throw errors.aiUnavailable('AI features are resting until next month');
    }
  }

  private async checkDaily(userId: string, key: string, perDay: number): Promise<void> {
    const used = await this.db.aiUsage.count({ where: { userId, task: key, createdAt: { gte: startOfDay(this.now()) } } });
    if (used >= perDay) throw errors.limitReached(`You have used today's ${perDay} AI helps. They refresh tomorrow`);
  }

  private async record(result: AiResult, task: AiTask, userId: string | undefined): Promise<void> {
    const price = this.settings.prices[result.provider] ?? { inPerMillion: 0, outPerMillion: 0 };
    const usd = (result.inputTokens * price.inPerMillion + result.outputTokens * price.outPerMillion) / 1_000_000;
    await this.db.aiUsage.create({
      data: {
        userId: userId ?? null,
        task,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costMicros: Math.ceil(usd * 1_000_000),
        createdAt: this.now(),
      },
    });
  }
}
