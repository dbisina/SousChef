import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { POST_KINDS, type CreatePostCommentRequest, type CreatePostRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { Config } from '../config';
import type { FollowService } from './follows';
import type { PostService } from './posts';

const text = (max: number) => z.string().trim().max(max);

const createPostSchema = z.object({
  kind: z.enum(POST_KINDS),
  title: text(120).min(1, 'Give it a title'),
  caption: text(2000).optional(),
  meta: text(120).optional(),
  recipeId: z.uuid().optional(),
  communityId: z.uuid().optional(),
  challengeId: z.uuid().optional(),
  photoUploadId: z.uuid(),
  videoUploadId: z.uuid().optional(),
}) satisfies z.ZodType<CreatePostRequest>;

const createCommentSchema = z.object({
  parentId: z.uuid().optional(),
  text: text(2000).optional(),
  voice: z.object({ uploadId: z.uuid(), durationSec: z.number().int().min(1).max(300) }).optional(),
}) satisfies z.ZodType<CreatePostCommentRequest>;

const limit = z.coerce.number().int().min(1).max(50).default(20);
const pageQuery = z.object({ limit, cursor: z.string().max(100).optional() });
const searchQuery = z.object({ q: text(60), limit: z.coerce.number().int().min(1).max(20).default(10) });

const idParam = z.object({ id: z.uuid() });
const commentParams = z.object({ id: z.uuid(), commentId: z.uuid() });

export function socialRoutes(app: FastifyInstance, follows: FollowService, posts: PostService, auth: AuthService, config: Config): void {
  const { requireViewer, optionalViewer } = viewerResolvers(auth);
  const tracking = { config: { rateLimit: { max: Math.min(config.RATE_LIMIT_MAX, 60), timeWindow: '1 minute' } } };

  /* ---- people ---- */

  app.get('/v1/users/search', async (request) => {
    const { q, limit: n } = parse(searchQuery, request.query);
    return { items: await follows.search(q, await optionalViewer(request), n) };
  });

  app.get('/v1/users/:id', async (request) => follows.profile(parse(idParam, request.params).id, await optionalViewer(request)));

  app.put('/v1/users/:id/follow', async (request) => {
    const { userId } = await requireViewer(request);
    return follows.setFollowing(userId, parse(idParam, request.params).id, true);
  });
  app.delete('/v1/users/:id/follow', async (request) => {
    const { userId } = await requireViewer(request);
    return follows.setFollowing(userId, parse(idParam, request.params).id, false);
  });

  app.get('/v1/users/:id/followers', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return follows.followers(parse(idParam, request.params).id, n, cursor);
  });
  app.get('/v1/users/:id/following', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return follows.following(parse(idParam, request.params).id, n, cursor);
  });

  app.get('/v1/users/:id/posts', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.byUser(parse(idParam, request.params).id, await optionalViewer(request), n, cursor);
  });

  /* ---- feeds ---- */

  app.get('/v1/feed/following', async (request) => {
    const viewer = await requireViewer(request);
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.followingFeed(viewer, n, cursor);
  });

  /** Ranked for the viewer; works signed out. */
  app.get('/v1/feed/for-you', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.forYou(await optionalViewer(request), n, cursor);
  });

  app.get('/v1/feed/discover', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.discoverFeed(await optionalViewer(request), n, cursor);
  });

  app.get('/v1/me/saved-posts', async (request) => {
    const viewer = await requireViewer(request);
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.listSaved(viewer, n, cursor);
  });

  /* ---- posts ---- */

  app.post('/v1/posts', async (request, reply) => {
    const { userId } = await requireViewer(request);
    return reply.code(201).send(await posts.create(userId, parse(createPostSchema, request.body)));
  });

  app.get('/v1/posts/:id', async (request) => posts.get(parse(idParam, request.params).id, await optionalViewer(request)));

  app.delete('/v1/posts/:id', async (request, reply) => {
    const viewer = await requireViewer(request);
    await posts.remove(parse(idParam, request.params).id, viewer);
    return reply.code(204).send();
  });

  app.post('/v1/posts/:id/view', tracking, async (request, reply) => {
    await posts.view(parse(idParam, request.params).id, await optionalViewer(request));
    return reply.code(204).send();
  });

  app.put('/v1/posts/:id/like', async (request) => posts.setLiked(parse(idParam, request.params).id, await requireViewer(request), true));
  app.delete('/v1/posts/:id/like', async (request) => posts.setLiked(parse(idParam, request.params).id, await requireViewer(request), false));
  app.put('/v1/posts/:id/save', async (request) => posts.setSaved(parse(idParam, request.params).id, await requireViewer(request), true));
  app.delete('/v1/posts/:id/save', async (request) => posts.setSaved(parse(idParam, request.params).id, await requireViewer(request), false));

  /* ---- comments ---- */

  app.get('/v1/posts/:id/comments', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    return posts.comments(parse(idParam, request.params).id, await optionalViewer(request), n, cursor);
  });

  app.post('/v1/posts/:id/comments', async (request, reply) => {
    const viewer = await requireViewer(request);
    return reply.code(201).send(await posts.addComment(parse(idParam, request.params).id, viewer, parse(createCommentSchema, request.body)));
  });

  app.get('/v1/posts/:id/comments/:commentId/replies', async (request) => {
    const { limit: n, cursor } = parse(pageQuery, request.query);
    const p = parse(commentParams, request.params);
    return posts.replies(p.id, p.commentId, await optionalViewer(request), n, cursor);
  });

  app.delete('/v1/posts/:id/comments/:commentId', async (request, reply) => {
    const viewer = await requireViewer(request);
    const p = parse(commentParams, request.params);
    await posts.deleteComment(p.id, p.commentId, viewer);
    return reply.code(204).send();
  });

  app.put('/v1/posts/:id/comments/:commentId/like', async (request) => {
    const viewer = await requireViewer(request);
    const p = parse(commentParams, request.params);
    return posts.setCommentLiked(p.id, p.commentId, viewer, true);
  });
  app.delete('/v1/posts/:id/comments/:commentId/like', async (request) => {
    const viewer = await requireViewer(request);
    const p = parse(commentParams, request.params);
    return posts.setCommentLiked(p.id, p.commentId, viewer, false);
  });
}
