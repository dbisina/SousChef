import type {
  Conversation,
  CreateConversationRequest,
  Message,
  MessageKind,
  MessagePage,
  Page,
  Participant,
  SendMessageRequest,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import { isUniqueViolation, type Db } from '../db';
import { AppError, errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';
import type { UploadService } from '../uploads/service';
import { noEvents, type ChatEvents } from './events';

const MAX_GROUP_MEMBERS = 50;
/** Most messages one person can send in a short burst. */
const SEND_BURST = 30;
const SEND_BURST_MS = 10_000;

const memberWith = { user: { select: authorSelect } } satisfies Prisma.ConversationMemberInclude;
type MemberRow = Prisma.ConversationMemberGetPayload<{ include: typeof memberWith }>;
type MessageRow = Prisma.MessageGetPayload<{ include: { sender: { select: typeof authorSelect } } }>;
const withSender = { sender: { select: authorSelect } } satisfies Prisma.MessageInclude;

const preview = (kind: string, body: Record<string, unknown>, deleted: boolean): string => {
  if (deleted) return 'Message deleted';
  switch (kind) {
    case 'text':
      return String(body['text'] ?? '').slice(0, 80);
    case 'recipe-card':
      return 'Sent a recipe';
    case 'voice':
      return 'Voice message';
    case 'image':
      return 'Photo';
    default:
      return '';
  }
};

const directKey = (a: string, b: string): string => [a, b].sort().join(':');

export class ChatService {
  constructor(
    private readonly db: Db,
    private readonly uploads: UploadService,
    private readonly events: ChatEvents = noEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /* ------------------------------------------------------------------ conversations */

  /** Starts a chat. A direct chat between the same two people is the same chat every time (`created: false` after the first). */
  async create(userId: string, input: CreateConversationRequest): Promise<{ conversation: Conversation; created: boolean }> {
    if (input.kind === 'direct') return this.createDirect(userId, input.userId);
    const memberIds = [...new Set([userId, ...input.memberIds])];
    if (memberIds.length > MAX_GROUP_MEMBERS) throw errors.limitReached(`A group can have ${MAX_GROUP_MEMBERS} people`);
    await this.requireUsers(memberIds);
    const row = await this.db.conversation.create({
      data: {
        kind: 'GROUP',
        title: input.title,
        createdById: userId,
        members: { create: memberIds.map((id) => ({ userId: id, role: id === userId ? 'admin' : 'member' })) },
      },
      select: { id: true },
    });
    this.events.publish(memberIds, { type: 'conversation.updated', conversationId: row.id });
    return { conversation: await this.get(userId, row.id), created: true };
  }

  private async createDirect(userId: string, otherId: string): Promise<{ conversation: Conversation; created: boolean }> {
    if (otherId === userId) throw errors.validation({ userId: 'You cannot chat with yourself' });
    await this.requireUsers([otherId]);
    if (await this.blockedBetween(userId, otherId)) throw errors.forbidden('You cannot message this person');
    const key = directKey(userId, otherId);
    try {
      const row = await this.db.conversation.create({
        data: {
          kind: 'DIRECT',
          directKey: key,
          createdById: userId,
          members: { create: [{ userId }, { userId: otherId }] },
        },
        select: { id: true },
      });
      this.events.publish([userId, otherId], { type: 'conversation.updated', conversationId: row.id });
      return { conversation: await this.get(userId, row.id), created: true };
    } catch (e) {
      if (!isUniqueViolation(e, 'directKey')) throw e;
      const existing = await this.db.conversation.findUniqueOrThrow({ where: { directKey: key }, select: { id: true } });
      return { conversation: await this.get(userId, existing.id), created: false };
    }
  }

  async list(userId: string, limit: number, cursor?: string): Promise<Page<Conversation>> {
    const rows = await this.db.conversationMember.findMany({
      where: { userId },
      include: { conversation: { include: { members: { include: memberWith } } } },
      orderBy: [{ conversation: { lastMessageAt: { sort: 'desc', nulls: 'last' } } }, { conversationId: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { conversationId_userId: { conversationId: cursor, userId } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const lasts = page.length
      ? await this.db.message.findMany({
          where: { OR: page.filter((r) => r.conversation.lastSeq > 0).map((r) => ({ conversationId: r.conversationId, seq: r.conversation.lastSeq })) },
        })
      : [];
    const lastBy = new Map(lasts.map((m) => [m.conversationId, m]));
    return {
      items: page.map((r) => this.toConversation(userId, r.conversation, r, lastBy.get(r.conversationId) ?? null)),
      nextCursor: hasMore ? (page.at(-1)?.conversationId ?? null) : null,
    };
  }

  async get(userId: string, conversationId: string): Promise<Conversation> {
    const mine = await this.db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: { include: { members: { include: memberWith } } } },
    });
    if (!mine) throw errors.notFound('Conversation not found');
    const last = mine.conversation.lastSeq
      ? await this.db.message.findUnique({ where: { conversationId_seq: { conversationId, seq: mine.conversation.lastSeq } } })
      : null;
    return this.toConversation(userId, mine.conversation, mine, last);
  }

  async rename(userId: string, conversationId: string, title: string): Promise<Conversation> {
    await this.requireGroupAdmin(userId, conversationId);
    await this.db.conversation.update({ where: { id: conversationId }, data: { title } });
    await this.announceUpdate(conversationId);
    return this.get(userId, conversationId);
  }

  async setMuted(userId: string, conversationId: string, muted: boolean): Promise<void> {
    const { count } = await this.db.conversationMember.updateMany({ where: { conversationId, userId }, data: { muted } });
    if (count === 0) throw errors.notFound('Conversation not found');
  }

  async addMembers(userId: string, conversationId: string, userIds: string[]): Promise<Conversation> {
    await this.requireGroupAdmin(userId, conversationId);
    const ids = [...new Set(userIds)];
    await this.requireUsers(ids);
    const have = await this.db.conversationMember.count({ where: { conversationId } });
    const fresh = ids.length - (await this.db.conversationMember.count({ where: { conversationId, userId: { in: ids } } }));
    if (have + fresh > MAX_GROUP_MEMBERS) throw errors.limitReached(`A group can have ${MAX_GROUP_MEMBERS} people`);
    await this.db.conversationMember.createMany({ data: ids.map((id) => ({ conversationId, userId: id })), skipDuplicates: true });
    await this.announceUpdate(conversationId, ids);
    return this.get(userId, conversationId);
  }

  /** An admin removes someone, or anyone leaves. A group left without an admin promotes its longest-standing member. */
  async removeMember(userId: string, conversationId: string, target: string): Promise<void> {
    const me = await this.requireMember(userId, conversationId);
    const convo = await this.db.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { kind: true } });
    if (convo.kind === 'DIRECT') throw errors.validation({ conversation: 'You cannot leave a direct chat' });
    if (target !== userId && me.role !== 'admin') throw errors.forbidden('Only a group admin can remove people');
    const { count } = await this.db.conversationMember.deleteMany({ where: { conversationId, userId: target } });
    if (count === 0) throw errors.notFound('That person is not in the group');

    const left = await this.db.conversationMember.findMany({ where: { conversationId }, orderBy: { joinedAt: 'asc' } });
    if (left.length === 0) {
      await this.db.conversation.delete({ where: { id: conversationId } });
    } else if (!left.some((m) => m.role === 'admin')) {
      await this.db.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: (left[0] as { userId: string }).userId } },
        data: { role: 'admin' },
      });
    }
    this.events.publish([...left.map((m) => m.userId), target], { type: 'conversation.updated', conversationId });
  }

  /* ------------------------------------------------------------------ messages */

  /**
   * Catch-up and history. With `afterSeq` you get the messages after that number (oldest first). Otherwise you get the
   * latest ones, or the ones just before `beforeSeq`. Always oldest first within the page.
   */
  async messages(userId: string, conversationId: string, opts: { afterSeq?: number | undefined; beforeSeq?: number | undefined; limit: number }): Promise<MessagePage> {
    await this.requireMember(userId, conversationId);
    const ascending = opts.afterSeq !== undefined;
    const rows = await this.db.message.findMany({
      where: {
        conversationId,
        ...(opts.afterSeq !== undefined ? { seq: { gt: opts.afterSeq } } : opts.beforeSeq !== undefined ? { seq: { lt: opts.beforeSeq } } : {}),
      },
      include: withSender,
      orderBy: { seq: ascending ? 'asc' : 'desc' },
      take: opts.limit + 1,
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    if (!ascending) page.reverse();
    return { items: await this.render(userId, conversationId, page), hasMore };
  }

  /** Sends a message. Sending the same `clientId` again returns the stored message instead of a second one. */
  async send(userId: string, conversationId: string, input: SendMessageRequest): Promise<{ message: Message; created: boolean }> {
    const convo = await this.requireMember(userId, conversationId).then(() =>
      this.db.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { members: true } }),
    );
    if (convo.kind === 'DIRECT') {
      const other = convo.members.find((m) => m.userId !== userId);
      if (other && (await this.blockedBetween(userId, other.userId))) throw errors.forbidden('You cannot message this person');
    }

    const existing = await this.findByClientId(userId, input.clientId);
    if (existing) return { message: await this.renderOne(userId, existing), created: false };
    await this.checkBurst(userId);

    const { kind, body } = await this.bodyOf(userId, input);
    if (input.replyToId) {
      const target = await this.db.message.findFirst({ where: { id: input.replyToId, conversationId }, select: { id: true } });
      if (!target) throw errors.validation({ replyToId: 'That message is not in this conversation' });
    }

    let row: MessageRow;
    try {
      row = await this.db.$transaction(async (tx) => {
        // Handing out the next number locks the conversation row, so numbers are gapless and never repeat.
        const [next] = await tx.$queryRaw<{ lastSeq: number }[]>`
          UPDATE "Conversation" SET "lastSeq" = "lastSeq" + 1, "lastMessageAt" = ${this.now()}::timestamptz
          WHERE "id" = ${conversationId}::uuid RETURNING "lastSeq"`;
        const seq = (next as { lastSeq: number }).lastSeq;
        const created = await tx.message.create({
          data: { conversationId, seq, senderId: userId, clientId: input.clientId, kind, body: body as Prisma.InputJsonValue, replyToId: input.replyToId ?? null, createdAt: this.now() },
          include: withSender,
        });
        // The sender has seen their own message.
        await tx.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadSeq: seq, lastDeliveredSeq: seq },
        });
        return created;
      });
    } catch (e) {
      // Two copies of the same retry raced: the other one won, so return it.
      if (isUniqueViolation(e, 'clientId')) {
        const won = await this.findByClientId(userId, input.clientId);
        if (won) return { message: await this.renderOne(userId, won), created: false };
      }
      throw e;
    }

    const message = (await this.render(userId, conversationId, [row]))[0] as Message;
    const everyone = convo.members.map((m) => m.userId);
    this.events.publish(everyone, { type: 'message.new', message: { ...message, reactions: [], status: null } });
    return { message, created: true };
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string): Promise<void> {
    const me = await this.requireMember(userId, conversationId);
    const row = await this.db.message.findFirst({ where: { id: messageId, conversationId }, select: { senderId: true, deletedAt: true } });
    if (!row) throw errors.notFound('Message not found');
    if (row.senderId !== userId && me.role !== 'admin') throw errors.forbidden('You can only delete your own messages');
    if (row.deletedAt) return;
    await this.db.message.update({ where: { id: messageId }, data: { deletedAt: this.now(), body: {} } });
    await this.publishToMembers(conversationId, { type: 'message.deleted', conversationId, messageId });
  }

  /** Marks everything up to `seq` as seen (and delivered). Tells the other members, so the sender sees the tick. */
  async markRead(userId: string, conversationId: string, seq: number): Promise<void> {
    await this.advance(userId, conversationId, seq, true);
  }

  async markDelivered(userId: string, conversationId: string, seq: number): Promise<void> {
    await this.advance(userId, conversationId, seq, false);
  }

  private async advance(userId: string, conversationId: string, seq: number, read: boolean): Promise<void> {
    await this.requireMember(userId, conversationId);
    const [row] = await this.db.$queryRaw<{ delivered: number; read: number; moved: boolean }[]>`
      WITH c AS (SELECT LEAST(${seq}::int, "lastSeq") AS upto FROM "Conversation" WHERE "id" = ${conversationId}::uuid),
           old AS (SELECT "lastReadSeq" AS r, "lastDeliveredSeq" AS d FROM "ConversationMember" WHERE "conversationId" = ${conversationId}::uuid AND "userId" = ${userId}::uuid),
           upd AS (
             UPDATE "ConversationMember" m SET
               "lastDeliveredSeq" = GREATEST(m."lastDeliveredSeq", (SELECT upto FROM c)),
               "lastReadSeq" = CASE WHEN ${read} THEN GREATEST(m."lastReadSeq", (SELECT upto FROM c)) ELSE m."lastReadSeq" END
             WHERE m."conversationId" = ${conversationId}::uuid AND m."userId" = ${userId}::uuid
             RETURNING m."lastDeliveredSeq" AS d, m."lastReadSeq" AS r)
      SELECT upd.d AS delivered, upd.r AS read, (upd.d > (SELECT d FROM old) OR upd.r > (SELECT r FROM old)) AS moved FROM upd`;
    if (row?.moved) {
      await this.publishToMembers(conversationId, { type: 'receipt', conversationId, userId, delivered: row.delivered, ...(read ? { read: row.read } : {}) });
    }
  }

  async react(userId: string, conversationId: string, messageId: string, emoji: string, on: boolean): Promise<void> {
    await this.requireMember(userId, conversationId);
    const msg = await this.db.message.findFirst({ where: { id: messageId, conversationId, deletedAt: null }, select: { id: true } });
    if (!msg) throw errors.notFound('Message not found');
    const changed = on
      ? (await this.db.messageReaction.createMany({ data: [{ messageId, userId, emoji }], skipDuplicates: true })).count
      : (await this.db.messageReaction.deleteMany({ where: { messageId, userId, emoji } })).count;
    if (changed === 0) return;
    const count = await this.db.messageReaction.count({ where: { messageId, emoji } });
    await this.publishToMembers(conversationId, { type: 'reaction', conversationId, messageId, userId, emoji, active: on, count });
  }

  /* ------------------------------------------------------------------ blocks */

  async blockedBetween(a: string, b: string): Promise<boolean> {
    const hit = await this.db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } });
    return hit !== null;
  }

  async block(userId: string, target: string): Promise<void> {
    if (target === userId) throw errors.validation({ userId: 'You cannot block yourself' });
    await this.requireUsers([target]);
    await this.db.block.createMany({ data: [{ blockerId: userId, blockedId: target }], skipDuplicates: true });
  }

  async unblock(userId: string, target: string): Promise<void> {
    await this.db.block.deleteMany({ where: { blockerId: userId, blockedId: target } });
  }

  async listBlocked(userId: string): Promise<{ user: Participant; at: string }[]> {
    const rows = await this.db.block.findMany({ where: { blockerId: userId }, include: { blocked: { select: authorSelect } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return rows.map((r) => ({ user: toAuthor(r.blocked), at: r.createdAt.toISOString() }));
  }

  /* ------------------------------------------------------------------ helpers */

  private async requireMember(userId: string, conversationId: string) {
    const m = await this.db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
    if (!m) throw errors.notFound('Conversation not found');
    return m;
  }

  private async requireGroupAdmin(userId: string, conversationId: string): Promise<void> {
    const me = await this.requireMember(userId, conversationId);
    const convo = await this.db.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { kind: true } });
    if (convo.kind === 'DIRECT') throw errors.validation({ conversation: 'A direct chat has no group settings' });
    if (me.role !== 'admin') throw errors.forbidden('Only a group admin can do that');
  }

  private async requireUsers(ids: string[]): Promise<void> {
    const found = await this.db.user.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw errors.validation({ userId: 'One of those people does not exist' });
  }

  private async checkBurst(userId: string): Promise<void> {
    const recent = await this.db.message.count({ where: { senderId: userId, createdAt: { gte: new Date(this.now().getTime() - SEND_BURST_MS) } } });
    if (recent >= SEND_BURST) throw new AppError(429, 'rate_limited', 'You are sending messages too fast. Wait a moment');
  }

  private findByClientId(senderId: string, clientId: string) {
    return this.db.message.findUnique({ where: { senderId_clientId: { senderId, clientId } }, include: withSender });
  }

  /** Turns what the phone sent into what is stored; voice and photo messages must point at the sender's own finished upload. */
  private async bodyOf(userId: string, input: SendMessageRequest): Promise<{ kind: MessageKind; body: Record<string, unknown> }> {
    switch (input.kind) {
      case 'text':
        return { kind: 'text', body: { text: input.text } };
      case 'recipe-card':
        return { kind: 'recipe-card', body: { recipeId: input.recipeId ?? null, title: input.title, photoUrl: input.photoUrl ?? null, meta: input.meta } };
      case 'voice': {
        const url = await this.uploads.urlFor(userId, input.uploadId, 'voice');
        if (!url) throw errors.validation({ uploadId: 'Finish uploading the voice note first' });
        return { kind: 'voice', body: { url, durationSec: input.durationSec, waveform: input.waveform } };
      }
      case 'image': {
        const url = await this.uploads.urlFor(userId, input.uploadId, 'chat_image');
        if (!url) throw errors.validation({ uploadId: 'Finish uploading the photo first' });
        return { kind: 'image', body: { url, caption: input.caption ?? '' } };
      }
    }
  }

  private async publishToMembers(conversationId: string, event: Parameters<ChatEvents['publish']>[1]): Promise<void> {
    const members = await this.db.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    this.events.publish(members.map((m) => m.userId), event);
  }

  private async announceUpdate(conversationId: string, extra: string[] = []): Promise<void> {
    const members = await this.db.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    this.events.publish([...new Set([...members.map((m) => m.userId), ...extra])], { type: 'conversation.updated', conversationId });
  }

  private async renderOne(viewerId: string, row: MessageRow): Promise<Message> {
    return (await this.render(viewerId, row.conversationId, [row]))[0] as Message;
  }

  /** Adds reactions, reply snippets and delivery status, which depend on who is looking. */
  private async render(viewerId: string, conversationId: string, rows: MessageRow[]): Promise<Message[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const replyIds = rows.map((r) => r.replyToId).filter((x): x is string => x !== null);
    const [reactions, replies, members] = await Promise.all([
      this.db.messageReaction.groupBy({ by: ['messageId', 'emoji'], where: { messageId: { in: ids } }, _count: { _all: true } }),
      replyIds.length ? this.db.message.findMany({ where: { id: { in: replyIds } }, select: { id: true, senderId: true, kind: true, body: true, deletedAt: true } }) : [],
      this.db.conversationMember.findMany({ where: { conversationId }, select: { userId: true, lastReadSeq: true, lastDeliveredSeq: true } }),
    ]);
    const mine = new Set(
      (await this.db.messageReaction.findMany({ where: { messageId: { in: ids }, userId: viewerId }, select: { messageId: true, emoji: true } })).map((r) => `${r.messageId}|${r.emoji}`),
    );
    const replyBy = new Map(replies.map((r) => [r.id, r]));
    const others = members.filter((m) => m.userId !== viewerId);

    return rows.map((r): Message => {
      const deleted = r.deletedAt !== null;
      const body = (deleted ? {} : r.body) as Record<string, unknown>;
      const reply = r.replyToId ? replyBy.get(r.replyToId) : undefined;
      const status: Message['status'] =
        r.senderId !== viewerId
          ? null
          : others.length > 0 && others.every((m) => m.lastReadSeq >= r.seq)
            ? 'read'
            : others.length > 0 && others.every((m) => m.lastDeliveredSeq >= r.seq)
              ? 'delivered'
              : 'sent';
      const base = {
        id: r.id,
        conversationId: r.conversationId,
        seq: r.seq,
        sender: toAuthor(r.sender),
        clientId: r.clientId,
        createdAt: r.createdAt.toISOString(),
        deleted,
        replyTo: reply ? { id: reply.id, senderId: reply.senderId, preview: preview(reply.kind, reply.body as Record<string, unknown>, reply.deletedAt !== null) } : null,
        reactions: reactions
          .filter((x) => x.messageId === r.id)
          .map((x) => ({ emoji: x.emoji, count: x._count._all, mine: mine.has(`${r.id}|${x.emoji}`) }))
          .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji)),
        status,
      };
      switch (r.kind) {
        case 'recipe-card':
          return { ...base, kind: 'recipe-card', recipeId: (body['recipeId'] as string | null) ?? null, title: String(body['title'] ?? ''), photoUrl: (body['photoUrl'] as string | null) ?? null, meta: String(body['meta'] ?? '') };
        case 'voice':
          return { ...base, kind: 'voice', url: String(body['url'] ?? ''), durationSec: Number(body['durationSec'] ?? 0), waveform: (body['waveform'] as number[] | undefined) ?? [] };
        case 'image':
          return { ...base, kind: 'image', url: String(body['url'] ?? ''), caption: String(body['caption'] ?? '') };
        default:
          return { ...base, kind: 'text', text: String(body['text'] ?? '') };
      }
    });
  }

  private toConversation(
    viewerId: string,
    c: Prisma.ConversationGetPayload<{ include: { members: { include: typeof memberWith } } }>,
    mine: Pick<MemberRow, 'role' | 'muted' | 'lastReadSeq'>,
    last: { id: string; senderId: string; kind: string; body: Prisma.JsonValue; deletedAt: Date | null; createdAt: Date } | null,
  ): Conversation {
    const members = c.members.map((m) => toAuthor(m.user));
    const others = members.filter((m) => m.id !== viewerId);
    const direct = c.kind === 'DIRECT';
    return {
      id: c.id,
      kind: c.kind === 'DIRECT' ? 'direct' : c.kind === 'GROUP' ? 'group' : 'community',
      title: direct ? (others[0]?.displayName ?? 'Chat') : (c.title ?? others.map((o) => o.displayName).join(', ')),
      photoUrl: direct ? (others[0]?.photoUrl ?? null) : c.photoUrl,
      members,
      isAdmin: !direct && mine.role === 'admin',
      muted: mine.muted,
      unread: Math.max(0, c.lastSeq - mine.lastReadSeq),
      lastSeq: c.lastSeq,
      lastMessage: last
        ? { id: last.id, senderId: last.senderId, kind: last.kind as MessageKind, preview: preview(last.kind, last.body as Record<string, unknown>, last.deletedAt !== null), at: last.createdAt.toISOString() }
        : null,
      lastAt: c.lastMessageAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
