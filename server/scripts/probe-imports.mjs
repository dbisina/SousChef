// Tries real video and recipe links against a running API and says what each one gave back.
//
//   API=https://your-host node scripts/probe-imports.mjs <url> [<url> ...] [--reach]
//
// Each link uses a fresh throwaway account, so the daily allowance of one account never gets in the way. Use it only against a
// test host. With --reach and the Agent Reach tool installed (`agent-reach`), it also prints how much text Agent Reach can read
// from the same link, as a second opinion on whether the link has a recipe in it at all.
import { spawnSync } from 'node:child_process';

const API = process.env.API;
if (!API) {
  console.error('Set API to the address of a test host, e.g. API=https://test-host node scripts/probe-imports.mjs <url>');
  process.exit(1);
}
const args = process.argv.slice(2);
const reach = args.includes('--reach');
const urls = args.filter((a) => !a.startsWith('--'));

const call = async (method, path, body, token) => {
  const res = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const account = async () => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const r = await call('POST', '/v1/auth/register', { email: `probe-${id}@example.com`, password: 'Correct-horse-9', displayName: 'Probe', acceptedTermsVersion: '2026-11-01' });
  return r.body.tokens?.accessToken;
};
const reachText = (url) => {
  const run = spawnSync('agent-reach', ['read', url], { encoding: 'utf8', timeout: 90_000 });
  try {
    const items = JSON.parse(run.stdout).items ?? [];
    return `${items.reduce((n, i) => n + (i.text?.length ?? 0), 0)} chars`;
  } catch {
    return 'unavailable';
  }
};

let done = 0;
for (const url of urls) {
  const started = Date.now();
  const r = await call('POST', '/v1/imports', { url }, await account());
  const recipe = r.body.recipe;
  if (r.body.status === 'done') done += 1;
  const what = recipe ? `${recipe.title} | ${recipe.ingredients?.length} ingredients | ${recipe.instructions?.length} steps` : (r.body.message ?? r.body.error?.message ?? '');
  console.log(`${r.body.status ?? r.body.error?.code} ${r.body.platform ?? ''} ${((Date.now() - started) / 1000).toFixed(1)}s | ${what} | ${url.slice(0, 80)}${reach ? ` | agent-reach: ${reachText(url)}` : ''}`);
}
console.log(`${done} of ${urls.length} read straight from the link`);
