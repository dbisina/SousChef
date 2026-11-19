import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ImportResult } from '@shared';
import { braveSearch, firstWorking, tavilySearch, type WebHit, type WebSearch } from '../src/imports/webSearch';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

const recipeJson = JSON.stringify({
  found: true,
  title: 'Vegan Lasagne',
  servings: 6,
  prepTime: 20,
  cookTime: 50,
  difficulty: 'medium',
  cuisine: 'italian',
  category: 'dinner',
  ingredients: [
    { name: 'lasagne sheets', amount: 250, unit: 'g' },
    { name: 'tomato passata', amount: 700, unit: 'ml' },
    { name: 'lentils', amount: 200, unit: 'g' },
  ],
  instructions: ['Simmer the lentils in the passata', 'Layer with the sheets', 'Bake for 40 minutes'],
  tags: ['vegan'],
  confidence: 0.8,
});

const page = `<html><head><title>Lasagne</title><script type="application/ld+json">${JSON.stringify({
  '@type': 'Recipe',
  name: 'Best Vegan Lasagne',
  recipeYield: '6',
  recipeIngredient: ['250g lasagne sheets', '700ml passata', '200g lentils'],
  recipeInstructions: ['Simmer', 'Layer', 'Bake'],
})}</script></head><body>x</body></html>`;

let hits: WebHit[] = [];
let down = false;
const search: WebSearch = async () => {
  if (down) throw new Error('out of credit');
  return hits;
};

let t: TestApp;
beforeAll(async () => {
  t = await makeApp({ IMPORT_RATE_LIMIT_MAX: '100000' }, { webSearch: (q) => search(q) });
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  hits = [];
  down = false;
});

const ask = (who: Awaited<ReturnType<typeof register>> | undefined, query: string) => call(t, 'POST', '/v1/imports/search', who, { query });

describe('importing by description', () => {
  it('needs a sign-in and something to look for', async () => {
    expect((await ask(undefined, 'vegan lasagne')).statusCode).toBe(401);
    const ama = await register(t);
    expect((await ask(ama, 'ab')).statusCode).toBe(400);
  });

  it('imports the first real recipe page the search finds, skipping videos', async () => {
    const ama = await register(t);
    hits = [
      { url: 'https://www.youtube.com/watch?v=abcdefghijk', title: 'video' },
      { url: 'https://recipes.example.com/lasagne', title: 'Vegan lasagne' },
    ];
    t.web.page('https://recipes.example.com/lasagne', page);
    const body = (await ask(ama, 'a good vegan lasagne')).json<ImportResult>();
    expect(body).toMatchObject({ status: 'done', platform: 'website', message: 'Found on recipes.example.com', recipe: { title: 'Best Vegan Lasagne' } });
    expect(t.ai.all.flatMap((p) => p.calls)).toEqual([]); // structured data on the page: no AI needed
  });

  it('moves past a page that cannot be read', async () => {
    const ama = await register(t);
    hits = [
      { url: 'https://broken.example.com/x', title: 'broken' },
      { url: 'https://recipes.example.com/lasagne', title: 'ok' },
    ];
    t.web.page('https://recipes.example.com/lasagne', page);
    expect((await ask(ama, 'vegan lasagne')).json<ImportResult>().recipe?.title).toBe('Best Vegan Lasagne');
  });

  it('has the model write a standard recipe, and says so, when the search finds nothing or is down', async () => {
    const ama = await register(t);
    t.ai.deepseek.handler = () => recipeJson;
    t.ai.nebius.handler = () => recipeJson;
    const empty = (await ask(ama, 'vegan lasagne')).json<ImportResult>();
    expect(empty).toMatchObject({ status: 'done', message: expect.stringContaining('Written by enplace AI'), recipe: { title: 'Vegan Lasagne' } });
    down = true;
    const failed = (await ask(ama, 'vegan lasagne please')).json<ImportResult>();
    expect(failed.message).toContain('Written by enplace AI');
  });
});

describe('the search services', () => {
  const reply = (body: unknown, ok = true): typeof fetch => (async () => ({ ok, status: ok ? 200 : 402, json: async () => body })) as unknown as typeof fetch;

  it('reads Tavily and Brave results, keeping only https pages', async () => {
    const tav = await tavilySearch('k', reply({ results: [{ url: 'https://a.example.com/r', title: 'A' }, { url: 'http://insecure.example.com', title: 'B' }] }))('x');
    expect(tav).toEqual([{ url: 'https://a.example.com/r', title: 'A' }]);
    const brave = await braveSearch('k', reply({ web: { results: [{ url: 'https://b.example.com/r', title: 'B' }] } }))('x');
    expect(brave).toEqual([{ url: 'https://b.example.com/r', title: 'B' }]);
    await expect(tavilySearch('k', reply({}, false))('x')).rejects.toThrow('tavily 402');
  });

  it('falls back to the next service when the first fails or finds nothing', async () => {
    const calls: string[] = [];
    const first: WebSearch = async () => {
      calls.push('tavily');
      throw new Error('402');
    };
    const empty: WebSearch = async () => {
      calls.push('brave');
      return [];
    };
    const last: WebSearch = async () => {
      calls.push('last');
      return [{ url: 'https://c.example.com', title: 'C' }];
    };
    expect(await firstWorking([first, empty, last])('x')).toEqual([{ url: 'https://c.example.com', title: 'C' }]);
    expect(calls).toEqual(['tavily', 'brave', 'last']);
  });
});
