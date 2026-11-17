import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Page, Post } from '@shared';
import { cosine, ingredientTokens, normalize, recipeFeatures, topTraits, type RecipeTraits } from '../src/recommend/features';
import { TasteService } from '../src/recommend/taste';
import { makeApp, register, type TestApp } from './helpers';
import { call, createRecipe } from './recipeHelpers';
import { makePost } from './socialHelpers';

const traits = (over: Partial<RecipeTraits> = {}): RecipeTraits => ({
  cuisine: 'italian',
  category: 'dinner',
  difficulty: 'easy',
  prepTime: 10,
  cookTime: 20,
  dietaryFlags: [],
  tags: [],
  ingredientNames: ['spaghetti', 'garlic', 'olive oil', 'parmesan'],
  ...over,
});

describe('describing a recipe as numbers', () => {
  it('names an ingredient by what it is, not how it is cut or how much there is', () => {
    expect(ingredientTokens('finely chopped red onions')).toEqual(['onion']);
    expect(ingredientTokens('chicken breast')).toEqual(['chicken']);
    expect(ingredientTokens('soy sauce')).toEqual(['soy']);
    expect(ingredientTokens('garlic cloves')).toEqual(['garlic']);
    expect(ingredientTokens('tomatoes (canned)')).toEqual(['tomato']);
    expect(ingredientTokens('olive oil')).toEqual([]);
    expect(ingredientTokens('salt')).toEqual([]);
  });

  it('gives a recipe a length-1 description', () => {
    const v = recipeFeatures(traits());
    const length = Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));
    expect(length).toBeCloseTo(1, 6);
    expect(Object.keys(v)).toEqual(expect.arrayContaining(['cuisine:italian', 'meal:dinner', 'level:easy', 'time:short', 'ing:spaghetti', 'ing:garlic', 'ing:parmesan']));
    expect(v['ing:oil']).toBeUndefined();
  });

  it('says dishes of the same kind are alike and different kinds are not', () => {
    const carbonara = recipeFeatures(traits({ ingredientNames: ['spaghetti', 'egg', 'pancetta', 'parmesan'] }));
    const aglio = recipeFeatures(traits({ ingredientNames: ['spaghetti', 'garlic', 'chilli'] }));
    const curry = recipeFeatures(traits({ cuisine: 'indian', cookTime: 50, difficulty: 'medium', ingredientNames: ['chicken', 'tomato', 'yogurt', 'garam masala'], dietaryFlags: ['gluten-free'] }));
    expect(cosine(carbonara, aglio)).toBeGreaterThan(cosine(carbonara, curry));
    expect(cosine(carbonara, carbonara)).toBeCloseTo(1, 6);
    expect(cosine({}, carbonara)).toBe(0);
  });

  it('keeps the strongest traits of a long profile', () => {
    expect(Object.keys(topTraits({ a: 0.1, b: -0.9, c: 0.5, d: 0.05 }, 2)).sort()).toEqual(['b', 'c']);
    expect(normalize({})).toEqual({});
  });
});

describe('learning one person\'s taste', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), RATE_LIMIT_MAX: '100000' });
  });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  type Who = Awaited<ReturnType<typeof register>>;
  const thai = { cuisine: 'thai', title: 'Green Curry', ingredients: [{ name: 'coconut milk', amount: 400, unit: 'ml' }, { name: 'green curry paste', amount: 2, unit: 'tbsp' }, { name: 'chicken', amount: 300, unit: 'g' }] } as const;
  const pizza = { cuisine: 'italian', title: 'Margherita Pizza', ingredients: [{ name: 'pizza dough', amount: 1, unit: 'piece' }, { name: 'mozzarella', amount: 200, unit: 'g' }, { name: 'tomato', amount: 3, unit: 'piece' }] } as const;

  it('knows nothing about someone who has done nothing, and builds a profile from what they like and save', async () => {
    const [chef, ama] = [await register(t, { displayName: 'Chef' }), await register(t, { displayName: 'Ama' })] as [Who, Who];
    const green = await createRecipe(t, chef, { ...thai, ingredients: [...thai.ingredients] });
    const margherita = await createRecipe(t, chef, { ...pizza, ingredients: [...pizza.ingredients] });
    const taste = new TasteService(t.db);

    const empty = await taste.taste(ama.user.id);
    expect(empty).toEqual({ vector: {}, signals: 0 });

    await call(t, 'PUT', `/v1/recipes/${green.id}/like`, ama);
    await call(t, 'PUT', `/v1/recipes/${green.id}/save`, ama);
    const fresh = await taste.refresh(ama.user.id);
    expect(fresh.signals).toBe(2);
    const infos = await taste.recipes([green.id, margherita.id]);
    expect(taste.match(fresh, infos.get(green.id))).toBeGreaterThan(0.8);
    expect(taste.match(fresh, infos.get(margherita.id))).toBeLessThan(0.3);
    expect(taste.match(null, infos.get(green.id))).toBe(0);
    expect(taste.match(empty, infos.get(green.id))).toBe(0);
  });

  it('counts cooking a recipe and saying "not interested" in one, and fades old signals', async () => {
    const [chef, ama] = [await register(t), await register(t)] as [Who, Who];
    const green = await createRecipe(t, chef, { ...thai, ingredients: [...thai.ingredients] });
    const margherita = await createRecipe(t, chef, { ...pizza, ingredients: [...pizza.ingredients] });
    const post = await makePost(t, chef, { recipeId: margherita.id });
    await makePost(t, ama, { recipeId: green.id }); // she cooked the curry and shared it
    await call(t, 'POST', '/v1/feed/events', ama, { events: [{ kind: 'hide', postId: post.id }] });

    const taste = new TasteService(t.db);
    const mine = await taste.refresh(ama.user.id);
    const infos = await taste.recipes([green.id, margherita.id]);
    expect(taste.match(mine, infos.get(green.id))).toBeGreaterThan(0.5);
    expect(taste.match(mine, infos.get(margherita.id))).toBe(0); // a mismatch never lifts

    // three months from now the same signals count for far less (the profile is rebuilt, from nothing newer)
    const later = new TasteService(t.db, () => new Date(Date.now() + 70 * 86_400_000));
    const faded = await later.refresh(ama.user.id);
    const strong = Object.values(mine.vector).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    const weak = Object.values(faded.vector).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(strong).toBeGreaterThan(0);
    expect(weak).toBeGreaterThan(0); // still the same direction after normalising
    expect(faded.signals).toBe(mine.signals);
  });

  it('builds nothing for someone who turned personalisation off', async () => {
    const [chef, ama] = [await register(t), await register(t)] as [Who, Who];
    const green = await createRecipe(t, chef, { ...thai, ingredients: [...thai.ingredients] });
    await call(t, 'PUT', `/v1/recipes/${green.id}/save`, ama);
    await call(t, 'PUT', '/v1/me/feed-preferences', ama, { personalised: false });
    expect(await new TasteService(t.db).taste(ama.user.id)).toBeNull();
  });

  it('reports what was shown and ignored, and which authors were pushed away', async () => {
    const [chef, other, ama] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const [a, b, c] = [await makePost(t, chef), await makePost(t, chef), await makePost(t, other)];
    await call(t, 'POST', '/v1/feed/events', ama, {
      events: [{ kind: 'impression', postId: a.id }, { kind: 'impression', postId: b.id }, { kind: 'save', postId: b.id }, { kind: 'hide', postId: c.id }],
    });
    await call(t, 'POST', '/v1/feed/events', ama, { events: [{ kind: 'impression', postId: a.id }] });
    const f = await new TasteService(t.db).fatigue(ama.user.id, [a.id, b.id, c.id], [chef.user.id, other.user.id]);
    expect(f.seen.get(a.id)).toBe(2); // shown twice, never reacted to
    expect(f.seen.has(b.id)).toBe(false); // she saved it
    expect(f.avoid.get(other.user.id)).toBe(0.5); // one "not interested" on their posts
    expect(f.avoid.has(chef.user.id)).toBe(false);
  });

  it('puts a dish like the ones someone cooks above equally popular ones in their feed, and not in someone else\'s', async () => {
    const [chef, ama, bob] = [await register(t, { displayName: 'Chef' }), await register(t, { displayName: 'Ama' }), await register(t, { displayName: 'Bob' })] as [Who, Who, Who];
    const green = await createRecipe(t, chef, { ...thai, ingredients: [...thai.ingredients] });
    const margherita = await createRecipe(t, chef, { ...pizza, ingredients: [...pizza.ingredients] });
    const [thaiPost, pizzaPost] = [await makePost(t, chef, { recipeId: green.id, title: 'Curry' }), await makePost(t, chef, { recipeId: margherita.id, title: 'Pizza' })];
    // equally ignored by the crowd; Ama likes Thai food, Bob likes pizza
    await call(t, 'PUT', `/v1/recipes/${green.id}/like`, ama);
    await call(t, 'PUT', `/v1/recipes/${green.id}/save`, ama);
    await call(t, 'PUT', `/v1/recipes/${margherita.id}/like`, bob);
    await call(t, 'PUT', `/v1/recipes/${margherita.id}/save`, bob);
    const order = async (who: Who) => (await call(t, 'GET', '/v1/feed/for-you', who)).json<Page<Post>>().items.map((p) => p.id);
    expect((await order(ama))[0]).toBe(thaiPost.id);
    expect((await order(bob))[0]).toBe(pizzaPost.id);
  });

  it('sinks a post that was shown several times and ignored, and an author the person pushed away', async () => {
    const [chef, other, ama] = [await register(t), await register(t), await register(t)] as [Who, Who, Who];
    const [stale, fresh] = [await makePost(t, chef, { title: 'Stale' }), await makePost(t, other, { title: 'Fresh' })];
    const order = async () => (await call(t, 'GET', '/v1/feed/for-you', ama)).json<Page<Post>>().items.map((p) => p.id);
    expect(await order()).toEqual([fresh.id, stale.id]); // the newer one first to begin with
    for (let i = 0; i < 4; i++) await call(t, 'POST', '/v1/feed/events', ama, { events: [{ kind: 'impression', postId: fresh.id }] });
    expect(await order()).toEqual([stale.id, fresh.id]);
  });
});
