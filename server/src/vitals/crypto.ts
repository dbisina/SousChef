import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER = 1 + IV_BYTES + TAG_BYTES;

const keyFrom = (value: string, name: string): Buffer => {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes written as base64`);
  return key;
};

/** Older keys, written "2:base64key,3:base64key". They are only used to open data, never to seal new data. */
export function parseOldKeys(value: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const part of value.split(',').map((p) => p.trim()).filter(Boolean)) {
    const at = part.indexOf(':');
    const id = Number(part.slice(0, at));
    if (at < 1 || !Number.isInteger(id) || id < 1 || id > 255) throw new Error('HEALTH_DATA_OLD_KEYS must look like "1:base64key,2:base64key" with ids from 1 to 255');
    out.set(id, part.slice(at + 1));
  }
  return out;
}

/**
 * Encrypts small JSON values with AES-256-GCM. Each value gets its own random nonce, and is bound to a label (the owner
 * and row it belongs to), so a database thief cannot move one person's reading onto another row without it failing to
 * open. Layout of what is stored: 1 byte naming the key, 12 nonce bytes, 16 tag bytes, then the ciphertext.
 *
 * Key rotation: new data is sealed with the current key (its id is the first byte). Older keys stay in the ring so old
 * data still opens until `VitalsService.reseal` has rewritten it; then the old key can be removed.
 */
export class HealthCipher {
  private constructor(
    private readonly keys: ReadonlyMap<number, Buffer>,
    readonly currentId: number,
  ) {}

  /** Null when no key is set (health tracking is off). Throws if the key is the wrong size. The key gets id 1. */
  static fromBase64(value: string): HealthCipher | null {
    return HealthCipher.fromKeys(value, 1, '');
  }

  /** The current key and its id, plus any older keys still needed to read old data. */
  static fromKeys(current: string, currentId: number, oldKeys: string): HealthCipher | null {
    if (!current) return null;
    if (!Number.isInteger(currentId) || currentId < 1 || currentId > 255) throw new Error('HEALTH_DATA_KEY_ID must be a whole number from 1 to 255');
    const ring = new Map<number, Buffer>();
    for (const [id, value] of parseOldKeys(oldKeys)) ring.set(id, keyFrom(value, `Old health key ${id}`));
    ring.set(currentId, keyFrom(current, 'HEALTH_DATA_KEY'));
    return new HealthCipher(ring, currentId);
  }

  /** Which key sealed this data (its first byte). */
  static keyIdOf(data: Uint8Array): number {
    return data[0] ?? 0;
  }

  seal(value: unknown, label: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.currentId) as Buffer, iv);
    cipher.setAAD(Buffer.from(label));
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([this.currentId]), iv, cipher.getAuthTag(), body]);
  }

  /** Throws if the data was changed, belongs to another label, or was sealed with a key that is not in the ring. */
  open<T>(data: Uint8Array, label: string): T {
    const buf = Buffer.from(data);
    const key = buf.length >= HEADER ? this.keys.get(buf[0] as number) : undefined;
    if (!key) throw new Error('unreadable health data');
    const iv = buf.subarray(1, 1 + IV_BYTES);
    const tag = buf.subarray(1 + IV_BYTES, HEADER);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(label));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(buf.subarray(HEADER)), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }

  /** Opens with whichever key sealed it and seals again with the current one. */
  reseal(data: Uint8Array, label: string): Buffer {
    return this.seal(this.open<unknown>(data, label), label);
  }
}
