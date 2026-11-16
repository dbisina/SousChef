import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@shared';
import type { Db } from './db';

export function healthRoutes(app: FastifyInstance, db: Db): void {
  // Is the process alive? No database call, so a database outage does not make the platform restart a healthy server.
  app.get('/healthz', async (): Promise<HealthResponse> => ({ status: 'ok', uptime: Math.round(process.uptime()) }));

  // Can it serve traffic? Used before sending requests to it.
  app.get('/readyz', async (_request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
