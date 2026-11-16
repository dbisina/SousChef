import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateCookbookRequest, UpdateCookbookRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { CookbookService } from './service';

const text = (max: number) => z.string().trim().max(max);
const url = z.url({ protocol: /^https?$/ }).max(2048);
const base = {
  title: text(120).min(2, 'Give the cookbook a title'),
  description: text(2000),
  coverImageUrl: url,
  recipeIds: z.array(z.uuid()).max(200),
  published: z.boolean(),
};
const createSchema = z.object({
  title: base.title,
  description: base.description.optional(),
  coverImageUrl: base.coverImageUrl,
  category: text(40).min(1).optional(),
  recipeIds: base.recipeIds,
  published: base.published.optional(),
}) satisfies z.ZodType<CreateCookbookRequest>;
const updateSchema = z
  .object({
    title: base.title.optional(),
    description: base.description.optional(),
    coverImageUrl: base.coverImageUrl.optional(),
    category: text(40).min(1).nullable().optional(),
    recipeIds: base.recipeIds.optional(),
    published: base.published.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateCookbookRequest>;

const listQuery = z.object({
  category: text(40).min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(100).optional(),
});
const pageQuery = z.object({ limit: listQuery.shape.limit, cursor: listQuery.shape.cursor });
const idParam = z.object({ id: z.uuid() });

export function cookbookRoutes(app: FastifyInstance, cookbooks: CookbookService, auth: AuthService): void {
  const { requireViewer, optionalViewer, requireAdmin } = viewerResolvers(auth);

  app.get('/v1/cookbooks', async (request) => cookbooks.list(parse(listQuery, request.query)));

  app.get('/v1/cookbooks/:id', async (request) => cookbooks.get(parse(idParam, request.params).id, await optionalViewer(request)));

  app.get('/v1/cookbooks/:id/recipes', async (request) => {
    const { limit, cursor } = parse(pageQuery, request.query);
    return cookbooks.recipes(parse(idParam, request.params).id, await optionalViewer(request), limit, cursor);
  });

  app.put('/v1/cookbooks/:id/like', async (request) => cookbooks.setLiked(parse(idParam, request.params).id, await requireViewer(request), true));
  app.delete('/v1/cookbooks/:id/like', async (request) => cookbooks.setLiked(parse(idParam, request.params).id, await requireViewer(request), false));
  app.put('/v1/cookbooks/:id/save', async (request) => cookbooks.setSaved(parse(idParam, request.params).id, await requireViewer(request), true));
  app.delete('/v1/cookbooks/:id/save', async (request) => cookbooks.setSaved(parse(idParam, request.params).id, await requireViewer(request), false));

  app.get('/v1/me/saved-cookbooks', async (request) => {
    const { userId } = await requireViewer(request);
    const { limit, cursor } = parse(pageQuery, request.query);
    return cookbooks.listSaved(userId, limit, cursor);
  });

  /* ---- staff only ---- */

  app.post('/v1/admin/cookbooks', async (request, reply) => {
    await requireAdmin(request);
    return reply.code(201).send(await cookbooks.create(parse(createSchema, request.body)));
  });

  app.patch('/v1/admin/cookbooks/:id', async (request) => {
    await requireAdmin(request);
    return cookbooks.update(parse(idParam, request.params).id, parse(updateSchema, request.body));
  });

  app.delete('/v1/admin/cookbooks/:id', async (request, reply) => {
    await requireAdmin(request);
    await cookbooks.remove(parse(idParam, request.params).id);
    return reply.code(204).send();
  });
}
