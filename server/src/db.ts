import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export type Db = PrismaClient;

export function createDb(connectionString: string, poolMax: number): Db {
  const adapter = new PrismaPg({ connectionString, max: poolMax });
  return new PrismaClient({ adapter });
}

/** True when a write failed because a unique column already holds the value (Prisma code P2002). */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || (error as { code: unknown }).code !== 'P2002') {
    return false;
  }
  if (!column) return true;
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) return target.includes(column);
  if (typeof target === 'string') return target.includes(column);
  // The pg driver adapter leaves `meta` empty; the constraint name (e.g. `User_handle_key`) is only in the message.
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && new RegExp(`_${column}_(key|idx)\\b`).test(message);
}
