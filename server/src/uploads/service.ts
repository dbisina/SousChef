import { randomUUID } from 'node:crypto';
import { UPLOAD_RULES, type CreateUploadRequest, type Upload, type UploadPurpose, type UploadTicket } from '@shared';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db';
import { AppError, errors } from '../errors';
import type { Storage } from '../storage/storage';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** How long the upload link works. */
const LINK_SECONDS = 600;
/** Unfinished uploads older than this are removed by the sweep. */
const PENDING_TTL_MS = DAY_MS;
/** Per person: a stuck app cannot pile up half-finished uploads, and nobody can fill the bucket. */
const MAX_PENDING_PER_HOUR = 20;
const MAX_UPLOADS_PER_DAY = 200;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

export class UploadService {
  constructor(
    private readonly db: Db,
    /** Null when no file store is configured: every upload then answers "not set up". */
    private readonly storage: Storage | null,
    private readonly log: Pick<FastifyBaseLogger, 'warn'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private store(): Storage {
    if (!this.storage) throw new AppError(501, 'provider_not_configured', 'Uploads are not set up on this server');
    return this.storage;
  }

  /** Reserves an upload and returns the link the phone sends the file to. */
  async create(userId: string, input: CreateUploadRequest): Promise<UploadTicket> {
    const storage = this.store();
    const now = this.now();
    const [pending, today] = await Promise.all([
      this.db.upload.count({ where: { userId, status: 'PENDING', createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } }),
      this.db.upload.count({ where: { userId, status: { not: 'DELETED' }, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    ]);
    if (pending >= MAX_PENDING_PER_HOUR) throw errors.limitReached('Finish or cancel your earlier uploads first');
    if (today >= MAX_UPLOADS_PER_DAY) throw errors.limitReached('Too many uploads today. Try again tomorrow');

    const id = randomUUID();
    const key = `${input.purpose}/${userId}/${id}.${EXTENSIONS[input.contentType] ?? 'bin'}`;
    await this.db.upload.create({
      data: { id, userId, key, purpose: input.purpose, contentType: input.contentType, declaredSize: input.size, createdAt: now },
    });
    const link = await storage.presignUpload({ key, contentType: input.contentType, expiresSeconds: LINK_SECONDS });
    return {
      id,
      uploadUrl: link.url,
      headers: link.headers,
      publicUrl: storage.publicUrl(key),
      expiresAt: new Date(now.getTime() + LINK_SECONDS * 1000).toISOString(),
    };
  }

  /** Checks what actually arrived. Only a file that is the right type and no bigger than promised becomes READY. */
  async complete(userId: string, id: string): Promise<Upload> {
    const storage = this.store();
    const row = await this.db.upload.findFirst({ where: { id, userId, status: { not: 'DELETED' } } });
    if (!row) throw errors.notFound('Upload not found');
    const toUpload = (size: number): Upload => ({
      id: row.id,
      purpose: row.purpose as UploadPurpose,
      contentType: row.contentType,
      size,
      url: storage.publicUrl(row.key),
      status: 'ready',
    });
    if (row.status === 'READY') return toUpload(row.size ?? row.declaredSize);

    const stored = await storage.head(row.key);
    if (!stored) throw errors.validation({ upload: 'The file has not been uploaded yet' });
    const rule = UPLOAD_RULES[row.purpose as UploadPurpose];
    const problem =
      stored.size <= 0 || stored.size > row.declaredSize || stored.size > rule.maxBytes
        ? 'The file is bigger than it was said to be'
        : stored.contentType.split(';')[0]?.trim() !== row.contentType
          ? 'The file is not the type it was said to be'
          : null;
    if (problem) {
      await this.discard(row.id, row.key);
      throw errors.validation({ upload: problem });
    }
    await this.db.upload.update({ where: { id: row.id }, data: { status: 'READY', size: stored.size, readyAt: this.now() } });
    return toUpload(stored.size);
  }

  /** Removes an upload the person owns (a photo they changed their mind about). */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.db.upload.findFirst({ where: { id, userId, status: { not: 'DELETED' } }, select: { id: true, key: true } });
    if (!row) throw errors.notFound('Upload not found');
    await this.discard(row.id, row.key);
  }

  /** The address of a finished upload the person owns, or null. For other features that attach a photo or voice note. */
  async urlFor(userId: string, id: string, purpose?: UploadPurpose): Promise<string | null> {
    const row = await this.db.upload.findFirst({ where: { id, userId, status: 'READY', ...(purpose ? { purpose } : {}) }, select: { key: true } });
    return row ? this.store().publicUrl(row.key) : null;
  }

  /** Removes an upload on behalf of the system (a story that expired, content that was taken down). Never throws. */
  async discardById(id: string): Promise<void> {
    try {
      const row = await this.db.upload.findFirst({ where: { id, status: { not: 'DELETED' } }, select: { id: true, key: true } });
      if (row && this.storage) await this.discard(row.id, row.key);
    } catch (err) {
      this.log.warn({ err, id }, 'could not remove an upload');
    }
  }

  /** Where a finished upload of the right purpose lives in the file store, for features that read the file themselves. */
  async keyFor(userId: string, id: string, purpose: UploadPurpose): Promise<string | null> {
    const row = await this.db.upload.findFirst({ where: { id, userId, status: 'READY', purpose }, select: { key: true } });
    return row?.key ?? null;
  }

  /** The files of an account that is about to be deleted. */
  async keysFor(userId: string): Promise<string[]> {
    const rows = await this.db.upload.findMany({ where: { userId, status: { not: 'DELETED' } }, select: { key: true } });
    return rows.map((r) => r.key);
  }

  /** Removes files from the store; one that fails is logged and skipped, since the account is already gone. */
  async deleteKeys(keys: string[]): Promise<void> {
    if (!this.storage) return;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (err) {
        this.log.warn({ err, key }, 'could not delete a file of a deleted account');
      }
    }
  }

  /** Removes uploads that were never finished. Run from the job runner. Returns how many were removed. */
  async sweepExpired(): Promise<number> {
    if (!this.storage) return 0;
    const stale = await this.db.upload.findMany({
      where: { status: 'PENDING', createdAt: { lt: new Date(this.now().getTime() - PENDING_TTL_MS) } },
      select: { id: true, key: true },
      take: 500,
    });
    for (const row of stale) {
      try {
        await this.discard(row.id, row.key);
      } catch (err) {
        this.log.warn({ err, key: row.key }, 'could not remove an unfinished upload');
      }
    }
    return stale.length;
  }

  private async discard(id: string, key: string): Promise<void> {
    await this.store().delete(key);
    await this.db.upload.update({ where: { id }, data: { status: 'DELETED' } });
  }
}
