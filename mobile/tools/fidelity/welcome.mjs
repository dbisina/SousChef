// Measures the Welcome sheet (components/ui/WelcomeModal.tsx), which has no design file.
//   node tools/fidelity/welcome.mjs [--rebuild] [--theme light|dark] [--url http://host:port] [--no-ad]
// Opens /?welcome=1 in review mode at 390x844 with a sponsored ad seeded into the ad store, then
// checks the sheet against tokens.css `.sheet` (34px top radius, 24/20 padding, 16 gap) and the 70% height cap.
// Output: tools/fidelity/out/WelcomeSheet.jpg and WelcomeSheet.measure.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildWeb, startServer, restorePublicIndex } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const theme = opt('--theme') || 'light';
const withAd = !args.includes('--no-ad');
const VW = 390, VH = 844;

fs.mkdirSync(OUT, { recursive: true });
restorePublicIndex();
let server = null, base = opt('--url');
if (!base) {
  await buildWeb({ rebuild: args.includes('--rebuild') });
  ({ server, base } = await startServer());
}
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, colorScheme: theme });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('@souschef_onboarding_complete', 'true'); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?welcome=1&theme=${theme}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SC__, null, { timeout: 30000 });
  if (withAd) {
    await page.evaluate(() => {
      const ts = window.__SC__.Timestamp.now();
      window.__SC__.stores.ad.setState({
        ads: {
          welcome_modal: {
            id: 'welcome-fixture', advertiserId: 'a', advertiserName: 'Fresh Farm Market', title: 'Fresh produce delivered',
            subtitle: 'Free delivery on your first order', imageURL: '/__assets/avocado.jpg', ctaText: 'Shop now',
            ctaURL: 'https://example.com', placements: ['welcome_modal'], format: 'banner', status: 'active',
            startDate: ts, endDate: ts, budgetCents: 0, cpmCents: 0, spentCents: 0, impressions: 0, clicks: 0, createdAt: ts, updatedAt: ts,
          },
          home_feed: null, recipe_detail: null, shopping_list: null, browse: null,
        },
      });
    });
  }
  const sheetSel = '[aria-modal="true"], [role="dialog"]';
  await page.waitForTimeout(2500);
  const data = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    // The sheet is the element holding the 'Welcome to' heading's nearest ancestor with a 34px top radius.
    let h = [...document.querySelectorAll('div,span')].find((e) => e.children.length === 0 && /Welcome to/.test(e.textContent));
    let sheet = h;
    while (sheet && parseFloat(getComputedStyle(sheet).borderTopLeftRadius) < 30) sheet = sheet.parentElement;
    if (!sheet) return { error: 'sheet not found' };
    const cs = getComputedStyle(sheet);
    const kids = [...sheet.children].map((c) => ({ ...r(c), text: (c.innerText || '').slice(0, 30).replace(/\n/g, ' ') }));
    const gaps = kids.slice(1).map((k, i) => +(k.y - (kids[i].y + kids[i].h)).toFixed(1));
    return {
      sheet: r(sheet), radius: cs.borderTopLeftRadius, paddingTop: cs.paddingTop, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom, gapCss: cs.rowGap, kids, gaps, scrollH: sheet.scrollHeight, clientH: sheet.clientHeight,
      viewport: { w: innerWidth, h: innerHeight }, hasAd: /Sponsored/.test(sheet.innerText),
    };
  });
  await page.screenshot({ path: path.join(OUT, 'WelcomeSheet.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
  const pct = data.sheet ? +((data.sheet.h / VH) * 100).toFixed(1) : null;
  const rep = { theme, withAd, viewport: [VW, VH], heightPct: pct, maxPct: 70, fits: pct != null && pct <= 70.05 && data.scrollH <= data.clientH + 1, ...data };
  fs.writeFileSync(path.join(OUT, 'WelcomeSheet.measure.json'), JSON.stringify(rep, null, 2));
  console.log(JSON.stringify({ ...rep, kids: undefined }, null, 1));
  console.log('children:\n' + (rep.kids || []).map((k) => `  y=${k.y} h=${k.h} x=${k.x} w=${k.w}  ${k.text}`).join('\n'));
} finally {
  await browser.close();
  server?.close();
  restorePublicIndex();
}
