import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/** Allows only what the built dashboard itself needs: its own scripts, styles and fonts, and images from anywhere on https. */
const CSP = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

/**
 * Serves the built staff dashboard (admin/dist) at /admin/ from the API's own address, so the site needs no CORS and no
 * second server. A page address it does not know (the dashboard routes in the browser) gets index.html; a missing file
 * (anything with an extension) is a plain 404. Everything is read from inside `root` only.
 */
export function registerAdminSite(app: FastifyInstance, root: string): void {
  const base = path.resolve(root);

  app.get('/admin', async (_request, reply) => reply.redirect('/admin/', 301));

  app.get('/admin/*', async (request, reply) => {
    const raw = (request.params as { '*': string })['*'] ?? '';
    let wanted: string;
    try {
      wanted = decodeURIComponent(raw);
    } catch {
      return reply.code(400).send({ error: { code: 'validation_error', message: 'Bad address' } });
    }
    if (wanted.includes('\0') || wanted.split(/[\\/]/).includes('..')) return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } });

    const target = path.resolve(base, wanted === '' ? 'index.html' : wanted);
    if (target !== base && !target.startsWith(base + path.sep)) return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } });

    let file = target;
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      // A dashboard page (no file extension) falls back to the app shell; a missing file is a 404.
      if (path.extname(wanted) !== '') return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } });
      file = path.join(base, 'index.html');
      info = await stat(file).catch(() => null);
      if (!info?.isFile()) return reply.code(404).send({ error: { code: 'not_found', message: 'The dashboard has not been built' } });
    }

    const ext = path.extname(file).toLowerCase();
    const isPage = ext === '.html';
    void reply
      .type(TYPES[ext] ?? 'application/octet-stream')
      .header('x-content-type-options', 'nosniff')
      .header('referrer-policy', 'no-referrer')
      .header('x-robots-tag', 'noindex')
      // The page is never cached (a new build shows at once); the hashed files it names never change.
      .header('cache-control', isPage ? 'no-store' : file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (isPage) void reply.header('content-security-policy', CSP).header('x-frame-options', 'DENY');
    return reply.send(createReadStream(file));
  });
}
