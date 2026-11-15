import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts small JSON values with AES-256-GCM. Each value gets its own random nonce, and is bound to a label (the owner
 * and row it belongs to), so a database thief cannot move one person's reading onto another row without it failing to
 * open. Layout of what is stored: 1 version byte, 12 nonce bytes, 16 tag bytes, then the ciphertext.
 */
export class HealthCipher {
  private constructor(private readonly key: Buffer) {}

  /** Null when no key is set (health tracking is off). Throws if the key is the wrong size. */
  static fromBase64(value: string): HealthCipher | null {
    if (!value) return null;
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) throw new Error('HEALTH_DATA_KEY must be 32 bytes written as base64');
    return new HealthCipher(key);
  }

  seal(value: unknown, label: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(label));
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
  }

  /** Throws if the data was changed, belongs to another label, or was sealed with another key. */
  open<T>(data: Uint8Array, label: string): T {
    const buf = Buffer.from(data);
    if (buf.length < 1 + IV_BYTES + TAG_BYTES || buf[0] !== VERSION) throw new Error('unreadable health data');
    const iv = buf.subarray(1, 1 + IV_BYTES);
    const tag = buf.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(label));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(buf.subarray(1 + IV_BYTES + TAG_BYTES)), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }
}
