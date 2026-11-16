import { createHash, createHmac } from 'node:crypto';

// AWS Signature Version 4, for the two things this server needs from an S3-compatible store (Cloudflare R2):
// a time-limited link a phone can upload to, and signed requests the server makes itself (HEAD, DELETE).
// Written against the public specification and checked against the AWS SDK's own output in the tests.

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const sha256Hex = (data: string): string => createHash('sha256').update(data, 'utf8').digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data, 'utf8').digest();

/** Percent-encoding as SigV4 wants it: everything except A-Z a-z 0-9 - _ . ~ ; and "/" is kept in paths. */
export function encode(value: string, keepSlash = false): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, keepSlash ? '/' : '%2F');
}

/** 20130524T000000Z */
export const amzDate = (d: Date): string => d.toISOString().replace(/[:-]|\.\d{3}/g, '');

function signingKey(secret: string, day: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => [encode(k), encode(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export interface PresignInput {
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  /** https://account.r2.cloudflarestorage.com (no trailing slash). */
  endpoint: string;
  /** Path after the host, starting with "/": /bucket/key (path-style). */
  path: string;
  /** Headers the caller must send exactly as given (besides host), e.g. content-type. They become part of the signature. */
  headers?: Record<string, string>;
  expiresSeconds: number;
  /** Further query parameters to sign and include (for example `response-content-disposition`). */
  extraQuery?: Record<string, string>;
  now: Date;
  credentials: Credentials;
}

/** A URL that allows exactly one kind of request to one object until it expires. */
export function presignUrl(input: PresignInput): string {
  const { endpoint, path, credentials: c } = input;
  const url = new URL(endpoint);
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const scope = `${day}/${c.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: url.host };
  for (const [k, v] of Object.entries(input.headers ?? {})) headers[k.toLowerCase()] = v.trim();
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');

  const query: Record<string, string> = {
    ...input.extraQuery,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${c.accessKeyId}/${scope}`,
    'X-Amz-Date': date,
    'X-Amz-Expires': String(input.expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalRequest = [
    input.method,
    encode(path, true),
    canonicalQuery(query),
    names.map((n) => `${n}:${headers[n]}\n`).join(''),
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(c.secretAccessKey, day, c.region), toSign).toString('hex');
  return `${url.origin}${encode(path, true)}?${canonicalQuery(query)}&X-Amz-Signature=${signature}`;
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/** Headers for a request the server sends itself (no body), signed with the Authorization header. */
export function signRequest(input: Omit<PresignInput, 'expiresSeconds' | 'headers'>): SignedRequest {
  const { endpoint, path, credentials: c } = input;
  const url = new URL(endpoint);
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const scope = `${day}/${c.region}/s3/aws4_request`;
  const payloadHash = sha256Hex('');
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalRequest = [input.method, encode(path, true), '', names.map((n) => `${n}:${headers[n]}\n`).join(''), signedHeaders, payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(c.secretAccessKey, day, c.region), toSign).toString('hex');
  return {
    url: `${url.origin}${encode(path, true)}`,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
      Authorization: `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}
