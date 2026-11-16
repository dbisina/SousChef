#!/usr/bin/env node
// Measures how the server holds up: speed (median and 95th percentile) and errors for common requests, and how many
// live-chat connections it keeps open. Run it against a copy of the server (your own machine, or a staging server),
// never against live traffic: it creates test accounts.
//
//   node scripts/loadtest.mjs                                  http://localhost:3000, 20 people, 20 seconds
//   BASE_URL=https://staging.example.com ALLOW_REMOTE=1 USERS=50 SECONDS=60 CONCURRENCY=40 WS_CONNECTIONS=500 node scripts/loadtest.mjs
//
// Settings (environment): BASE_URL, USERS, SECONDS, CONCURRENCY, WS_CONNECTIONS, MAX_P95_MS (fail above this, default 500),
// ALLOW_REMOTE=1 (needed for any address that is not this machine).
//
// While it runs, watch memory on the server:  docker stats --no-stream   (the API should stay well under its 768 MB limit).
// Accounts are created with registration, which is slow on purpose (password hashing), so setup takes a while.
import { randomUUID } from 'node:crypto';

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const USERS = Number(process.env.USERS ?? 20);
const SECONDS = Number(process.env.SECONDS ?? 20);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const WS_CONNECTIONS = Number(process.env.WS_CONNECTIONS ?? 100);
const MAX_P95_MS = Number(process.env.MAX_P95_MS ?? 500);

const host = new URL(BASE).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.ALLOW_REMOTE !== '1') {
  console.error(`Refusing to load-test ${BASE}: it is not this machine. Set ALLOW_REMOTE=1 if it is a server you may hammer.`);
  process.exit(2);
}

const pct = (sorted, p) => (sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
const api = (path, token, init = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });

async function register(i) {
  const res = await api('/v1/auth/register', null, {
    method: 'POST',
    body: JSON.stringify({ email: `load-${randomUUID()}@example.com`, password: 'load test password 123', displayName: `Load ${i}`, acceptedTermsVersion: '2026-11-01' }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  return (await res.json()).tokens.accessToken;
}

async function setup() {
  const tokens = [];
  const queue = Array.from({ length: USERS }, (_, i) => i);
  // Registration hashes passwords, which is deliberately heavy: only a few at a time.
  await Promise.all(Array.from({ length: Math.min(4, USERS) }, async () => {
    while (queue.length) tokens.push(await register(queue.pop()));
  }));
  return tokens;
}

const mix = [
  { name: 'GET /v1/feed/for-you', weight: 4, run: (t) => api('/v1/feed/for-you', t) },
  { name: 'GET /v1/feed/following', weight: 3, run: (t) => api('/v1/feed/following', t) },
  { name: 'GET /v1/feed/discover', weight: 2, run: (t) => api('/v1/feed/discover', t) },
  { name: 'GET /v1/recipes', weight: 4, run: (t) => api('/v1/recipes?limit=20', t) },
  { name: 'GET /v1/me', weight: 2, run: (t) => api('/v1/me', t) },
  { name: 'GET /v1/me/entitlements', weight: 1, run: (t) => api('/v1/me/entitlements', t) },
  { name: 'GET /readyz', weight: 1, run: () => api('/readyz') },
];
const bag = mix.flatMap((m) => Array(m.weight).fill(m));

async function hammer(tokens) {
  const stats = new Map(mix.map((m) => [m.name, { ms: [], errors: 0 }]));
  const stopAt = Date.now() + SECONDS * 1000;
  let sent = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (Date.now() < stopAt) {
      const m = bag[Math.floor(Math.random() * bag.length)];
      const started = performance.now();
      let ok = false;
      try {
        const res = await m.run(tokens[Math.floor(Math.random() * tokens.length)]);
        await res.arrayBuffer();
        ok = res.status < 500 && res.status !== 429;
      } catch {
        ok = false;
      }
      const s = stats.get(m.name);
      s.ms.push(performance.now() - started);
      if (!ok) s.errors++;
      sent++;
    }
  }));
  return { stats, sent };
}

async function holdSockets(tokens) {
  if (WS_CONNECTIONS === 0 || typeof WebSocket === 'undefined') return null;
  const url = `${BASE.replace(/^http/, 'ws')}/v1/ws`;
  let ready = 0;
  let failed = 0;
  const sockets = [];
  await Promise.all(Array.from({ length: WS_CONNECTIONS }, (_, i) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    sockets.push(ws);
    const timer = setTimeout(() => { failed++; resolve(); }, 15_000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: tokens[i % tokens.length] }));
    ws.onmessage = (e) => {
      if (JSON.parse(String(e.data)).type === 'ready') { ready++; clearTimeout(timer); resolve(); }
    };
    ws.onerror = () => { failed++; clearTimeout(timer); resolve(); };
  })));
  return { ready, failed, close: () => sockets.forEach((s) => s.close()) };
}

console.log(`load test: ${BASE}, ${USERS} people, ${CONCURRENCY} at a time, ${SECONDS}s, ${WS_CONNECTIONS} live connections`);
const tokens = await setup();
console.log(`${tokens.length} accounts ready`);
const sockets = await holdSockets(tokens);
if (sockets) console.log(`live connections open: ${sockets.ready} ok, ${sockets.failed} failed`);

const { stats, sent } = await hammer(tokens);
sockets?.close();

let worst = 0;
let totalErrors = 0;
console.log('\nrequest'.padEnd(28) + 'count'.padStart(8) + 'p50 ms'.padStart(10) + 'p95 ms'.padStart(10) + 'errors'.padStart(8));
for (const [name, s] of stats) {
  const sorted = [...s.ms].sort((a, b) => a - b);
  const p95 = pct(sorted, 95);
  worst = Math.max(worst, p95);
  totalErrors += s.errors;
  console.log(name.padEnd(28) + String(sorted.length).padStart(8) + pct(sorted, 50).toFixed(1).padStart(10) + p95.toFixed(1).padStart(10) + String(s.errors).padStart(8));
}
console.log(`\n${sent} requests, ${(sent / SECONDS).toFixed(0)}/s, ${totalErrors} errors, slowest p95 ${worst.toFixed(0)} ms`);

const errorRate = sent === 0 ? 1 : totalErrors / sent;
if (errorRate > 0.01 || worst > MAX_P95_MS || (sockets && sockets.failed > 0)) {
  console.error(`FAILED: error rate ${(errorRate * 100).toFixed(2)}% (limit 1%), slowest p95 ${worst.toFixed(0)} ms (limit ${MAX_P95_MS}), failed sockets ${sockets?.failed ?? 0}`);
  process.exit(1);
}
console.log('passed');
