// Pairs design elements with RN elements and computes numeric deltas.
const byPos = (a, b) => a.box.y - b.box.y || a.box.x - b.box.x;
const r1 = (n) => Math.round(n * 10) / 10;
const alphaOf = (c) => { const m = (c || '').match(/rgba?(([^)]+))/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
// A design box that paints a background should pair with an RN box that paints one too (not a bare wrapper).
const bgPenalty = (d, r) => (alphaOf(d.style.bg) > 0.04 && alphaOf(r.style.bg) < 0.04 ? 40 : 0);

const parseRgb = (c) => {
  const m = (c || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const colorDelta = (a, b) => {
  const x = parseRgb(a), y = parseRgb(b);
  if (!x || !y) return 0;
  // composite nothing; just compare channels and alpha (alpha scaled to 255)
  return Math.round(Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b) + Math.abs(x.a - y.a) * 255);
};
const hex = (c) => {
  const x = parseRgb(c);
  if (!x) return c;
  const h = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(x.r)}${h(x.g)}${h(x.b)}${x.a < 1 ? h(x.a * 255) : ''}`;
};

function pairs(designItems, rnItems) {
  const matched = [];
  const missing = [];
  const usedRn = new Set();

  // 1) exact key match (text, and boxes that carry text), n-th occurrence by position
  for (const kind of ['text', 'box']) {
    const groups = new Map();
    for (const it of rnItems.filter((i) => i.kind === kind && (kind === 'text' || i.key)).sort(byPos)) {
      if (!groups.has(it.key)) groups.set(it.key, []);
      groups.get(it.key).push(it);
    }
    const dsorted = designItems.filter((i) => i.kind === kind && (kind === 'text' || i.key)).sort(byPos);
    for (const d of dsorted) {
      const g = groups.get(d.key);
      let r;
      if (kind === 'box' && g && g.length > 1) {
        // RN nests wrappers with the same text; take the one whose box is closest to the design's.
        const dist = (c) => bgPenalty(d, c) + Math.abs(c.box.x - d.box.x) + Math.abs(c.box.y - d.box.y) + Math.abs(c.box.w - d.box.w) + Math.abs(c.box.h - d.box.h);
        let bi = 0;
        g.forEach((c, i) => { if (dist(c) < dist(g[bi])) bi = i; });
        r = g.splice(bi, 1)[0];
      } else r = g && g.shift();
      if (r) { matched.push([d, r]); usedRn.add(r); } else missing.push(d);
    }
  }
  // 2) images by index
  const dImgs = designItems.filter((i) => i.kind === 'img').sort(byPos);
  const rImgs = rnItems.filter((i) => i.kind === 'img').sort(byPos);
  dImgs.forEach((d, i) => {
    const r = rImgs[i];
    if (r) { matched.push([d, r]); usedRn.add(r); } else missing.push(d);
  });
  // 3) text-less boxes by geometry (nearest centre, similar size)
  const rEmpty = rnItems.filter((i) => i.kind === 'box' && !i.key && !usedRn.has(i));
  const dEmpty = designItems.filter((i) => i.kind === 'box' && !i.key).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  for (const d of dEmpty) {
    const cx = d.box.x + d.box.w / 2, cy = d.box.y + d.box.h / 2;
    let best = null, bd = 1e9;
    for (const r of rEmpty) {
      if (usedRn.has(r)) continue;
      const wr = r.box.w / d.box.w, hr = r.box.h / d.box.h;
      if (wr < 0.5 || wr > 2 || hr < 0.5 || hr > 2) continue;
      const dist = Math.hypot(r.box.x + r.box.w / 2 - cx, r.box.y + r.box.h / 2 - cy) + bgPenalty(d, r);
      if (dist < bd) { bd = dist; best = r; }
    }
    if (best && bd < 100) { matched.push([d, best]); usedRn.add(best); } else missing.push(d);
  }
  const extra = rnItems.filter((r) => !usedRn.has(r));
  return { matched, missing, extra };
}

// RN loads Expo font files named like "Outfit_500Medium"; the design says family "Outfit" + weight 500.
function normFont(items) {
  for (const it of items) {
    const m = /^(Outfit|Inter)_(d{3})/.exec(it.style.fontFamily);
    if (m) { it.style.fontFamily = m[1]; it.style.fontWeight = m[2]; }
    if (it.style.fontWeight === 'normal') it.style.fontWeight = '400';
    if (it.style.fontWeight === 'bold') it.style.fontWeight = '700';
  }
}

export function compare(design, rn) {
  normFont(design.items);
  normFont(rn.items);
  const { matched, missing, extra } = pairs(design.items, rn.items);
  const rows = matched.map(([d, r]) => {
    const dx = r.box.x - d.box.x, dy = r.box.y - d.box.y, dw = r.box.w - d.box.w, dh = r.box.h - d.box.h;
    const fs = r.style.fontSize - d.style.fontSize;
    const radius = r.style.radius - d.style.radius;
    const weightDiff = d.kind === 'text' && String(d.style.fontWeight) !== String(r.style.fontWeight);
    const familyDiff = d.kind === 'text' && d.style.fontFamily.toLowerCase() !== r.style.fontFamily.toLowerCase();
    const colorD = d.kind === 'text' ? colorDelta(d.style.color, r.style.color) : 0;
    const bgD = d.kind === 'box' ? colorDelta(d.style.bg, r.style.bg) : 0;
    const geo = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dw), Math.abs(dh));
    const score = Math.max(geo, d.kind === 'text' ? Math.abs(fs) * 2 : 0, Math.abs(radius), weightDiff ? 3 : 0, colorD > 40 ? 3 : 0, bgD > 40 ? 3 : 0);
    return {
      kind: d.kind,
      key: d.kind === 'img' ? `img:${d.src}` : d.key.slice(0, 60) || `(${d.tag})`,
      severity: r1(score),
      flagged: score > 2,
      design: { x: r1(d.box.x), y: r1(d.box.y), w: r1(d.box.w), h: r1(d.box.h) },
      rn: { x: r1(r.box.x), y: r1(r.box.y), w: r1(r.box.w), h: r1(r.box.h) },
      delta: { x: r1(dx), y: r1(dy), w: r1(dw), h: r1(dh) },
      font: d.kind === 'text'
        ? {
            size: [d.style.fontSize, r.style.fontSize, r1(fs)],
            weight: [d.style.fontWeight, r.style.fontWeight],
            family: [d.style.fontFamily, r.style.fontFamily],
            lineHeight: [d.style.lineHeight, r.style.lineHeight],
            letterSpacing: [d.style.letterSpacing, r.style.letterSpacing],
          }
        : undefined,
      color: d.kind === 'text' ? [hex(d.style.color), hex(r.style.color), colorD] : undefined,
      background: d.kind === 'box' ? [hex(d.style.bg), hex(r.style.bg), bgD] : undefined,
      radius: d.kind !== 'text' && (d.style.radius || r.style.radius) ? [d.style.radius, r.style.radius, r1(radius)] : undefined,
      note: [weightDiff && 'weight', familyDiff && 'family'].filter(Boolean).join(',') || undefined,
    };
  });
  rows.sort((a, b) => b.severity - a.severity);
  const miss = missing.map((d) => ({
    kind: d.kind,
    key: d.kind === 'img' ? `img:${d.src}` : d.key.slice(0, 60) || `(${d.tag})`,
    design: { x: r1(d.box.x), y: r1(d.box.y), w: r1(d.box.w), h: r1(d.box.h) },
    status: 'missing',
  }));
  return { rows, missing: miss, extraInRn: extra.length };
}
