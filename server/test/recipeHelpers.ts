import type { AuthResponse, CreateRecipeRequest, Recipe } from '@shared';
import { PASSWORD, bearer, register, uniqueEmail, type TestApp } from './helpers';

export function recipePayload(overrides: Partial<CreateRecipeRequest> = {}): CreateRecipeRequest {
  return {
    title: 'Jollof Rice',
    description: 'Smoky party jollof',
    imageUrl: 'https://img.example.com/jollof.jpg',
    category: 'dinner',
    cuisine: 'nigerian',
    difficulty: 'medium',
    prepTime: 20,
    cookTime: 45,
    servings: 4,
    ingredients: [
      { name: 'tomato', amount: 4, unit: 'piece' },
      { name: 'onion', amount: 2, unit: 'piece' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
    ],
    instructions: ['Blend the peppers', 'Fry the base', 'Cook the rice'],
    tags: ['party', 'rice'],
    ...overrides,
  };
}

export async function createRecipe(t: TestApp, who: AuthResponse, overrides: Partial<CreateRecipeRequest> = {}): Promise<Recipe> {
  const res = await t.app.inject({ method: 'POST', url: '/v1/recipes', headers: bearer(who), payload: recipePayload(overrides) });
  if (res.statusCode !== 201) throw new Error(`create recipe failed: ${res.statusCode} ${res.body}`);
  return res.json<Recipe>();
}

/** A signed-in admin: promoted in the database, then signed in again so the token carries the role. */
export async function makeAdmin(t: TestApp): Promise<AuthResponse> {
  const email = uniqueEmail();
  const created = await register(t, { email, displayName: 'Admin Ade' });
  await t.db.user.update({ where: { id: created.user.id }, data: { role: 'ADMIN' } });
  const res = await t.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } });
  return res.json<AuthResponse>();
}

export const call = (t: TestApp, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, who?: AuthResponse, payload?: unknown) =>
  t.app.inject({ method, url, ...(who ? { headers: bearer(who) } : {}), ...(payload !== undefined ? { payload: payload as object } : {}) });
