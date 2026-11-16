import { describe, expect, it } from 'vitest';
import { amzDate, encode, presignUrl, signRequest } from '../src/storage/sigv4';

// The expected signatures below were produced by the real AWS SDK v3 (@aws-sdk/s3-request-presigner) for exactly
// these inputs, so a match means the signer agrees with AWS, not just with itself.
const credentials = { accessKeyId: 'AKIDEXAMPLEKEY', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'auto' };
const endpoint = 'https://acct123.r2.cloudflarestorage.com';
const now = new Date('2026-11-15T12:00:00Z');

/** The extra query parameters the SDK adds (and signs). */
const sdkExtras = { 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD', 'x-id': 'PutObject', 'x-amz-sdk-checksum-algorithm': 'CRC32', 'x-amz-checksum-crc32': 'AAAAAA==' };

const signatureOf = (url: string) => new URL(url).searchParams.get('X-Amz-Signature');

describe('SigV4 presigned URLs', () => {
  it('matches the AWS SDK for a GET', () => {
    const url = presignUrl({
      method: 'GET', endpoint, path: '/souschef-media/x/y.png', expiresSeconds: 3600, now, credentials,
      extraQuery: { 'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD', 'x-amz-checksum-mode': 'ENABLED', 'x-id': 'GetObject' },
    });
    expect(signatureOf(url)).toBe('9f28d2a5af8b48eb8172b3381981852f5b16cfce4ac86eec99475e2e98b7cf81');
  });

  it('matches the AWS SDK for a PUT, including a key with spaces, plus signs and brackets', () => {
    const url = presignUrl({
      method: 'PUT', endpoint, path: '/souschef-media/recipe_image/u 1/a+b (1).jpg', expiresSeconds: 600, now, credentials, extraQuery: sdkExtras,
    });
    expect(signatureOf(url)).toBe('d173b24ef96aeb0a2de1db5ca0f9f0113334ccb0ed456e44cfce5678d63bbc87');
    expect(url).toContain('/souschef-media/recipe_image/u%201/a%2Bb%20%281%29.jpg?');
  });

  it('matches the AWS SDK when the Content-Type header is part of the signature', () => {
    const url = presignUrl({
      method: 'PUT', endpoint, path: '/souschef-media/voice/u1/n.m4a', headers: { 'Content-Type': 'audio/mp4' }, expiresSeconds: 600, now, credentials, extraQuery: sdkExtras,
    });
    expect(signatureOf(url)).toBe('66db1c2542a9b1e58b082e1e53975738598f5907ee41dc7bf6e49bf03def2055');
    expect(new URL(url).searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
  });

  it('changes when anything signed changes', () => {
    const base = { method: 'PUT' as const, endpoint, path: '/b/k.jpg', expiresSeconds: 600, now, credentials };
    const sig = signatureOf(presignUrl(base));
    expect(signatureOf(presignUrl({ ...base, path: '/b/other.jpg' }))).not.toBe(sig);
    expect(signatureOf(presignUrl({ ...base, expiresSeconds: 601 }))).not.toBe(sig);
    expect(signatureOf(presignUrl({ ...base, method: 'GET' }))).not.toBe(sig);
    expect(signatureOf(presignUrl({ ...base, now: new Date(now.getTime() + 1000) }))).not.toBe(sig);
    expect(signatureOf(presignUrl({ ...base, headers: { 'content-type': 'image/png' } }))).not.toBe(sig);
    expect(signatureOf(presignUrl({ ...base, credentials: { ...credentials, secretAccessKey: 'different' } }))).not.toBe(sig);
  });
});

describe('SigV4 helpers', () => {
  it('formats the date and encodes the way AWS wants', () => {
    expect(amzDate(now)).toBe('20261115T120000Z');
    expect(encode("a b/c+d!'()*~-_.")).toBe('a%20b%2Fc%2Bd%21%27%28%29%2A~-_.');
    expect(encode('a b/c', true)).toBe('a%20b/c');
  });

  it('signs a server-side request with an Authorization header and no secret in it', () => {
    const req = signRequest({ method: 'HEAD', endpoint, path: '/souschef-media/a b.jpg', now, credentials });
    expect(req.url).toBe('https://acct123.r2.cloudflarestorage.com/souschef-media/a%20b.jpg');
    expect(req.headers['x-amz-date']).toBe('20261115T120000Z');
    expect(req.headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLEKEY\/20261115\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(JSON.stringify(req)).not.toContain(credentials.secretAccessKey);
  });
});
