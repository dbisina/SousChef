#!/usr/bin/env node
// Design-vs-app fidelity harness.
//   node tools/fidelity/run.mjs <Screen ...|--all> [--theme light|dark] [--rebuild] [--url http://host:port] [--top 15]
// Output: tools/fidelity/out/<Name>.{design.png,rn.png,diff.png,report.json}
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { collect } from './collect.mjs';
import { compare } from './compare.mjs';
import { buildWeb, startServer, restorePublicIndex, ROOT } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const DESIGN_DIR = path.join(ROOT, 'docs', 'redesign', 'screens');
const W = 390, H = 844;

// ---- args
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const valueFlags = new Set(['--theme', '--url', '--top']);
const names = argv.filter((a, i) => !a.startsWith('--') && !valueFlags.has(argv[i - 1]));
const themeOverride = opt('--theme');
const TOP = Number(opt('--top', 15));
const screens = JSON.parse(fs.readFileSync(path.join(HERE, 'screens.json'), 'utf8'));
const designNames = fs.readdirSync(DESIGN_DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const todo = flag('--all') ? Object.keys(screens).filter((n) => screens[n].route) : names;
if (!todo.length) {
  console.error('usage: node tools/fidelity/run.mjs <ScreenName ...|--all> [--theme light|dark] [--rebuild] [--url URL]');
  console.error('screens:', Object.keys(screens).join(' '));
  process.exit(2);
}

// ---- helpers
const FREEZE = `.s{border-radius:0!important;box-shadow:none!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

async function settle(page, ms = 400) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); }))),
    );
  });
  await page.waitForTimeout(ms);
}

// Timestamp stand-in for fixtures: {"$ts":"2026-11-20T10:00:00Z"} -> firebase-like Timestamp
const HYDRATE = `(fx, first) => {
  const ts = (iso) => window.__SC__.Timestamp.fromMillis(Date.parse(iso));
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      if ('$ts' in v) return ts(v.$ts);
      if ('$daysFromNow' in v) return ts(new Date(Date.now() + v.$daysFromNow * 864e5).toISOString());
      const o = {}; for (const k in v) o[k] = walk(v[k]); return o;
    }
    return v;
  };
  const sc = window.__SC__; if (!sc) return 'no __SC__';
  const miss = [];
  for (const [name, patch] of Object.entries(fx.stores || {})) {
    const st = sc.stores[name]; if (!st) { miss.push(name); continue; }
    st.setState(walk(patch));
  }
  if (first) for (const c of fx.calls || []) { const st = sc.stores[c.store]; try { st.getState()[c.fn](...(c.args || [])); } catch (e) { miss.push(c.fn + ':' + e.message); } }
  return miss.length ? 'problems: ' + miss.join(',') : 'ok';
}`;

function png(file) { return PNG.sync.read(fs.readFileSync(file)); }

async function shootDesign(browser, name, theme) {
  const ctx = await browser.newContext({ viewport: { width: 520, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(DESIGN_DIR, `${name}.html`)).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: FREEZE });
  // Frame height from the design itself (most are 844, a few are taller scroll captures).
  const frame = page.locator('.s').first();
  const fh = Math.round((await frame.boundingBox()).height);
  await page.setViewportSize({ width: 520, height: Math.max(1000, fh + 60) });
  if (theme) {
    await page.evaluate((t) => document.querySelector('.s').classList.toggle('dk', t === 'dark'), theme);
  }
  await settle(page, 300);
  const fontsOk = await page.evaluate(() => ['400 14px Inter', '500 20px Outfit'].every((f) => document.fonts.check(f)));
  const file = path.join(OUT, `${name}.design.png`);
  await frame.screenshot({ path: file, animations: 'disabled' });
  const data = await page.evaluate(collect, '.s');
  const isDark = await page.evaluate(() => document.querySelector('.s').classList.contains('dk'));
  await ctx.close();
  return { file, data, height: fh, isDark, fontsOk };
}

async function shootRn(browser, base, name, cfg, theme, height, fixture) {
  const ctx = await browser.newContext({ viewport: { width: W, height }, deviceScaleFactor: 2, colorScheme: theme });
  // First-run flags, so the welcome modal / onboarding redirect never cover the screen under test.
  await ctx.addInitScript(() => {
    try { localStorage.setItem('@souschef_welcome_shown', 'true'); localStorage.setItem('@souschef_onboarding_complete', 'true'); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const sep = cfg.route.includes('?') ? '&' : '?';
  const early = fixture?.navigate; // load a neutral route, set state, then navigate client-side
  await page.goto(early ? `${base}/settings/help?theme=${theme}` : `${base}${cfg.route}${sep}theme=${theme}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SC__ && document.querySelector('#root')?.children.length, null, { timeout: 30000 }).catch(() => {});
  await page.addStyleTag({ content: FREEZE });
  let fx = 'none';
  if (fixture) {
    fx = await page.evaluate(`(${HYDRATE})(${JSON.stringify(fixture)}, true)`);
    if (fixture.navigate) {
      await page.waitForTimeout(300);
      await page.evaluate((href) => window.__SC__.navigate(href), cfg.route);
    }
    if (fixture.reload) {
      // Persisted stores (play, order, ...) survive a reload via localStorage, so guards that redirect
      // on empty state (e.g. mystery round) see the fixture from the first render.
      await page.waitForTimeout(600);
      await page.goto(`${base}${cfg.route}${sep}theme=${theme}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__SC__ && document.querySelector('#root')?.children.length, null, { timeout: 30000 }).catch(() => {});
      await page.addStyleTag({ content: FREEZE });
    }
    // Screens refetch on mount (fails offline and may reset isLoading/error), so apply twice.
    await page.waitForTimeout(fixture.wait ?? 800);
    if (!fixture.reload && !fixture.navigate) fx = await page.evaluate(`(${HYDRATE})(${JSON.stringify(fixture)}, false)`);
    await page.waitForTimeout(500);
  }
  await settle(page, 900);
  const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
  let problem = null;
  if (/unmatched route|this screen doesn.?t exist|page could not be found/i.test(bodyText)) problem = 'route not found';
  else if (/uncaught error|something went wrong/i.test(bodyText) && bodyText.length < 400) problem = 'error screen';
  else if (!bodyText.trim()) problem = 'blank page';
  else if (/^s*loading/i.test(bodyText) && bodyText.length < 60) problem = 'stuck on loading (needs backend data)';
  const root = page.locator('#root');
  const file = path.join(OUT, `${name}.rn.png`);
  await root.screenshot({ path: file, animations: 'disabled', clip: undefined });
  const data = await page.evaluate(collect, { frame: '#root', scope: 'body' });
  const finalUrl = page.url().replace(base, '');
  await ctx.close();
  return { file, data, problem, errors: [...new Set(errors)].slice(0, 5), fx, finalUrl, bodyText: bodyText.slice(0, 200) };
}

function diffPngs(a, b, outFile) {
  const A = png(a), B = png(b);
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = (P) => {
    if (P.width === w && P.height === h) return P.data;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) P.data.copy(out, y * w * 4, y * P.width * 4, y * P.width * 4 + w * 4);
    return out;
  };
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(A), crop(B), diff.data, w, h, { threshold: 0.1, includeAA: false });
  fs.writeFileSync(outFile, PNG.sync.write(diff));
  return { mismatchPct: Math.round((n / (w * h)) * 10000) / 100, sizeA: [A.width, A.height], sizeB: [B.width, B.height] };
}

// design | app | diff at 1x as one small JPEG (agents' file readers cap image size; also quick to eyeball)
async function sideBySide(browser, name, h) {
  const k = Math.min(1, 1000 / h); // tall scroll captures are shrunk so the JPEG stays small
  const iw = Math.round(390 * k);
  const ctx = await browser.newContext({ viewport: { width: iw * 3 + 60, height: Math.round(h * k) + 20 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const u = (k) => name + '.' + k + '.png';
  const tmp = path.join(OUT, '.side.html');
  fs.writeFileSync(tmp, `<body style="margin:0;background:#888;display:flex;gap:20px;padding:10px">${['design', 'rn', 'diff'].map((k) => `<img src="${u(k)}" width="${iw}" style="display:block">`).join('')}</body>`);
  await page.goto(pathToFileURL(tmp).href);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.screenshot({ path: path.join(OUT, name + '.side.jpg'), type: 'jpeg', quality: 40 });
  await ctx.close();
}

const pad = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s).padEnd(n));
function printSummary(name, rep) {
  console.log(`\n=== ${name}  route=${rep.route}  theme=${rep.theme}  mismatch=${rep.pixel.mismatchPct}%  matched=${rep.summary.matched} missing=${rep.summary.missing} flagged=${rep.summary.flagged}${rep.rnProblem ? '  RN PROBLEM: ' + rep.rnProblem : ''}`);
  if (rep.rnProblem) return;
  console.log(`${pad('element', 30)} ${pad('sev', 5)} ${pad('dX', 6)} ${pad('dY', 6)} ${pad('dW', 6)} ${pad('dH', 6)} ${pad('font(d>rn)', 14)} ${pad('radius', 8)} notes`);
  for (const r of rep.elements.slice(0, TOP)) {
    const f = r.font ? `${r.font.size[0]}>${r.font.size[1]}` : '';
    const rad = r.radius ? `${r.radius[0]}>${r.radius[1]}` : '';
    console.log(`${pad(r.kind[0] + ':' + r.key, 30)} ${pad(r.severity, 5)} ${pad(r.delta.x, 6)} ${pad(r.delta.y, 6)} ${pad(r.delta.w, 6)} ${pad(r.delta.h, 6)} ${pad(f, 14)} ${pad(rad, 8)} ${r.note ?? ''}`);
  }
  if (rep.missing.length) console.log(`  missing in RN (${rep.missing.length}): ${rep.missing.slice(0, 8).map((m) => m.key).join(' | ')}`);
}

// ---- main
fs.mkdirSync(OUT, { recursive: true });
restorePublicIndex();
let server = null, base = opt('--url');
if (!base) {
  await buildWeb({ rebuild: flag('--rebuild') });
  ({ server, base } = await startServer());
}
const browser = await chromium.launch();
const index = [];
try {
  for (const name of todo) {
    const cfg = screens[name];
    if (!designNames.includes(name)) { console.log(`\n${name}: no design file docs/redesign/screens/${name}.html`); continue; }
    if (!cfg || !cfg.route) { console.log(`\n${name}: not renderable (${cfg?.note ?? 'no route mapped'})`); index.push({ name, skipped: cfg?.note ?? 'no route' }); continue; }
    try {
      const d = await shootDesign(browser, name, themeOverride);
      const theme = themeOverride || (d.isDark ? 'dark' : 'light');
      const fixture = cfg.fixture ? JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', cfg.fixture + '.json'), 'utf8')) : null;
      const rn = await shootRn(browser, base, name, cfg, theme, d.height, fixture);
      const pixel = diffPngs(d.file, rn.file, path.join(OUT, `${name}.diff.png`));
      await sideBySide(browser, name, d.height);
      const cmp = compare(d.data, rn.data);
      const rep = {
        screen: name, route: cfg.route, theme, fixture: cfg.fixture ?? null, fixtureResult: rn.fx,
        designFrame: [W, d.height], designFontsLoaded: d.fontsOk, finalUrl: rn.finalUrl,
        rnProblem: rn.problem, rnConsoleErrors: rn.errors,
        pixel,
        summary: { designElements: d.data.items.length, rnElements: rn.data.items.length, matched: cmp.rows.length, missing: cmp.missing.length, extraInRn: cmp.extraInRn, flagged: cmp.rows.filter((r) => r.flagged).length },
        elements: cmp.rows,
        missing: cmp.missing,
      };
      fs.writeFileSync(path.join(OUT, `${name}.report.json`), JSON.stringify(rep, null, 2));
      index.push({ name, mismatchPct: pixel.mismatchPct, flagged: rep.summary.flagged, missing: rep.summary.missing, problem: rn.problem });
      printSummary(name, rep);
    } catch (e) {
      console.log(`\n${name}: FAILED ${String(e.message).split('\n')[0]}`);
      index.push({ name, error: String(e.message).split('\n')[0] });
    }
  }
} finally {
  await browser.close();
  server?.close();
  restorePublicIndex();
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
if (todo.length > 1) {
  console.log('\n--- index ---');
  for (const i of index) console.log(`${pad(i.name, 18)} ${i.error ? 'ERROR ' + i.error : i.skipped ? 'skipped: ' + i.skipped : `mismatch ${i.mismatchPct}%  flagged ${i.flagged}  missing ${i.missing}${i.problem ? '  PROBLEM ' + i.problem : ''}`}`);
}
