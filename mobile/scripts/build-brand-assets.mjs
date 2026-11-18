// Makes the app's icon, splash and logo files from the brand kit in assets/enplace-brand-assets (the owner's source of truth).
//
//   node scripts/build-brand-assets.mjs
//
// Writes:
//   assets/icon.png                   iOS app icon: 1024 px, full square, opaque (iOS adds the rounded corners itself)
//   assets/adaptive-icon.png          Android adaptive icon foreground: the artwork inside the central safe zone, transparent
//   assets/adaptive-icon-monochrome.png   Android 13+ themed icon: the same artwork in one colour
//   assets/notification-icon.png      Android status-bar icon: white artwork on transparent
//   assets/splash-icon.png            the wordmark, centred on a transparent square (the splash background is set in app.json)
//   assets/favicon.png                web
//   assets/brand/wordmark-*.svg       the wordmark as vector, for use inside the app, plus lib/brandWordmark.ts (its proportions)
//
// Uses jimp-compact and pngjs, which come with Expo. Run it again whenever the brand kit changes.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');
const { PNG } = require('pngjs');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kit = (p) => join(root, 'assets', 'enplace-brand-assets', p);
const out = (p) => join(root, 'assets', p);

const NEAR_BLACK = 0x0b0b0bff;
const WHITE = 0xffffffff;

/** The smallest box that holds everything that is not transparent. */
function boxOf(img) {
  let x0 = img.bitmap.width, y0 = img.bitmap.height, x1 = -1, y1 = -1;
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] > 8) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  });
  if (x1 < 0) throw new Error('the artwork is empty');
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Artwork cropped to its box and scaled so the box is `width` px wide, optionally all one colour (keeping its shape). */
async function artwork(file, width, mono) {
  const img = await Jimp.read(file);
  const b = boxOf(img);
  img.crop(b.x, b.y, b.w, b.h).resize(width, Jimp.AUTO);
  if (mono) {
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (_x, _y, idx) {
      this.bitmap.data[idx] = 255;
      this.bitmap.data[idx + 1] = 255;
      this.bitmap.data[idx + 2] = 255;
    });
  }
  return img;
}

/** `art` centred on a canvas (a colour, or transparent when `bg` is null). */
function centred(art, size, bg) {
  const canvas = new Jimp(size, size, bg ?? 0x00000000);
  canvas.composite(art, Math.round((size - art.bitmap.width) / 2), Math.round((size - art.bitmap.height) / 2));
  return canvas;
}

async function savePng(img, file, { opaque = false } = {}) {
  if (!opaque) return img.writeAsync(file);
  // iOS icons must have no alpha channel at all: write plain RGB.
  const png = new PNG({ width: img.bitmap.width, height: img.bitmap.height });
  png.data = Buffer.from(img.bitmap.data);
  writeFileSync(file, PNG.sync.write(png, { colorType: 2, inputHasAlpha: true }));
}

const iconArt = kit('icon/enplace_icon_dark_transparent.png'); // light "en" and orange dot on transparent
const wordmarkArt = kit('wordmark/enplace_wordmark_dark_transparent.png');

// iOS: the artwork is about 62 percent of the width, on near-black, full square, no transparency.
await savePng(centred(await artwork(iconArt, Math.round(1024 * 0.62), false), 1024, NEAR_BLACK), out('icon.png'), { opaque: true });

// Android adaptive: the visible part is a circle about 66 percent of the canvas, so the artwork stays well inside it.
await savePng(centred(await artwork(iconArt, Math.round(1024 * 0.5), false), 1024, null), out('adaptive-icon.png'));
await savePng(centred(await artwork(iconArt, Math.round(1024 * 0.5), true), 1024, null), out('adaptive-icon-monochrome.png'));

// Android status bar: white on transparent, with room around it.
await savePng(centred(await artwork(iconArt, 72, true), 96, null), out('notification-icon.png'));

// Splash: the wordmark across a little over half of the width of a transparent square.
await savePng(centred(await artwork(wordmarkArt, Math.round(1600 * 0.56), false), 1600, null), out('splash-icon.png'));

// Web.
const fav = await Jimp.read(kit('icon/enplace_icon_dark_solid.png'));
await savePng(fav.resize(192, 192), out('favicon.png'));

// The wordmark as vector for use inside the app, and where its orange dot sits (to animate it on its own).
mkdirSync(out('brand'), { recursive: true });
async function wordmarkSvg(file, png) {
  let svg = readFileSync(file, 'utf8');
  const b = boxOf(await Jimp.read(png));
  const tight = { x: b.x / 2, y: b.y / 2, w: b.w / 2, h: b.h / 2 };
  const view = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const group = /<g transform="translate\(([\d.\-]+) ([\d.\-]+)\) scale\(([\d.]+)\)">/.exec(svg);
  const dot = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="#ff6b35"\/>/.exec(svg);
  if (!view || !dot) throw new Error(`unexpected wordmark svg: ${file}`);
  const [w, h] = [Number(view[1]), Number(view[2])];
  const insideGroup = group && svg.indexOf(dot[0]) > svg.indexOf(group[0]) && svg.indexOf(dot[0]) < svg.indexOf('</g>');
  const k = insideGroup ? Number(group[3]) : 1;
  const [tx, ty] = insideGroup ? [Number(group[1]), Number(group[2])] : [0, 0];
  const cut = (v) => Number(v.toFixed(2));
  svg = svg.replace(/width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/, `width="${cut(tight.w)}" height="${cut(tight.h)}" viewBox="${cut(tight.x)} ${cut(tight.y)} ${cut(tight.w)} ${cut(tight.h)}"`);
  void w;
  void h;
  return { svg, w: cut(tight.w), h: cut(tight.h), dot: { x: tx + Number(dot[1]) * k - tight.x, y: ty + Number(dot[2]) * k - tight.y, r: Number(dot[3]) * k }, dotTag: dot[0] };
}
const light = await wordmarkSvg(kit('wordmark/enplace_wordmark_dark_transparent.svg'), kit('wordmark/enplace_wordmark_dark_transparent.png')); // light ink: for dark backgrounds
const dark = await wordmarkSvg(kit('wordmark/enplace_wordmark_light_transparent.svg'), kit('wordmark/enplace_wordmark_light_transparent.png')); // dark ink: for light backgrounds
writeFileSync(out('brand/wordmark-light.svg'), light.svg);
writeFileSync(out('brand/wordmark-dark.svg'), dark.svg);
writeFileSync(out('brand/wordmark-light-nodot.svg'), light.svg.replace(light.dotTag, ''));
writeFileSync(
  join(root, 'lib', 'brandWordmark.ts'),
  `// Written by scripts/build-brand-assets.mjs from the brand kit. Do not edit by hand.\n/** The wordmark's own size, and where its orange dot sits inside it (the dot is drawn separately to animate it). */\nexport const WORDMARK = {\n  width: ${light.w},\n  height: ${light.h},\n  dot: { x: ${light.dot.x.toFixed(2)}, y: ${light.dot.y.toFixed(2)}, r: ${light.dot.r.toFixed(2)} },\n} as const;\nexport const BRAND = { orange: '#ff6b35', nearBlack: '#0b0b0b', offWhite: '#fafafa', cream: '#fbf7f1' } as const;\n`,
);
console.log('brand assets written');
