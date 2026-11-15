import type { Config } from '../config';
import { presignUrl, signRequest, type Credentials } from './sigv4';

/** The file store, as the rest of the server sees it. Cloudflare R2 in production; an in-memory fake in tests. */
export interface Storage {
  /** A link the phone can PUT one file to. It must send exactly `headers`. */
  presignUpload(input: { key: string; contentType: string; expiresSeconds: number }): Promise<{ url: string; headers: Record<string, string> }>;
  /** Size and type of the stored file, or null if there is none. */
  head(key: string): Promise<{ size: number; contentType: string } | null>;
  /** The stored bytes, or null if there is no such file. For files the server itself has to read (frames for the AI). */
  read(key: string): Promise<Buffer | null>;
  /** Removes a file. Removing one that is already gone is not an error. */
  delete(key: string): Promise<void>;
  /** The address the file is served from once it exists. */
  publicUrl(key: string): string;
}

export interface S3Settings extends Credentials {
  /** https://<account>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  /** https://media.example.com (no trailing slash): the public address of the bucket. */
  publicUrl: string;
}

/** The store described by the S3_* settings, or null when they are not set (the config check makes it all or none). */
export function storageFromConfig(config: Config, now?: () => Date): S3Storage | null {
  if (!config.S3_ENDPOINT) return null;
  return new S3Storage(
    {
      endpoint: config.S3_ENDPOINT.replace(/\/+$/, ''),
      bucket: config.S3_BUCKET,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      region: config.S3_REGION,
      publicUrl: config.STORAGE_PUBLIC_URL.replace(/\/+$/, ''),
    },
    now,
  );
}

/** An S3-compatible bucket (Cloudflare R2), reached with plain `fetch` and SigV4. */
export class S3Storage implements Storage {
  constructor(
    private readonly settings: S3Settings,
    private readonly now: () => Date = () => new Date(),
    private readonly request: typeof fetch = fetch,
  ) {}

  private path(key: string): string {
    return `/${this.settings.bucket}/${key}`;
  }

  async presignUpload(input: { key: string; contentType: string; expiresSeconds: number }) {
    const headers = { 'Content-Type': input.contentType };
    const url = presignUrl({
      method: 'PUT',
      endpoint: this.settings.endpoint,
      path: this.path(input.key),
      headers,
      expiresSeconds: input.expiresSeconds,
      now: this.now(),
      credentials: this.settings,
    });
    return { url, headers };
  }

  async head(key: string) {
    const signed = signRequest({ method: 'HEAD', endpoint: this.settings.endpoint, path: this.path(key), now: this.now(), credentials: this.settings });
    const res = await this.request(signed.url, { method: 'HEAD', headers: signed.headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage HEAD failed with ${res.status}`);
    return { size: Number(res.headers.get('content-length') ?? 0), contentType: res.headers.get('content-type') ?? '' };
  }

  async read(key: string) {
    const signed = signRequest({ method: 'GET', endpoint: this.settings.endpoint, path: this.path(key), now: this.now(), credentials: this.settings });
    const res = await this.request(signed.url, { method: 'GET', headers: signed.headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage GET failed with ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string) {
    const signed = signRequest({ method: 'DELETE', endpoint: this.settings.endpoint, path: this.path(key), now: this.now(), credentials: this.settings });
    const res = await this.request(signed.url, { method: 'DELETE', headers: signed.headers });
    if (!res.ok && res.status !== 404) throw new Error(`storage DELETE failed with ${res.status}`);
  }

  publicUrl(key: string): string {
    return `${this.settings.publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}
