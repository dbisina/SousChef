import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateChallengeRequest, CreateCommunityRequest, CreateEventRequest, SetRoleRequest, UpdateCommunityRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { PostService } from '../social/posts';
import type { CommunityService } from './service';

const text = (max: number) => z.string().trim().max(max);
const name = text(60).min(3, 'Give the community a name');
const futureOrPast = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), 'Not a valid date');

const createSchema = z.object({
  name,
  description: text(1000).optional(),
  visibility: z.enum(['public', 'private']),
  photoUploadId: z.uuid().optional(),
}) satisfies z.ZodType<CreateCommunityRequest>;
const updateSchema = z
  .object({ name: name.optional(), description: text(1000).optional(), visibility: z.enum(['public', 'private']).optional(), photoUploadId: z.uuid().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' }) satisfies z.ZodType<UpdateCommunityRequest>;
const roleSchema = z.object({ role: z.enum(['admin', 'member']) }) satisfies z.ZodType<SetRoleRequest>;
const challengeSchema = z.object({
  title: text(100).min(2, 'Name the challenge'),
  description: text(1000).optional(),
  photoUploadId: z.uuid().optional(),
  endsAt: futureOrPast,
}) satisfies z.ZodType<CreateChallengeRequest>;
const eventSchema = z.object({ title: text(100).min(2, 'Name the event'), detail: text(1000).optional(), startsAt: futureOrPast }) satisfies z.ZodType<CreateEventRequest>;

const limit = z.coerce.number().int().min(1).max(50).default(20);
const pageQuery = z.object({ limit, cursor: z.string().max(100).optional() });
const listQuery = z.object({ q: text(60).optional(), limit, cursor: z.string().max(100).optional() });
const membersQuery = z.object({ pending: z.enum(['true', 'false']).transform((v) => v === 'true').default(false), limit, cursor: z.string().max(100).optional() });

const idParam = z.object({ id: z.uuid() });
const memberParams = z.object({ id: z.uuid(), userId: z.uuid() });
const challengeParams = z.object({ id: z.uuid(), challengeId: z.uuid() });
const eventParams = z.object({ id: z.uuid(), eventId: z.uuid() });

export function communityRoutes(app: FastifyInstance, communities: CommunityService, posts: PostService, auth: AuthService): void {
  const { requireViewer, optionalViewer } = viewerResolvers(auth);

  app.post('/v1/communities', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await communities.create(userId, parse(createSchema, request.body)));
  });

  app.get('/v1/communities', async (request) => communities.list(await optionalViewer(request), parse(listQuery, request.query)));

  app.get('/v1/me/communities', async (request) => ({ items: await communities.mine((await requireViewer(request)).userId) }));

  app.get('/v1/communities/:id', async (request) => communities.get(parse(idParam, request.params).id, await optionalViewer(request)));

  app.patch('/v1/communities/:id', async (request) => {
    const viewer = await requireViewer(request);
    return communities.update(viewer.userId, viewer.role, parse(idParam, request.params).id, parse(updateSchema, request.body));
  });

  app.delete('/v1/communities/:id', async (request, reply) => {
    const viewer = await requireViewer(request);
    await communities.remove(viewer.userId, viewer.role, parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  /* ---- membership ---- */

  app.post('/v1/communities/:id/join', async (request) => communities.join((await requireViewer(request)).userId, parse(idParam, request.params).id));

  app.delete('/v1/communities/:id/membership', async (request, reply) => {
    await communities.leave((await requireViewer(request)).userId, parse(idParam, request.params).id);
    return reply.code(204).send();
  });

  app.get('/v1/communities/:id/members', async (request) => {
    const viewer = await requireViewer(request);
    const { pending, limit: n, cursor } = parse(membersQuery, request.query);
    return communities.members(viewer, parse(idParam, request.params).id, { pending, limit: n, cursor });
  });

  app.post('/v1/communities/:id/members/:userId/approve', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(memberParams, request.params);
    await communities.approve(viewer, p.id, p.userId);
    return reply.code(204).send();
  });

  app.delete('/v1/communities/:id/members/:userId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(memberParams, request.params);
    await communities.removeMember(viewer, p.id, p.userId);
    return reply.code(204).send();
  });

  app.put('/v1/communities/:id/members/:userId/role', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(memberParams, request.params);
    await communities.setRole(viewer, p.id, p.userId, parse(roleSchema, request.body).role);
    return reply.code(204).send();
  });

  /* ---- posts, challenges, events ---- */

  app.get('/v1/communities/:id/posts', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.byCommunity(parse(idParam, request.params).id, await optionalViewer(request), n, cursor);
  });

  app.get('/v1/communities/:id/challenges', async (request) => ({ items: await communities.challenges(await optionalViewer(request), parse(idParam, request.params).id) }));

  app.post('/v1/communities/:id/challenges', async (request, reply) => {
    const viewer = await requireViewer(request);
    return reply.code(201).send(await communities.createChallenge(viewer, parse(idParam, request.params).id, parse(challengeSchema, request.body)));
  });

  app.delete('/v1/communities/:id/challenges/:challengeId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(challengeParams, request.params);
    await communities.deleteChallenge(viewer, p.id, p.challengeId);
    return reply.code(204).send();
  });

  app.get('/v1/communities/:id/events', async (request) => ({ items: await communities.upcomingEvents(await optionalViewer(request), parse(idParam, request.params).id) }));

  app.post('/v1/communities/:id/events', async (request, reply) => {
    const viewer = await requireViewer(request);
    return reply.code(201).send(await communities.createEvent(viewer, parse(idParam, request.params).id, parse(eventSchema, request.body)));
  });

  app.delete('/v1/communities/:id/events/:eventId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(eventParams, request.params);
    await communities.deleteEvent(viewer, p.id, p.eventId);
    return reply.code(204).send();
  });
}
