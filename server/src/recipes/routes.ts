import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../auth/service';
import { parse } from '../auth/schemas';
import { viewerResolvers } from '../auth/viewer';
import {
  commentParams,
  commentSchema,
  createRecipeSchema,
  flagSchema,
  idParam,
  listRecipesSchema,
  madePostSchema,
  matchSchema,
  pageSchema,
  rateSchema,
  updateRecipeSchema,
} from './schemas';
import type { RecipeService } from './service';

export function recipeRoutes(app: FastifyInstance, recipes: RecipeService, auth: AuthService): void {
  const { requireViewer, optionalViewer } = viewerResolvers(auth);

  /* ---- recipes ---- */

  app.post('/v1/recipes', async (request, reply) => {
    const viewer = await requireViewer(request);
    return reply.code(201).send(await recipes.create(viewer, parse(createRecipeSchema, request.body)));
  });

  app.get('/v1/recipes', async (request) => recipes.list(parse(listRecipesSchema, request.query)));

  app.post('/v1/recipes/match', async (request) => {
    const body = parse(matchSchema, request.body);
    return { items: await recipes.match(body.ingredients, body.limit ?? 20) };
  });

  app.get('/v1/recipes/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return recipes.get(id, await optionalViewer(request));
  });

  app.patch('/v1/recipes/:id', async (request) => {
    const viewer = await requireViewer(request);
    const { id } = parse(idParam, request.params);
    return recipes.update(id, viewer, parse(updateRecipeSchema, request.body));
  });

  app.delete('/v1/recipes/:id', async (request, reply) => {
    const viewer = await requireViewer(request);
    await recipes.remove(parse(idParam, request.params).id, viewer);
    return reply.code(204).send();
  });

  app.get('/v1/me/recipes', async (request) => {
    const viewer = await requireViewer(request);
    const { limit, cursor } = parse(pageSchema, request.query);
    return recipes.listMine(viewer.userId, limit, cursor);
  });

  app.get('/v1/me/saved-recipes', async (request) => {
    const viewer = await requireViewer(request);
    const { limit, cursor } = parse(pageSchema, request.query);
    return recipes.listSaved(viewer.userId, limit, cursor);
  });

  /* ---- like and save: PUT adds, DELETE removes, repeating either is harmless ---- */

  app.put('/v1/recipes/:id/like', async (request) => {
    const viewer = await requireViewer(request);
    return recipes.likeState(parse(idParam, request.params).id, viewer, true);
  });
  app.delete('/v1/recipes/:id/like', async (request) => {
    const viewer = await requireViewer(request);
    return recipes.likeState(parse(idParam, request.params).id, viewer, false);
  });
  app.put('/v1/recipes/:id/save', async (request) => {
    const viewer = await requireViewer(request);
    return recipes.saveState(parse(idParam, request.params).id, viewer, true);
  });
  app.delete('/v1/recipes/:id/save', async (request) => {
    const viewer = await requireViewer(request);
    return recipes.saveState(parse(idParam, request.params).id, viewer, false);
  });

  /* ---- rating ---- */

  app.put('/v1/recipes/:id/rating', async (request) => {
    const viewer = await requireViewer(request);
    const body = parse(rateSchema, request.body);
    return recipes.rate(parse(idParam, request.params).id, viewer, body.rating, body.review);
  });

  /* ---- comments ---- */

  app.get('/v1/recipes/:id/comments', async (request) => {
    const { limit, cursor } = parse(pageSchema, request.query);
    return recipes.listComments(parse(idParam, request.params).id, await optionalViewer(request), limit, cursor);
  });

  app.post('/v1/recipes/:id/comments', async (request, reply) => {
    const viewer = await requireViewer(request);
    const comment = await recipes.addComment(parse(idParam, request.params).id, viewer, parse(commentSchema, request.body).text);
    return reply.code(201).send(comment);
  });

  app.delete('/v1/recipes/:id/comments/:commentId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const { id, commentId } = parse(commentParams, request.params);
    await recipes.deleteComment(id, commentId, viewer);
    return reply.code(204).send();
  });

  /* ---- "I made this" ---- */

  app.get('/v1/recipes/:id/made', async (request) => {
    const { limit, cursor } = parse(pageSchema, request.query);
    return recipes.listMadePosts(parse(idParam, request.params).id, await optionalViewer(request), limit, cursor);
  });

  app.post('/v1/recipes/:id/made', async (request, reply) => {
    const viewer = await requireViewer(request);
    const body = parse(madePostSchema, request.body);
    return reply.code(201).send(await recipes.addMadePost(parse(idParam, request.params).id, viewer, body.imageUrl, body.caption));
  });

  app.delete('/v1/recipes/:id/made/:postId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const params = parse(commentParams.omit({ commentId: true }).extend({ postId: idParam.shape.id }), request.params);
    await recipes.deleteMadePost(params.id, params.postId, viewer);
    return reply.code(204).send();
  });

  /* ---- reports ---- */

  app.post('/v1/recipes/:id/flag', async (request, reply) => {
    const viewer = await requireViewer(request);
    await recipes.flag(parse(idParam, request.params).id, viewer, parse(flagSchema, request.body).reason);
    return reply.code(204).send();
  });
}
