import type { FastifyInstance } from 'fastify';

/**
 * Lets a web page on one of `origins` (exact matches, e.g. https://app.example.com) call the API from a browser. The phone
 * app and the staff dashboard (same address) do not need this; it is for the app's web build. Requests carry a Bearer
 * token in a header, never a cookie, so credentials are not allowed across origins. Any other origin gets no CORS headers
 * and the browser blocks it.
 */
export function registerCors(app: FastifyInstance, origins: readonly string[]): void {
  const allowed = new Set(origins);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !allowed.has(origin)) return;
    void reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    if (request.method === 'OPTIONS' && request.headers['access-control-request-method']) {
      return reply
        .header('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        .header('access-control-allow-headers', 'authorization,content-type')
        .header('access-control-max-age', '600')
        .code(204)
        .send();
    }
  });
}
