import type { AdminReport, CreateReportRequest, Page, ReportAction, ReportReason, ReportStatus, ReportTarget } from '@shared';
import type { Prisma } from '../../generated/prisma/client';
import type { Viewer } from '../auth/viewer';
import type { ChatService } from '../chat/service';
import type { Db } from '../db';
import { errors } from '../errors';
import { authorSelect, toAuthor } from '../recipes/mappers';

/** Distinct people reporting the same post or story before it is taken down automatically (staff then review it). */
export const AUTO_HIDE_REPORTS = 3;

const statusOut: Record<string, ReportStatus> = { OPEN: 'open', ACTIONED: 'actioned', DISMISSED: 'dismissed' };
type Snapshot = NonNullable<AdminReport['target']>;
const key = (type: string, id: string) => `${type}:${id}`;
const withReporter = { reporter: { select: authorSelect } } satisfies Prisma.ReportInclude;
type ReportRow = Prisma.ReportGetPayload<{ include: typeof withReporter }>;

export class ReportService {
  constructor(
    private readonly db: Db,
    private readonly chat: ChatService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Reports something. Reporting the same thing twice counts once; you cannot report your own things. */
  async create(userId: string, input: CreateReportRequest): Promise<void> {
    const owner = await this.ownerOf(userId, input.targetType, input.targetId);
    if (owner === userId) throw errors.forbidden('You cannot report your own content');
    await this.db.report.createMany({
      data: [{ reporterId: userId, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details ?? '' }],
      skipDuplicates: true,
    });
    const reports = await this.db.report.count({ where: { targetType: input.targetType, targetId: input.targetId, status: 'OPEN' } });
    if (reports >= AUTO_HIDE_REPORTS) await this.takeDown(input.targetType, input.targetId);
  }

  /* ------------------------------------------------------------------ staff */

  async list(opts: { status?: ReportStatus | undefined; type?: ReportTarget | undefined; limit: number; cursor?: string | undefined }): Promise<Page<AdminReport>> {
    const rows = await this.db.report.findMany({
      where: {
        ...(opts.status ? { status: opts.status.toUpperCase() as 'OPEN' | 'ACTIONED' | 'DISMISSED' } : {}),
        ...(opts.type ? { targetType: opts.type } : {}),
      },
      include: withReporter,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > opts.limit;
    const page = rows.slice(0, opts.limit);
    return { items: await this.format(page), nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null };
  }

  /** Acts on a report and closes every open report about the same thing. */
  async resolve(reportId: string, staff: Viewer, action: ReportAction): Promise<AdminReport> {
    const report = await this.db.report.findUnique({ where: { id: reportId } });
    if (!report) throw errors.notFound('Report not found');
    const type = report.targetType as ReportTarget;

    if (action === 'hide') {
      if (type === 'user') throw errors.validation({ action: 'A person cannot be hidden; dismiss the report instead' });
      await this.takeDown(type, report.targetId);
    } else if (action === 'restore') {
      if (type !== 'post') throw errors.validation({ action: 'Only posts can be restored' });
      await this.db.post.updateMany({ where: { id: report.targetId, status: 'HIDDEN' }, data: { status: 'PUBLISHED' } });
    }
    await this.db.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: 'OPEN' },
      data: {
        status: action === 'dismiss' ? 'DISMISSED' : 'ACTIONED',
        resolution: { hide: 'hidden', restore: 'restored', dismiss: 'dismissed' }[action],
        resolvedById: staff.userId,
        resolvedAt: this.now(),
      },
    });
    const updated = await this.db.report.findUniqueOrThrow({ where: { id: reportId }, include: withReporter });
    return (await this.format([updated]))[0] as AdminReport;
  }

  /* ------------------------------------------------------------------ helpers */

  /** Adds how many people reported each thing, and a short description of the thing. */
  private async format(rows: ReportRow[]): Promise<AdminReport[]> {
    const pairs = [...new Map(rows.map((r) => [key(r.targetType, r.targetId), r])).values()];
    const counts = new Map(
      await Promise.all(pairs.map(async (r) => [key(r.targetType, r.targetId), await this.db.report.count({ where: { targetType: r.targetType, targetId: r.targetId } })] as const)),
    );
    const snapshots = await this.snapshots(pairs.map((r) => ({ type: r.targetType as ReportTarget, id: r.targetId })));
    return rows.map((r) => ({
      id: r.id,
      reporter: toAuthor(r.reporter),
      targetType: r.targetType as ReportTarget,
      targetId: r.targetId,
      reason: r.reason as ReportReason,
      details: r.details,
      status: statusOut[r.status] ?? 'open',
      resolution: r.resolution,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      reportCount: counts.get(key(r.targetType, r.targetId)) ?? 1,
      target: snapshots.get(key(r.targetType, r.targetId)) ?? null,
    }));
  }

  /** Who made the thing being reported. Not found (or not something this person may see) is a 404. */
  private async ownerOf(reporterId: string, type: ReportTarget, id: string): Promise<string> {
    switch (type) {
      case 'post': {
        const r = await this.db.post.findFirst({ where: { id, status: 'PUBLISHED' }, select: { authorId: true } });
        if (r) return r.authorId;
        break;
      }
      case 'comment': {
        const r = await this.db.postComment.findFirst({ where: { id, deletedAt: null }, select: { authorId: true } });
        if (r) return r.authorId;
        break;
      }
      case 'user': {
        const r = await this.db.user.findUnique({ where: { id }, select: { id: true } });
        if (r) return r.id;
        break;
      }
      case 'story': {
        const r = await this.db.story.findFirst({ where: { id, expiresAt: { gt: this.now() } }, select: { authorId: true } });
        if (r) return r.authorId;
        break;
      }
      case 'message': {
        // Only a message in a conversation you are in.
        const r = await this.db.message.findFirst({ where: { id, deletedAt: null, conversation: { members: { some: { userId: reporterId } } } }, select: { senderId: true } });
        if (r) return r.senderId;
        break;
      }
    }
    throw errors.notFound('That could not be found');
  }

  /** Takes something down. A person is never taken down here. */
  private async takeDown(type: ReportTarget, id: string): Promise<void> {
    switch (type) {
      case 'post':
        await this.db.post.updateMany({ where: { id, status: 'PUBLISHED' }, data: { status: 'HIDDEN' } });
        return;
      case 'comment':
        await this.db.postComment.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: this.now(), text: '', voiceUrl: null, voiceDurationSec: null } });
        return;
      case 'story':
        await this.db.story.updateMany({ where: { id, expiresAt: { gt: this.now() } }, data: { expiresAt: this.now() } });
        return;
      case 'message':
        await this.chat.removeAsStaff(id);
        return;
      case 'user':
        return;
    }
  }

  private async snapshots(targets: { type: ReportTarget; id: string }[]): Promise<Map<string, Snapshot>> {
    const out = new Map<string, Snapshot>();
    const ids = (type: ReportTarget) => targets.filter((t) => t.type === type).map((t) => t.id);
    const [posts, comments, users, stories, messages] = await Promise.all([
      this.db.post.findMany({ where: { id: { in: ids('post') } }, select: { id: true, title: true, authorId: true, status: true } }),
      this.db.postComment.findMany({ where: { id: { in: ids('comment') } }, select: { id: true, text: true, voiceUrl: true, authorId: true, deletedAt: true } }),
      this.db.user.findMany({ where: { id: { in: ids('user') } }, select: { id: true, handle: true, displayName: true } }),
      this.db.story.findMany({ where: { id: { in: ids('story') } }, select: { id: true, authorId: true, expiresAt: true } }),
      this.db.message.findMany({ where: { id: { in: ids('message') } }, select: { id: true, kind: true, body: true, senderId: true, deletedAt: true } }),
    ]);
    for (const p of posts) out.set(key('post', p.id), { summary: p.title, authorId: p.authorId, hidden: p.status === 'HIDDEN' });
    for (const c of comments) out.set(key('comment', c.id), { summary: c.text || (c.voiceUrl ? '(voice note)' : '(deleted)'), authorId: c.authorId, hidden: c.deletedAt !== null });
    for (const u of users) out.set(key('user', u.id), { summary: `@${u.handle} (${u.displayName})`, authorId: u.id, hidden: false });
    for (const s of stories) out.set(key('story', s.id), { summary: 'Story photo', authorId: s.authorId, hidden: s.expiresAt <= this.now() });
    for (const m of messages) {
      const body = m.body as Record<string, unknown>;
      out.set(key('message', m.id), { summary: m.kind === 'text' ? String(body['text'] ?? '').slice(0, 120) : `(${m.kind})`, authorId: m.senderId, hidden: m.deletedAt !== null });
    }
    return out;
  }
}
