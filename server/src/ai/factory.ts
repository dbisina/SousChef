import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db';
import { GeminiPoolProvider } from './geminiPool';
import { OpenAiCompatibleProvider } from './providers';
import { AiRouter, type RouterSettings } from './router';
import type { AiProvider, AiTask } from './types';

/**
 * Which services to try for each job, in order. Cheap text models go first for plain text work; Gemini is the only
 * one asked to look at pictures or watch a video; the moderation check prefers the dedicated safety model.
 */
export const DEFAULT_ROUTES: Record<AiTask, string[]> = {
  extract_recipe: ['deepseek', 'gemini', 'nebius'],
  extract_recipe_from_frames: ['gemini'],
  substitute: ['deepseek', 'gemini', 'nebius'],
  moderate: ['nebius', 'deepseek', 'gemini'],
  judge_plate: ['gemini'],
  meal_plan: ['deepseek', 'gemini', 'nebius'],
  // Scaling needs real cooking knowledge (salt, spice, pans, time), so the stronger model goes first.
  scale_recipe: ['gemini', 'deepseek', 'nebius'],
};

/** The services whose keys are set. A service without a key is simply not there. */
export function providersFromConfig(config: Config, request: typeof fetch = fetch, log?: Pick<FastifyBaseLogger, 'warn'>): AiProvider[] {
  const providers: AiProvider[] = [];
  if (config.AI_GEMINI_API_KEY || config.AI_GEMINI_FREE_KEYS.length > 0) {
    // One "gemini" provider backed by the funded key and any free keys (see geminiPool.ts).
    providers.push(
      new GeminiPoolProvider(
        {
          paidKey: config.AI_GEMINI_API_KEY,
          freeKeys: config.AI_GEMINI_FREE_KEYS,
          model: config.AI_GEMINI_MODEL,
          spillToPaid: config.AI_GEMINI_SPILL_TO_PAID,
          paidOnlyTasks: config.AI_GEMINI_PAID_ONLY_TASKS,
        },
        request,
        log,
      ),
    );
  }
  if (config.AI_DEEPSEEK_API_KEY) {
    providers.push(new OpenAiCompatibleProvider('deepseek', { apiKey: config.AI_DEEPSEEK_API_KEY, baseUrl: config.AI_DEEPSEEK_BASE_URL, model: config.AI_DEEPSEEK_MODEL, images: false }, request));
  }
  // Nebius needs a model name chosen on purpose; without one it stays off.
  if (config.AI_NEBIUS_API_KEY && config.AI_NEBIUS_MODEL) {
    providers.push(new OpenAiCompatibleProvider('nebius', { apiKey: config.AI_NEBIUS_API_KEY, baseUrl: config.AI_NEBIUS_BASE_URL, model: config.AI_NEBIUS_MODEL, images: false }, request));
  }
  return providers;
}

export function routerSettings(config: Config, providers: AiProvider[]): RouterSettings {
  return {
    providers,
    routes: DEFAULT_ROUTES,
    prices: {
      gemini: { inPerMillion: config.AI_PRICE_GEMINI_IN, outPerMillion: config.AI_PRICE_GEMINI_OUT },
      // Keys without billing cost nothing, so they never count toward the monthly budget.
      'gemini-free': { inPerMillion: 0, outPerMillion: 0 },
      deepseek: { inPerMillion: config.AI_PRICE_DEEPSEEK_IN, outPerMillion: config.AI_PRICE_DEEPSEEK_OUT },
      nebius: { inPerMillion: config.AI_PRICE_NEBIUS_IN, outPerMillion: config.AI_PRICE_NEBIUS_OUT },
    },
    monthlyBudgetUsd: config.AI_MONTHLY_BUDGET_USD,
    privateProviders: config.AI_PRIVATE_PROVIDERS,
  };
}

export function buildAiRouter(config: Config, db: Db, log: Pick<FastifyBaseLogger, 'warn'>, now?: () => Date, request?: typeof fetch): AiRouter {
  return new AiRouter(db, routerSettings(config, providersFromConfig(config, request, log)), log, now);
}
