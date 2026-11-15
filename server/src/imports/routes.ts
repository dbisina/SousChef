import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AddFramesRequest, CreateImportRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { ImportService } from './service';

const createSchema = z.object({ url: z.string().trim().min(8).max(2048) }) satisfies z.ZodType<CreateImportRequest>;
const framesSchema = z.object({ uploadIds: z.array(z.uuid()).min(1).max(8) }) satisfies z.ZodType<AddFramesRequest>;
const idParam = z.object({ id: z.uuid() });

export function importRoutes(app: FastifyInstance, imports: ImportService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);
  // Each import can open a web page and call an AI service, so the pace is limited on top of the daily allowance.
  const limited = { config: { rateLimit: { max: config.IMPORT_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.post('/v1/imports', limited, async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await imports.create(userId, parse(createSchema, request.body).url));
  });

  app.post('/v1/imports/:id/frames', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return imports.addFrames(userId, parse(idParam, request.params).id, parse(framesSchema, request.body).uploadIds);
  });

  app.get('/v1/imports/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return imports.get(userId, parse(idParam, request.params).id);
  });
}
