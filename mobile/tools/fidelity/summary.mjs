#!/usr/bin/env node
// Cross-screen systematic deltas from tools/fidelity/out/*.report.json.
//   node tools/fidelity/summary.mjs [--min 3]
// Groups matched elements by what they are in the design (text style / box shape) and prints the
// median delta (app minus design) with the number of screens and elements behind it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const minIdx = process.argv.indexOf('--min');
const MIN = minIdx > 0 ? Number(process.argv[minIdx + 1]) : 3;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const r1 = (n) => Math.round(n * 10) / 10;

const groups = new Map();
const add = (key, screen, el) => {
  if (!groups.has(key)) groups.set(key, { screens: new Set(), els: [] });
  const g = groups.get(key);
  g.screens.add(screen);
  g.els.push(el);
};

for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.report.json'))) {
  const rep = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  if (rep.rnProblem) continue;
  for (const e of rep.elements) {
    if (e.kind === 'text' && e.font) {
      const [fs0, fs1] = e.font.size;
      add(`text ${fs0}px w${e.font.weight[0]}`, rep.screen, { ...e, rnSize: fs1 });
    } else if (e.kind === 'box') {
      const h = Math.round(e.design.h / 4) * 4;
      const r = e.radius ? e.radius[0] : 0;
      const shape = r >= e.design.h / 2 - 1 && r > 8 ? 'pill' : r >= 12 ? 'card' : r > 0 ? 'rounded' : 'square';
      add(`box ${shape} h~${h}`, rep.screen, e);
    } else if (e.kind === 'img') {
      add(`img h~${Math.round(e.design.h / 20) * 20}`, rep.screen, e);
    }
  }
}

const rows = [];
for (const [key, g] of groups) {
  if (g.screens.size < MIN || g.els.length < MIN) continue;
  const d = (k) => med(g.els.map((e) => e.delta[k]));
  const radius = key.startsWith('text') ? 0 : med(g.els.filter((e) => e.radius).map((e) => e.radius[2]));
  rows.push({ key, screens: g.screens.size, n: g.els.length, dx: d('x'), dy: d('y'), dw: d('w'), dh: d('h'), radius,
    size: key.startsWith('text') ? med(g.els.map((e) => e.font.size[2])) : 0,
    mag: Math.max(Math.abs(d('h')), Math.abs(d('w')), Math.abs(d('y')), Math.abs(d('x')), Math.abs(radius), Math.abs(med(g.els.map((e) => e.font?.size?.[2] ?? 0))) * 2) });
}
rows.sort((a, b) => b.mag * Math.sqrt(b.n) - a.mag * Math.sqrt(a.n));
console.log('group'.padEnd(26), 'screens', 'n'.padStart(4), '  dX     dY     dW     dH   radius  fontSize');
for (const r of rows.slice(0, 40)) {
  console.log(r.key.padEnd(26), String(r.screens).padStart(7), String(r.n).padStart(4), [r.dx, r.dy, r.dw, r.dh, r.radius, r.size].map((v) => String(r1(v)).padStart(6)).join(' '));
}
