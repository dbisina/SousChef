import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminStats, AiKeysReport, AiUsageReport, ApiErrorBody } from '@shared';
import { AdminService } from '../src/admin/service';
import { GeminiPoolProvider } from '../src/ai/geminiPool';
import { AiRouter } from '../src/ai/router';
import { makeApp, register, type TestApp } from './helpers';
import { call, makeAdmin } from './recipeHelpers';

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ AI_MONTHLY_BUDGET_USD: '12' });
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const code = (res: { json: () => unknown }) => (res.json() as ApiErrorBody).error.code;
const usage = (provider: string, task: string, costMicros: number, daysAgo = 0) =>
  t.db.aiUsage.create({ data: { task, provider, model: 'm', inputTokens: 1000, outputTokens: 100, costMicros, createdAt: new Date(Date.now() - daysAgo * 86_400_000) } });

describe('who may look', () => {
  it('keeps the staff numbers away from signed-out people and ordinary accounts, and never lets a cache keep them', async () => {
    const person = await register(t);
    const admin = await makeAdmin(t);
    for (const url of ['/v1/admin/stats', '/v1/admin/ai/usage', '/v1/admin/ai/keys']) {
      expect((await call(t, 'GET', url)).statusCode).toBe(401);
      const denied = await call(t, 'GET', url, person);
      expect(denied.statusCode).toBe(403);
      expect(code(denied)).toBe('forbidden');
      const ok = await call(t, 'GET', url, admin);
      expect(ok.statusCode).toBe(200);
      expect(ok.headers['cache-control']).toBe('no-store');
    }
  });
});

describe('overview numbers', () => {
  it('counts people, recent posts, open reports, suspended people and waiting chef requests', async () => {
    const admin = await makeAdmin(t);
    const ama = await register(t);
    const ben = await register(t);
    await t.db.user.update({ where: { id: ben.user.id }, data: { suspendedAt: new Date(), suspendedReason: 'test' } });
    await t.db.post.create({ data: { authorId: ama.user.id, kind: 'recipe', title: 'Stew', photoUrl: 'https://x/y.jpg' } });
    await t.db.report.create({ data: { reporterId: ben.user.id, targetType: 'post', targetId: ama.user.id, reason: 'spam' } });
    await t.db.chefVerification.create({ data: { userId: ama.user.id, note: 'I cook for a living', status: 'pending' } });
    const stats = (await call(t, 'GET', '/v1/admin/stats', admin)).json<AdminStats>();
    expect(stats).toEqual({ people: 3, newPeopleLast7Days: 3, suspendedPeople: 1, postsLast7Days: 1, openReports: 1, pendingChefVerifications: 1 });
  });
});

describe('AI usage', () => {
  it('adds up calls and cost by provider, task and day, and shows the budget', async () => {
    const admin = await makeAdmin(t);
    await usage('gemini', 'scale_recipe', 500_000);
    await usage('gemini-free', 'scale_recipe', 0);
    await usage('gemini-free', 'meal_plan', 0);
    await usage('deepseek', 'meal_plan', 20_000, 2);
    await usage('gemini', 'judge_plate', 100_000, 40); // older than the window
    const report = (await call(t, 'GET', '/v1/admin/ai/usage?days=7', admin)).json<AiUsageReport>();
    expect(report.days).toBe(7);
    expect(report.budgetUsd).toBe(12);
    expect(report.byProvider.map((r) => [r.name, r.calls, r.costUsd])).toEqual([['gemini', 1, 0.5], ['deepseek', 1, 0.02], ['gemini-free', 2, 0]]);
    expect(report.byTask.map((r) => [r.name, r.calls])).toEqual([['scale_recipe', 2], ['meal_plan', 2]]);
    expect(report.byProvider[0]).toMatchObject({ inputTokens: 1000, outputTokens: 100 });
    expect(report.byDay).toHaveLength(2);
    expect(report.byDay.at(-1)).toMatchObject({ calls: 3, costUsd: 0.5 });
    expect(report.spentThisMonthUsd).toBeGreaterThanOrEqual(0.5);
  });

  it('checks the window', async () => {
    const admin = await makeAdmin(t);
    expect((await call(t, 'GET', '/v1/admin/ai/usage?days=0', admin)).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/admin/ai/usage?days=500', admin)).statusCode).toBe(400);
    expect((await call(t, 'GET', '/v1/admin/ai/usage', admin)).json<AiUsageReport>().days).toBe(30);
  });
});

describe('AI keys', () => {
  it('lists the providers that are set up, without any key', async () => {
    const admin = await makeAdmin(t);
    const report = (await call(t, 'GET', '/v1/admin/ai/keys', admin)).json<AiKeysReport>();
    expect(report.providers.map((p) => p.name).sort()).toEqual(['deepseek', 'gemini', 'nebius']);
    expect(report.privateProviders).toEqual(['gemini']);
  });

  it('shows which free keys are resting by their last four characters only', async () => {
    let now = 1_000_000;
    const failing = (async () => ({ ok: false, status: 429, text: async () => '{}', json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
    const pool = new GeminiPoolProvider({ paidKey: 'secret-paid-1234', freeKeys: ['secret-free-aaaa', 'secret-free-bbbb'], model: 'm', spillToPaid: false, paidOnlyTasks: [] }, failing, undefined, () => now);
    await pool.complete({ task: 'substitute', prompt: 'x' }).catch(() => undefined); // both free keys get rate limited
    const report = new AdminService(t.db, new AiRouter(t.db, { providers: [pool], routes: {} as never, prices: {}, monthlyBudgetUsd: 5 }, { warn: () => undefined }, () => new Date(now))).aiKeys();
    expect(report.providers[0]).toMatchObject({ name: 'gemini', details: { funded: true, freeKeys: [{ key: '...aaaa', resting: true }, { key: '...bbbb', resting: true }] } });
    expect(JSON.stringify(report)).not.toContain('secret-');
    now += 61_000;
    expect(pool.describe().freeKeys.every((k) => !k.resting)).toBe(true);
  });
});
