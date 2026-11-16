import { createHash } from 'node:crypto';
import type { Db } from '../db';
import { errors } from '../errors';
import type { ImageGenerator } from '../ai/imageGen';
import type { Storage } from '../storage/storage';
import type { EntitlementService } from '../subscriptions/service';

/** What to draw for a cooking step. The same step text always gives the same prompt, so one picture serves every game. */
export function stepImagePrompt(step: string, basket: string[]): string {
  return `Overhead food photograph that shows this single cooking step being done: "${step}". Show only the ingredients and tools the step needs (the kitchen ingredients available are ${basket.join(', ')}), on a wooden board, natural window light, realistic and appetising. No text, no letters, no logos, no people or faces.`;
}

export const stepImageHash = (step: string): string => createHash('sha1').update(step.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).digest('hex');

/**
 * Pictures of Mystery Kitchen cooking steps, made by an image model on demand. Pictures cost money, so: paid plans only,
 * a daily cap per person, one picture kept and shared for every game that has the same step, and nothing is made when no
 * image service is set up (or it is out of quota).
 */
export class StepImageService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage | null,
    private readonly generate: ImageGenerator | null,
    private readonly entitlements: EntitlementService,
    private readonly now: () => Date = () => new Date(),
    private readonly dailyCap = 30,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Is the picture feature running on this server at all? */
  get available(): boolean {
    return this.generate !== null && this.storage !== null;
  }

  /** The picture for step `n` of the game this person is in. */
  async forStep(userId: string, code: string, n: number): Promise<{ url: string }> {
    const tier = (await this.entitlements.forUser(userId)).tier;
    if (tier === 'free') throw errors.upgradeRequired('premium');

    const room = await this.db.gameRoom.findFirst({ where: { code, players: { some: { userId } }, phase: { in: ['cooking', 'done'] } }, orderBy: { createdAt: 'desc' } });
    if (!room) throw errors.notFound('There is no game with that code');
    const step = room.steps[n];
    if (!step) throw errors.notFound('There is no such step');

    const hash = stepImageHash(step);
    const kept = await this.db.stepImage.findUnique({ where: { hash } });
    if (kept) return { url: kept.url };

    if (!this.generate || !this.storage) throw errors.aiUnavailable('Step pictures are not available right now');

    // The daily cap counts pictures made for this person, not ones that were already kept.
    const day = this.now().toISOString().slice(0, 10);
    const used = await this.db.stepImageUse.findUnique({ where: { userId_day: { userId, day } } });
    if ((used?.count ?? 0) >= this.dailyCap) throw errors.limitReached('You have used today\'s step pictures. They come back tomorrow');

    let picture;
    try {
      picture = await this.generate(stepImagePrompt(step, room.basket));
    } catch {
      throw errors.aiUnavailable('Step pictures are not available right now');
    }
    const key = `step/${hash}.${picture.mime.includes('png') ? 'png' : 'jpg'}`;
    const signed = await this.storage.presignUpload({ key, contentType: picture.mime, expiresSeconds: 600 });
    const put = await this.fetchImpl(signed.url, { method: 'PUT', headers: signed.headers, body: new Uint8Array(picture.bytes) });
    if (!put.ok) throw errors.aiUnavailable('Step pictures are not available right now');
    const url = this.storage.publicUrl(key);
    await this.db.stepImage.upsert({ where: { hash }, create: { hash, url }, update: { url } });
    await this.db.stepImageUse.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, count: 1 }, update: { count: { increment: 1 } } });
    return { url };
  }
}
