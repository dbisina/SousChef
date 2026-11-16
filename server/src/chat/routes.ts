import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AddMembersRequest, CreateConversationRequest, MuteRequest, SeqRequest, UpdateConversationRequest } from '@shared';
import { parse } from '../auth/schemas';
import type { AuthService } from '../auth/service';
import { viewerResolvers } from '../auth/viewer';
import type { ChatService } from './service';

const text = (max: number) => z.string().trim().max(max);
const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Something that looks like an emoji: a pictograph, a flag (two regional indicators) or a keycap (1️⃣). Flags and keycaps
 * are not "pictographic" in Unicode terms, so they are listed separately.
 */
const looksLikeEmoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣/u;
/** Exactly one emoji (a flag, a family and a skin-toned thumb each count as one). */
const emoji = z
  .string()
  .max(32)
  .refine((v) => v.length > 0 && [...segments.segment(v)].length === 1 && looksLikeEmoji.test(v), 'Use a single emoji');

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direct'), userId: z.uuid() }),
  z.object({ kind: z.literal('group'), title: text(80).min(1, 'Name the group'), memberIds: z.array(z.uuid()).min(1, 'Add at least one person').max(49) }),
]) satisfies z.ZodType<CreateConversationRequest>;

const common = { clientId: z.string().trim().min(8).max(64).regex(/^[\w.:-]+$/, 'Use letters, numbers and - _ . :'), replyToId: z.uuid().optional() };
const sendSchema = z.discriminatedUnion('kind', [
  z.object({ ...common, kind: z.literal('text'), text: text(4000).min(1, 'Write something') }),
  z.object({ ...common, kind: z.literal('recipe-card'), recipeId: z.uuid().optional(), title: text(200).min(1), photoUrl: z.url({ protocol: /^https?$/ }).max(2048).optional(), meta: text(200) }),
  z.object({ ...common, kind: z.literal('voice'), uploadId: z.uuid(), durationSec: z.number().int().min(1).max(600), waveform: z.array(z.number().int().min(0).max(100)).max(128) }),
  z.object({ ...common, kind: z.literal('image'), uploadId: z.uuid(), caption: text(500).optional() }),
]);

const seqSchema = z.object({ seq: z.number().int().min(0) }) satisfies z.ZodType<SeqRequest>;
const muteSchema = z.object({ muted: z.boolean() }) satisfies z.ZodType<MuteRequest>;
const renameSchema = z.object({ title: text(80).min(1, 'Name the group') }) satisfies z.ZodType<UpdateConversationRequest>;
const membersSchema = z.object({ userIds: z.array(z.uuid()).min(1).max(49) }) satisfies z.ZodType<AddMembersRequest>;

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(30), cursor: z.string().max(100).optional() });
const messagesQuery = z
  .object({
    afterSeq: z.coerce.number().int().min(0).optional(),
    beforeSeq: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((v) => v.afterSeq === undefined || v.beforeSeq === undefined, { message: 'Use afterSeq or beforeSeq, not both', path: ['beforeSeq'] });

const convParam = z.object({ id: z.uuid() });
const messageParams = z.object({ id: z.uuid(), messageId: z.uuid() });
const reactionParams = z.object({ id: z.uuid(), messageId: z.uuid(), emoji });
const memberParams = z.object({ id: z.uuid(), userId: z.uuid() });
const userParam = z.object({ userId: z.uuid() });

/** Chat over plain requests. Live delivery rides on the same service (see the WebSocket gateway). */
export function chatRoutes(app: FastifyInstance, chat: ChatService, auth: AuthService): void {
  const { requireViewer } = viewerResolvers(auth);

  app.post('/v1/conversations', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const { conversation, created } = await chat.create(userId, parse(createSchema, request.body));
    return reply.code(created ? 201 : 200).send(conversation);
  });

  app.get('/v1/conversations', async (request) => {
    const { userId } = await requireViewer(request);
    const { limit, cursor } = parse(listQuery, request.query);
    return chat.list(userId, limit, cursor);
  });

  app.get('/v1/conversations/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return chat.get(userId, parse(convParam, request.params).id);
  });

  app.patch('/v1/conversations/:id', async (request) => {
    const { userId } = await requireViewer(request);
    return chat.rename(userId, parse(convParam, request.params).id, parse(renameSchema, request.body).title);
  });

  app.put('/v1/conversations/:id/mute', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await chat.setMuted(userId, parse(convParam, request.params).id, parse(muteSchema, request.body).muted);
    return reply.code(204).send();
  });

  app.post('/v1/conversations/:id/members', async (request) => {
    const { userId } = await requireViewer(request);
    return chat.addMembers(userId, parse(convParam, request.params).id, parse(membersSchema, request.body).userIds);
  });

  /** An admin removes someone, or you remove yourself to leave. */
  app.delete('/v1/conversations/:id/members/:userId', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const p = parse(memberParams, request.params);
    await chat.removeMember(userId, p.id, p.userId);
    return reply.code(204).send();
  });

  app.get('/v1/conversations/:id/messages', async (request) => {
    const { userId } = await requireViewer(request);
    return chat.messages(userId, parse(convParam, request.params).id, parse(messagesQuery, request.query));
  });

  app.post('/v1/conversations/:id/messages', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const { message, created } = await chat.send(userId, parse(convParam, request.params).id, parse(sendSchema, request.body));
    return reply.code(created ? 201 : 200).send(message);
  });

  app.delete('/v1/conversations/:id/messages/:messageId', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const p = parse(messageParams, request.params);
    await chat.deleteMessage(userId, p.id, p.messageId);
    return reply.code(204).send();
  });

  app.post('/v1/conversations/:id/read', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await chat.markRead(userId, parse(convParam, request.params).id, parse(seqSchema, request.body).seq);
    return reply.code(204).send();
  });

  app.post('/v1/conversations/:id/delivered', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await chat.markDelivered(userId, parse(convParam, request.params).id, parse(seqSchema, request.body).seq);
    return reply.code(204).send();
  });

  app.put('/v1/conversations/:id/messages/:messageId/reactions/:emoji', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const p = parse(reactionParams, request.params);
    await chat.react(userId, p.id, p.messageId, p.emoji, true);
    return reply.code(204).send();
  });

  app.delete('/v1/conversations/:id/messages/:messageId/reactions/:emoji', async (request, reply) => {
    const { userId } = await requireViewer(request);
    const p = parse(reactionParams, request.params);
    await chat.react(userId, p.id, p.messageId, p.emoji, false);
    return reply.code(204).send();
  });

  /* ---- blocking ---- */

  app.get('/v1/me/blocks', async (request) => {
    const { userId } = await requireViewer(request);
    return { items: await chat.listBlocked(userId) };
  });

  app.put('/v1/me/blocks/:userId', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await chat.block(userId, parse(userParam, request.params).userId);
    return reply.code(204).send();
  });

  app.delete('/v1/me/blocks/:userId', async (request, reply) => {
    const { userId } = await requireViewer(request);
    await chat.unblock(userId, parse(userParam, request.params).userId);
    return reply.code(204).send();
  });
}
