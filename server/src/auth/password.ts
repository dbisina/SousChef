import { hash, verify } from '@node-rs/argon2';

// Argon2id at the OWASP minimum: 19 MiB of memory, 2 passes, 1 lane. Each hash briefly holds that much memory, so the
// number running at once is capped; a burst of sign-ins queues instead of using up the server's memory.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const MAX_CONCURRENT = 2;

let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

export const hashPassword = (password: string): Promise<string> => limited(() => hash(password, OPTIONS));

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await limited(() => verify(passwordHash, password));
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;

/**
 * Spends the same time as a real check when the email is unknown, so response time does not reveal
 * whether an account exists.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummy ??= hashPassword('not-a-real-password');
  await verifyPassword(await dummy, password);
}
