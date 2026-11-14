// Browser-side collector. Passed to page.evaluate(), so it must be fully self-contained.
// Runs identically on the design HTML and on react-native-web output (both are plain DOM).
//   rootSel: CSS selector of the frame (".s" for the design, "#root" for the app)
// Returns { w, h, items: [{ kind, key, tag, box:{x,y,w,h}, style }] } with boxes relative to the frame.
export function collect(arg) {
  // arg: selector string, or { frame, scope } where scope also covers portals (RN Modal renders into <body>)
  const frameSel = typeof arg === 'string' ? arg : arg.frame;
  const scopeSel = typeof arg === 'string' ? arg : arg.scope;
  const frame = document.querySelector(frameSel);
  const root = document.querySelector(scopeSel);
  const rr = frame.getBoundingClientRect();
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const alpha = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 0;
    const p = m[1].split(/[ ,/]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  };
  const items = [];
  const seenImg = new Set();
  const all = root.querySelectorAll('*');

  const visible = (el, cs, r) =>
    r.width > 0.5 && r.height > 0.5 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.02;

  // an ancestor with overflow hidden / zero opacity could hide it; cheap check on opacity chain
  const chainVisible = (el) => {
    for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.02) return false;
    }
    return true;
  };

  const styleOf = (cs, r) => ({
    fontSize: parseFloat(cs.fontSize),
    fontWeight: cs.fontWeight,
    fontFamily: (cs.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim(),
    color: cs.color,
    bg: cs.backgroundColor,
    // effective radius: 999px and 9999px are the same pill, so clamp to half the shorter side
    radius: Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height / 2),
    letterSpacing: cs.letterSpacing,
    lineHeight: cs.lineHeight,
  });
  const rel = (r) => ({ x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height });

  for (const el of all) {
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'NOSCRIPT', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'ellipse', 'defs', 'clipPath', 'linearGradient', 'stop'].includes(el.tagName)) continue;
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!visible(el, cs, r) || !chainVisible(el)) continue;
    // clipped entirely outside the frame
    if (r.bottom < rr.top || r.top > rr.bottom || r.right < rr.left || r.left > rr.right) continue;

    const tag = el.tagName.toLowerCase();

    // images: <img>, or an element painted with a background-image url()
    const bgImg = cs.backgroundImage;
    const isImg = tag === 'img' || (bgImg && bgImg.includes('url('));
    if (isImg) {
      const src = tag === 'img' ? el.currentSrc || el.src : (bgImg.match(/url\("?([^")]+)"?\)/) || [])[1] || '';
      const k = src.split('/').pop().split('?')[0] + '@' + Math.round(r.left) + ',' + Math.round(r.top);
      if (seenImg.has(k)) continue; // RN renders <div bg> + hidden <img> for one image
      seenImg.add(k);
      items.push({ kind: 'img', key: 'img', tag, src: src.split('/').pop().slice(0, 40), box: rel(r), style: styleOf(cs, r) });
      continue;
    }

    // own text (direct text nodes)
    let own = '';
    const rng = document.createRange();
    let trect = null;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && norm(n.textContent)) {
        own += ' ' + n.textContent;
        rng.selectNodeContents(n);
        const b = rng.getBoundingClientRect();
        if (b.width > 0) {
          trect = trect
            ? { left: Math.min(trect.left, b.left), top: Math.min(trect.top, b.top), right: Math.max(trect.right, b.right), bottom: Math.max(trect.bottom, b.bottom) }
            : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
        }
      }
    }
    own = norm(own);
    if (own && trect) {
      items.push({
        kind: 'text', key: own.toLowerCase(), tag,
        box: rel({ left: trect.left, top: trect.top, width: trect.right - trect.left, height: trect.bottom - trect.top }),
        style: styleOf(cs, r),
      });
    }

    // boxes: interactive, input, or painted background / border
    const bgA = alpha(cs.backgroundColor);
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.05 && cs.borderTopStyle !== 'none';
    const hasGrad = bgImg && bgImg !== 'none';
    const interactive = ['button', 'a', 'input', 'textarea', 'select'].includes(tag) || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link' || el.getAttribute('role') === 'switch';
    if (el === root) continue;
    if (interactive || bgA > 0.04 || hasBorder || hasGrad) {
      if (r.width >= rr.width - 1 && r.height >= rr.height - 1) continue; // full-frame backdrop
      const full = norm(el.textContent).toLowerCase().slice(0, 80);
      items.push({ kind: 'box', key: full, tag, interactive, box: rel(r), style: styleOf(cs, r) });
    }
  }
  return { w: rr.width, h: rr.height, items };
}
