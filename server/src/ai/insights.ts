import type { Prisma } from '../../generated/prisma/client';
import type { Db } from '../db';

/** Remembers AI answers so asking the same thing again is free and instant. */
export class InsightCache {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get<T>(userId: string, kind: string, key: string): Promise<T | null> {
    const row = await this.db.aiInsight.findUnique({ where: { userId_kind_key: { userId, kind, key } } });
    return row ? (row.payload as T) : null;
  }

  async put(userId: string, kind: string, key: string, payload: unknown): Promise<void> {
    const data = payload as Prisma.InputJsonValue;
    await this.db.aiInsight.upsert({
      where: { userId_kind_key: { userId, kind, key } },
      create: { userId, kind, key, payload: data, createdAt: this.now() },
      update: { payload: data, createdAt: this.now() },
    });
  }

  /** The cached answer if there is one, otherwise work it out, keep it and return it. */
  async remember<T>(userId: string, kind: string, key: string, compute: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const hit = await this.get<T>(userId, kind, key);
    if (hit !== null) return { value: hit, cached: true };
    const value = await compute();
    await this.put(userId, kind, key, value);
    return { value, cached: false };
  }
}
