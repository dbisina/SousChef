import type {
  Challenge,
  Community,
  CommunityEvent,
  CommunityMember,
  CommunityRole,
  CommunitySummary,
  CreateChallengeRequest,
  CreateCommunityRequest,
  CreateEventRequest,
  JoinCommunityResponse,
  Page,
  UpdateCommunityRequest,
} from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import { noEvents, type ChatEvents } from '../chat/events';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';
import type { UploadService } from '../uploads/service';

const MAX_COMMUNITIES_CREATED = 10;

type CommunityRow = Prisma.CommunityGetPayload<object>;
const asRole = (r: string): CommunityRole => (r === 'owner' || r === 'admin' ? r : 'member');

const toSummary = (c: CommunityRow): CommunitySummary => ({
  id: c.id,
  name: c.name,
  description: c.description,
  photoUrl: c.photoUrl,
  visibility: c.visibility === 'PRIVATE' ? 'private' : 'public',
  memberCount: c.memberCount,
  createdAt: c.createdAt.toISOString(),
});

export class CommunityService {
  constructor(
    private readonly db: Db,
    private readonly uploads: UploadService,
    private readonly events: ChatEvents = noEvents,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /* ------------------------------------------------------------------ communities */

  /** Makes a community. You become its owner and it gets a chat room with you in it. */
  async create(userId: string, input: CreateCommunityRequest): Promise<Community> {
    if ((await this.db.community.count({ where: { createdById: userId } })) >= MAX_COMMUNITIES_CREATED) {
      throw errors.limitReached(`You can start ${MAX_COMMUNITIES_CREATED} communities`);
    }
    const photoUrl = input.photoUploadId ? await this.photo(userId, input.photoUploadId) : null;
    const id = await this.db.$transaction(async (tx) => {
      const chat = await tx.conversation.create({
        data: { kind: 'COMMUNITY', title: input.name, photoUrl, createdById: userId, members: { create: [{ userId, role: 'admin' }] } },
        select: { id: true },
      });
      const community = await tx.community.create({
        data: {
          name: input.name,
          description: input.description ?? '',
          photoUrl,
          visibility: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
          memberCount: 1,
          createdById: userId,
          conversationId: chat.id,
          createdAt: this.now(),
          members: { create: [{ userId, role: 'owner', status: 'MEMBER' }] },
        },
        select: { id: true, conversationId: true },
      });
      return community;
    });
    this.events.publish([userId], { type: 'conversation.updated', conversationId: id.conversationId as string });
    return this.get(id.id, { userId, role: 'user' });
  }

  async get(id: string, viewer: Viewer | null): Promise<Community> {
    const row = await this.db.community.findUnique({ where: { id } });
    if (!row) throw errors.notFound('Community not found');
    const mine = viewer ? await this.membership(id, viewer.userId) : null;
    const insider = mine?.status === 'MEMBER' || viewer?.role === 'admin';
    return {
      ...toSummary(row),
      // The chat room is for members.
      conversationId: insider ? row.conversationId : null,
      viewer: mine ? { status: mine.status === 'MEMBER' ? 'member' : 'pending', role: asRole(mine.role) } : null,
    };
  }

  /** Public communities, and any you are in or have asked to join. Newest first, or by name when searching. */
  async list(viewer: Viewer | null, opts: { q?: string | undefined; limit: number; cursor?: string | undefined }): Promise<Page<CommunitySummary>> {
    const rows = await this.db.community.findMany({
      where: {
        OR: [{ visibility: 'PUBLIC' }, ...(viewer ? [{ members: { some: { userId: viewer.userId } } }] : [])],
        ...(opts.q ? { name: { contains: opts.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    return { items: page.map(toSummary), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  /** Communities you belong to. */
  async mine(userId: string): Promise<CommunitySummary[]> {
    const rows = await this.db.communityMember.findMany({
      where: { userId, status: 'MEMBER' },
      include: { community: true },
      orderBy: { joinedAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => toSummary(r.community));
  }

  async update(userId: string, role: Viewer['role'], id: string, input: UpdateCommunityRequest): Promise<Community> {
    await this.requireAdmin(id, userId, role);
    const data: Prisma.CommunityUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.visibility !== undefined) data.visibility = input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC';
    if (input.photoUploadId !== undefined) data.photoUrl = await this.photo(userId, input.photoUploadId);
    const row = await this.db.community.update({ where: { id }, data });
    if (row.conversationId && (input.name !== undefined || input.photoUploadId !== undefined)) {
      await this.db.conversation.update({ where: { id: row.conversationId }, data: { title: row.name, photoUrl: row.photoUrl } });
    }
    return this.get(id, { userId, role });
  }

  /** The owner (or staff) deletes it, with its chat room, posts, challenges and events. */
  async remove(userId: string, role: Viewer['role'], id: string): Promise<void> {
    const row = await this.db.community.findUnique({ where: { id }, select: { conversationId: true } });
    if (!row) throw errors.notFound('Community not found');
    const mine = await this.membership(id, userId);
    if (role !== 'admin' && mine?.role !== 'owner') throw errors.forbidden('Only the owner can delete a community');
    const members = await this.db.communityMember.findMany({ where: { communityId: id, status: 'MEMBER' }, select: { userId: true } });
    await this.db.$transaction(async (tx) => {
      await tx.community.delete({ where: { id } });
      if (row.conversationId) await tx.conversation.deleteMany({ where: { id: row.conversationId } });
    });
    if (row.conversationId) this.events.publish(members.map((m) => m.userId), { type: 'conversation.updated', conversationId: row.conversationId });
  }

  /* ------------------------------------------------------------------ membership */

  /** Joins a public community at once; asks to join a private one. Asking again changes nothing. */
  async join(userId: string, id: string): Promise<JoinCommunityResponse> {
    const row = await this.db.community.findUnique({ where: { id }, select: { visibility: true, conversationId: true } });
    if (!row) throw errors.notFound('Community not found');
    const existing = await this.membership(id, userId);
    if (existing) return { status: existing.status === 'MEMBER' ? 'member' : 'pending' };
    const open = row.visibility === 'PUBLIC';
    const { count } = await this.db.communityMember.createMany({
      data: [{ communityId: id, userId, status: open ? 'MEMBER' : 'PENDING', joinedAt: this.now() }],
      skipDuplicates: true,
    });
    if (count > 0 && open) await this.admit(id, userId, row.conversationId);
    return { status: open ? 'member' : 'pending' };
  }

  /** Leaves, or withdraws a request. The owner cannot leave: they delete the community instead. */
  async leave(userId: string, id: string): Promise<void> {
    const mine = await this.membership(id, userId);
    if (!mine) throw errors.notFound('You are not in this community');
    if (mine.role === 'owner') throw errors.validation({ community: 'The owner cannot leave. Delete the community instead' });
    await this.drop(id, userId, mine.status === 'MEMBER');
  }

  async members(viewer: Viewer, id: string, opts: { pending: boolean; limit: number; cursor?: string | undefined }): Promise<Page<CommunityMember>> {
    const row = await this.db.community.findUnique({ where: { id }, select: { visibility: true } });
    if (!row) throw errors.notFound('Community not found');
    const mine = await this.membership(id, viewer.userId);
    const insider = mine?.status === 'MEMBER' || viewer.role === 'admin';
    if (opts.pending) await this.requireAdmin(id, viewer.userId, viewer.role);
    else if (row.visibility === 'PRIVATE' && !insider) throw errors.notFound('Community not found');
    const rows = await this.db.communityMember.findMany({
      where: { communityId: id, status: opts.pending ? 'PENDING' : 'MEMBER' },
      include: { user: { select: authorSelect } },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { communityId_userId: { communityId: id, userId: opts.cursor } }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    return {
      items: page.map((r) => ({ user: toAuthor(r.user), role: asRole(r.role), status: r.status === 'MEMBER' ? 'member' : 'pending', joinedAt: r.joinedAt.toISOString() })),
      nextCursor: hasMore ? (page.at(-1)?.userId ?? null) : null,
    };
  }

  /** An admin lets in someone who asked to join. */
  async approve(viewer: Viewer, id: string, target: string): Promise<void> {
    await this.requireAdmin(id, viewer.userId, viewer.role);
    const pending = await this.db.communityMember.findFirst({ where: { communityId: id, userId: target, status: 'PENDING' } });
    if (!pending) throw errors.notFound('That person has not asked to join');
    const { count } = await this.db.communityMember.updateMany({ where: { communityId: id, userId: target, status: 'PENDING' }, data: { status: 'MEMBER', joinedAt: this.now() } });
    if (count > 0) {
      const row = await this.db.community.findUniqueOrThrow({ where: { id }, select: { conversationId: true } });
      await this.admit(id, target, row.conversationId);
    }
  }

  /** An admin removes a member or turns down a request. Admins cannot remove other admins; the owner cannot be removed. */
  async removeMember(viewer: Viewer, id: string, target: string): Promise<void> {
    const me = await this.requireAdmin(id, viewer.userId, viewer.role);
    const theirs = await this.membership(id, target);
    if (!theirs) throw errors.notFound('That person is not in this community');
    if (theirs.role === 'owner') throw errors.forbidden('The owner cannot be removed');
    if (theirs.role === 'admin' && me?.role !== 'owner' && viewer.role !== 'admin') throw errors.forbidden('Only the owner can remove an admin');
    await this.drop(id, target, theirs.status === 'MEMBER');
  }

  /** The owner promotes a member to admin or back. */
  async setRole(viewer: Viewer, id: string, target: string, role: 'admin' | 'member'): Promise<void> {
    const me = await this.membership(id, viewer.userId);
    if (me?.role !== 'owner' && viewer.role !== 'admin') throw errors.forbidden('Only the owner can change roles');
    const theirs = await this.membership(id, target);
    if (!theirs || theirs.status !== 'MEMBER') throw errors.notFound('That person is not a member');
    if (theirs.role === 'owner') throw errors.validation({ role: "The owner's role cannot change" });
    await this.db.communityMember.update({ where: { communityId_userId: { communityId: id, userId: target } }, data: { role } });
    const row = await this.db.community.findUnique({ where: { id }, select: { conversationId: true } });
    if (row?.conversationId) {
      await this.db.conversationMember.updateMany({ where: { conversationId: row.conversationId, userId: target }, data: { role: role === 'admin' ? 'admin' : 'member' } });
    }
  }

  /* ------------------------------------------------------------------ challenges and events */

  async createChallenge(viewer: Viewer, id: string, input: CreateChallengeRequest): Promise<Challenge> {
    await this.requireAdmin(id, viewer.userId, viewer.role);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= this.now()) throw errors.validation({ endsAt: 'The end must be in the future' });
    const photoUrl = input.photoUploadId ? await this.photo(viewer.userId, input.photoUploadId) : null;
    const row = await this.db.challenge.create({
      data: { communityId: id, title: input.title, description: input.description ?? '', photoUrl, endsAt, createdById: viewer.userId, createdAt: this.now() },
    });
    return this.toChallenge(row, 0);
  }

  /** Running challenges first (soonest to end), then ended ones, newest first. */
  async challenges(viewer: Viewer | null, id: string): Promise<Challenge[]> {
    await this.requireVisibleInside(viewer, id);
    const rows = await this.db.challenge.findMany({ where: { communityId: id }, include: { _count: { select: { entries: true } } }, orderBy: { endsAt: 'desc' }, take: 100 });
    const now = this.now();
    const items = rows.map((r) => this.toChallenge(r, r._count.entries));
    return [...items.filter((c) => c.endsAt > now.toISOString()).sort((a, b) => a.endsAt.localeCompare(b.endsAt)), ...items.filter((c) => c.endsAt <= now.toISOString())];
  }

  async deleteChallenge(viewer: Viewer, id: string, challengeId: string): Promise<void> {
    await this.requireAdmin(id, viewer.userId, viewer.role);
    const { count } = await this.db.challenge.deleteMany({ where: { id: challengeId, communityId: id } });
    if (count === 0) throw errors.notFound('Challenge not found');
  }

  async createEvent(viewer: Viewer, id: string, input: CreateEventRequest): Promise<CommunityEvent> {
    await this.requireAdmin(id, viewer.userId, viewer.role);
    const row = await this.db.communityEvent.create({
      data: { communityId: id, title: input.title, detail: input.detail ?? '', startsAt: new Date(input.startsAt), createdById: viewer.userId, createdAt: this.now() },
    });
    return { id: row.id, communityId: id, title: row.title, detail: row.detail, startsAt: row.startsAt.toISOString() };
  }

  /** Upcoming events, soonest first. */
  async upcomingEvents(viewer: Viewer | null, id: string): Promise<CommunityEvent[]> {
    await this.requireVisibleInside(viewer, id);
    const rows = await this.db.communityEvent.findMany({ where: { communityId: id, startsAt: { gte: this.now() } }, orderBy: { startsAt: 'asc' }, take: 100 });
    return rows.map((r) => ({ id: r.id, communityId: id, title: r.title, detail: r.detail, startsAt: r.startsAt.toISOString() }));
  }

  async deleteEvent(viewer: Viewer, id: string, eventId: string): Promise<void> {
    await this.requireAdmin(id, viewer.userId, viewer.role);
    const { count } = await this.db.communityEvent.deleteMany({ where: { id: eventId, communityId: id } });
    if (count === 0) throw errors.notFound('Event not found');
  }

  /* ------------------------------------------------------------------ helpers */

  private membership(communityId: string, userId: string) {
    return this.db.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
  }

  /** The caller's membership if they are an admin or owner of this community (or staff); otherwise a 403/404. */
  private async requireAdmin(communityId: string, userId: string, role: Viewer['role']) {
    if (!(await this.db.community.findUnique({ where: { id: communityId }, select: { id: true } }))) throw errors.notFound('Community not found');
    const mine = await this.membership(communityId, userId);
    const isAdmin = mine?.status === 'MEMBER' && (mine.role === 'owner' || mine.role === 'admin');
    if (!isAdmin && role !== 'admin') throw errors.forbidden('Only a community admin can do that');
    return mine;
  }

  /** Challenges and events of a private community are for its members. */
  private async requireVisibleInside(viewer: Viewer | null, id: string): Promise<void> {
    const row = await this.db.community.findUnique({ where: { id }, select: { visibility: true } });
    if (!row) throw errors.notFound('Community not found');
    if (row.visibility === 'PUBLIC') return;
    const mine = viewer ? await this.membership(id, viewer.userId) : null;
    if (mine?.status !== 'MEMBER' && viewer?.role !== 'admin') throw errors.notFound('Community not found');
  }

  private async photo(userId: string, uploadId: string): Promise<string> {
    const url = await this.uploads.urlFor(userId, uploadId, 'avatar');
    if (!url) throw errors.validation({ photoUploadId: 'Finish uploading the photo first' });
    return url;
  }

  /** A new member: counted, and let into the chat room. */
  private async admit(communityId: string, userId: string, conversationId: string | null): Promise<void> {
    await this.db.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
    if (conversationId) {
      await this.db.conversationMember.createMany({ data: [{ conversationId, userId }], skipDuplicates: true });
      this.events.publish([userId], { type: 'conversation.updated', conversationId });
    }
  }

  /** Removes a membership (or request) and, for a real member, the count and the chat room seat. */
  private async drop(communityId: string, userId: string, wasMember: boolean): Promise<void> {
    const { count } = await this.db.communityMember.deleteMany({ where: { communityId, userId } });
    if (count === 0 || !wasMember) return;
    const row = await this.db.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } }, select: { conversationId: true } });
    if (row.conversationId) {
      await this.db.conversationMember.deleteMany({ where: { conversationId: row.conversationId, userId } });
      this.events.publish([userId], { type: 'conversation.updated', conversationId: row.conversationId });
    }
  }

  private toChallenge(r: Prisma.ChallengeGetPayload<object>, entries: number): Challenge {
    return {
      id: r.id,
      communityId: r.communityId,
      title: r.title,
      description: r.description,
      photoUrl: r.photoUrl,
      endsAt: r.endsAt.toISOString(),
      entries,
      active: r.endsAt > this.now(),
    };
  }
}
