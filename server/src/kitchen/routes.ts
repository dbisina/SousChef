import type { FastifyInstance } from 'fastify';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import {
  addShoppingSchema,
  addWantToCookSchema,
  bulkPantrySchema,
  clearShoppingQuery,
  idParam,
  pantryItemSchema,
  pantryQuerySchema,
  updatePantrySchema,
  updateShoppingSchema,
  updateWantToCookSchema,
  usePantrySchema,
  wantToCookQuerySchema,
} from './schemas';
import type { PantryService, ShoppingService, WantToCookService } from './services';

interface Services {
  pantry: PantryService;
  shopping: ShoppingService;
  wantToCook: WantToCookService;
}

/** Everything under /v1/me/... that belongs to one person's kitchen. Every route needs a sign-in. */
export function kitchenRoutes(app: FastifyInstance, { pantry, shopping, wantToCook }: Services, auth: AuthService): void {
  const { requireViewer } = viewerResolvers(auth);

  /* ---- pantry ---- */

  app.get('/v1/me/pantry', async (request) => {
    const { userId } = await requireViewer(request);
    return { items: await pantry.list(userId, parse(pantryQuerySchema, request.query)) };
  });

  app.get('/v1/me/pantry/summary', async (request) => {
    const { userId } = await requireViewer(request);
    return pantry.summary(userId);
  });

  app.post('/v1/me/pantry', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await pantry.add(userId, parse(pantryItemSchema, request.body)));
  });

  app.post('/v1/me/pantry/bulk', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send({ items: await pantry.addMany(userId, parse(bulkPantrySchema, request.body).items) });
  });

  app.patch('/v1/me/pantry/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return pantry.update(userId, parse(idParam, request.params).id, parse(updatePantrySchema, request.body));
  });

  app.post('/v1/me/pantry/:id/use', async (request) => {
    const { userId } = await requireViewer(request);
    const item = await pantry.use(userId, parse(idParam, request.params).id, parse(usePantrySchema, request.body).amount);
    return { item };
  });

  app.delete('/v1/me/pantry/:id', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await pantry.remove(userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.delete('/v1/me/pantry', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await pantry.clear(userId);
    return reply.code(204).send();
  });

  /* ---- want to cook ---- */

  app.get('/v1/me/want-to-cook', async (request) => {
    const { userId } = await requireViewer(request);
    return wantToCook.list(userId, parse(wantToCookQuerySchema, request.query));
  });

  app.post('/v1/me/want-to-cook', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const { item, created } = await wantToCook.add(userId, parse(addWantToCookSchema, request.body));
    return reply.code(created ? 201 : 200).send(item);
  });

  app.patch('/v1/me/want-to-cook/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return wantToCook.update(userId, parse(idParam, request.params).id, parse(updateWantToCookSchema, request.body));
  });

  app.delete('/v1/me/want-to-cook/:id', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await wantToCook.remove(userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.post('/v1/me/want-to-cook/:id/shopping-list', async (request) => {
    const { userId } = await requireViewer(request);
    return wantToCook.addMissingToShoppingList(userId, parse(idParam, request.params).id);
  });

  /* ---- shopping list ---- */

  app.get('/v1/me/shopping-list', async (request) => {
    const { userId } = await requireViewer(request);
    return { items: await shopping.list(userId) };
  });

  app.post('/v1/me/shopping-list', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send({ items: await shopping.add(userId, parse(addShoppingSchema, request.body).items) });
  });

  app.patch('/v1/me/shopping-list/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return shopping.update(userId, parse(idParam, request.params).id, parse(updateShoppingSchema, request.body));
  });

  app.delete('/v1/me/shopping-list/:id', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await shopping.remove(userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  /** `?checkedOnly=true` clears just the ticked-off lines; without it the whole list goes. */
  app.delete('/v1/me/shopping-list', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await shopping.clear(userId, parse(clearShoppingQuery, request.query).checkedOnly);
    return reply.code(204).send();
  });
}
