// Builds the Expo web app in design-review mode and serves it with SPA fallback.
//
// Why export + static server instead of `expo start --web`:
//   * public/index.html (Firebase hosting landing page) shadows the app shell. We move it aside
//     ONLY for the duration of the export and restore it in a finally block (and on SIGINT), so
//     git never sees a change under public/.
//   * EXPO_PUBLIC_DESIGN_REVIEW is a build-time flag, so a static export is the honest shape.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = path.join(ROOT, 'dist-web');
const PUB = path.join(ROOT, 'public', 'index.html');
const ASIDE = path.join(ROOT, '.fidelity-public-index.aside');

/** Recover from a crashed earlier run that left public/index.html moved aside. */
export function restorePublicIndex() {
  if (fs.existsSync(ASIDE)) {
    if (fs.existsSync(PUB)) fs.rmSync(ASIDE);
    else fs.renameSync(ASIDE, PUB);
  }
}

const sh = (cmd, env) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, { cwd: ROOT, env, shell: true, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });

export async function buildWeb({ rebuild = false } = {}) {
  restorePublicIndex();
  if (!rebuild && fs.existsSync(path.join(DIST, 'index.html'))) return;
  const env = {
    ...process.env,
    CI: '1',
    EXPO_PUBLIC_DESIGN_REVIEW: '1',
    // Placeholders so firebase/auth can initialise offline; nothing is ever contacted.
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'fake-review-key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'review.local',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'review',
    EXPO_PUBLIC_FIREBASE_APP_ID: '1:1:web:1',
  };
  const hadPub = fs.existsSync(PUB);
  const onSig = () => { restorePublicIndex(); process.exit(1); };
  process.once('SIGINT', onSig);
  try {
    if (hadPub) fs.renameSync(PUB, ASIDE);
    console.log('[fidelity] exporting web bundle (design-review mode)...');
    await sh('npx expo export --platform web --output-dir dist-web', env);
  } finally {
    restorePublicIndex();
    process.removeListener('SIGINT', onSig);
  }
}

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
};

export function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    // Design photos for fixtures: /__assets/<name>.jpg -> .redesign-assets/<name>.jpg
    if (urlPath.startsWith('/__assets/')) {
      const f = path.join(ROOT, '.redesign-assets', path.basename(urlPath));
      if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'image/jpeg' }); return fs.createReadStream(f).pipe(res); }
      res.writeHead(404); return res.end();
    }
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const asRepo = path.join(ROOT, urlPath); // lets /assets/... fall back to repo files if needed
      file = path.extname(urlPath) && fs.existsSync(asRepo) && fs.statSync(asRepo).isFile() && urlPath.startsWith('/assets/')
        ? asRepo
        : path.join(DIST, 'index.html'); // SPA fallback
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })),
  );
}
