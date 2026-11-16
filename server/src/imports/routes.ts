import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AddFramesRequest, CreateImportRequest, ScanRecipeRequest, ScanRecipeResponse, SearchImportRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { ImportService } from './service';

const createSchema = z.object({ url: z.string().trim().min(8).max(2048) }) satisfies z.ZodType<CreateImportRequest>;
const searchSchema = z.object({ query: z.string().trim().min(3).max(200) }) satisfies z.ZodType<SearchImportRequest>;
const framesSchema = z.object({ uploadIds: z.array(z.uuid()).min(1).max(8) }) satisfies z.ZodType<AddFramesRequest>;
const scanSchema = z.object({ uploadIds: z.array(z.uuid()).min(1).max(8), bookName: z.string().trim().max(80).optional() }) satisfies z.ZodType<ScanRecipeRequest>;
const idParam = z.object({ id: z.uuid() });

export function importRoutes(app: FastifyInstance, imports: ImportService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);
  // Each import can open a web page and call an AI service, so the pace is limited on top of the daily allowance.
  const limited = { config: { rateLimit: { max: config.IMPORT_RATE_LIMIT_MAX, timeWindow: '1 minute' } } };

  app.post('/v1/imports', limited, async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await imports.create(userId, parse(createSchema, request.body).url));
  });

  /** "I want to cook ...": find a real recipe page on the web and import it. */
  app.post('/v1/imports/search', limited, async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await imports.findByQuery(userId, parse(searchSchema, request.body).query));
  });

  app.post('/v1/imports/:id/frames', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return imports.addFrames(userId, parse(idParam, request.params).id, parse(framesSchema, request.body).uploadIds);
  });

  /** Reads a recipe from photos of a cookbook page. Nothing is kept. */
  app.post('/v1/imports/scan', limited, async (request): Promise<ScanRecipeResponse> => {
    const { userId } = await requireViewer(request);
    const body = parse(scanSchema, request.body);
    return { recipe: await imports.scanPhotos(userId, body.uploadIds, body.bookName) };
  });

  app.get('/v1/imports/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return imports.get(userId, parse(idParam, request.params).id);
  });
}
