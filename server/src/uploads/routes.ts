import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UPLOAD_PURPOSES, UPLOAD_RULES, type CreateUploadRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { UploadService } from './service';

const createSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    contentType: z.string().trim().toLowerCase().max(100),
    size: z.number().int().min(1),
  })
  .superRefine((v, ctx) => {
    const rule = UPLOAD_RULES[v.purpose];
    if (!rule.contentTypes.includes(v.contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: `Use one of: ${rule.contentTypes.join(', ')}` });
    }
    if (v.size > rule.maxBytes) {
      ctx.addIssue({ code: 'custom', path: ['size'], message: `Files of this kind can be at most ${Math.floor(rule.maxBytes / 1024 / 1024)} MB` });
    }
  }) satisfies z.ZodType<CreateUploadRequest>;

const idParam = z.object({ id: z.uuid() });

export function uploadRoutes(app: FastifyInstance, uploads: UploadService, auth: AuthService, config: Config): void {
  const { requireViewer } = viewerResolvers(auth);
  const limited = { config: { rateLimit: { max: Math.min(config.RATE_LIMIT_MAX, 60), timeWindow: '1 minute' } } };

  app.post('/v1/uploads', limited, async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await uploads.create(userId, parse(createSchema, request.body)));
  });

  app.post('/v1/uploads/:id/complete', limited, async (request) => {
    const { userId } = await requireViewer(request);
    return uploads.complete(userId, parse(idParam, request.params).id);
  });

  app.delete('/v1/uploads/:id', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await uploads.remove(userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });
}
