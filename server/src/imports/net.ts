import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import { BlockList, isIP } from 'node:net';
import https from 'node:https';

// Fetching a page a user pasted is the classic way to trick a server into reading its own network (the cloud
// metadata address, the database, an admin panel). Everything below exists to make that impossible: only https, only
// addresses on the public internet (checked at the moment of connecting, so a name that changes its answer cannot
// slip past), a few redirects, a size limit and a time limit.

const internal = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) internal.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  internal.addSubnet(net, bits, 'ipv6');
}

/** True for an address on the public internet. Anything private, local, reserved or unparseable is false. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // Node checks IPv4-mapped IPv6 addresses (::ffff:10.0.0.1) against the IPv4 ranges too.
  return !internal.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly reason: 'blocked' | 'too_large' | 'bad_type' | 'status' | 'network' | 'redirects',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/** Looks a name up and refuses it if any answer is an internal address. Used as the connection's own `lookup`. */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, verbatim: true })
    .then((answers) => {
      if (answers.length === 0 || answers.some((a) => !isPublicAddress(a.address))) {
        callback(new FetchError('that address is not on the public internet', 'blocked') as unknown as NodeJS.ErrnoException, '', 4);
        return;
      }
      if (options.all) callback(null, answers.map((a) => ({ address: a.address, family: a.family })) as never);
      else callback(null, (answers[0] as { address: string }).address, (answers[0] as { family: number }).family);
    })
    .catch((err: NodeJS.ErrnoException) => callback(err, '', 4));
};

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
}
/** One HTTP GET. Swapped for a fake in tests. */
export type Requester = (url: URL, options: { timeoutMs: number; headers: Record<string, string> }) => Promise<HttpResponse>;

export const httpsRequester: Requester = (url, { timeoutMs, headers }) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers, lookup: safeLookup, timeout: timeoutMs }, (res) => {
      resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res });
    });
    req.on('timeout', () => req.destroy(new FetchError('the page took too long', 'network')));
    req.on('error', (err) => reject(err instanceof FetchError ? err : new FetchError(`could not reach the page: ${err.message}`, 'network')));
    req.end();
  });

export interface GetOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Allowed content types. */
  accept?: RegExp;
  headers?: Record<string, string>;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const DEFAULT_ACCEPT = /^(text\/html|application\/xhtml\+xml|application\/json|application\/ld\+json|text\/plain)/i;

/** Checks that an address is something we are willing to fetch: https, no credentials, the standard port, a public host. */
export function checkUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError('that is not a web address', 'blocked');
  }
  if (url.protocol !== 'https:') throw new FetchError('only https addresses are fetched', 'blocked');
  if (url.username || url.password) throw new FetchError('addresses with a login are not fetched', 'blocked');
  if (url.port && url.port !== '443') throw new FetchError('only the standard port is used', 'blocked');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const singleLabelName = !host.includes('.') && isIP(host) === 0; // "intranet", "metadata": never a public site
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || singleLabelName) {
    throw new FetchError('that address is not on the public internet', 'blocked');
  }
  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new FetchError('that address is not on the public internet', 'blocked');
  return url;
}

/** Fetches a page as text, following a few redirects (each one checked again) and refusing anything large or odd. */
export async function safeGet(input: string, options: GetOptions = {}, requester: Requester = httpsRequester): Promise<{ url: string; contentType: string; text: string }> {
  const { maxBytes = 1_500_000, timeoutMs = 8_000, maxRedirects = 3, accept = DEFAULT_ACCEPT } = options;
  let url = checkUrl(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requester(url, {
      timeoutMs,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; enplaceBot/1.0)', accept: 'text/html,application/json;q=0.9,*/*;q=0.5', ...options.headers },
    });
    if (REDIRECTS.has(res.status)) {
      const location = res.headers['location'];
      if (typeof location !== 'string' || !location) throw new FetchError('a redirect without a destination', 'redirects');
      await drain(res.body);
      url = checkUrl(new URL(location, url));
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      await drain(res.body);
      throw new FetchError(`the page answered ${res.status}`, 'status', res.status);
    }
    const contentType = String(res.headers['content-type'] ?? '');
    if (!accept.test(contentType)) {
      await drain(res.body);
      throw new FetchError(`not a page we read (${contentType || 'unknown type'})`, 'bad_type');
    }
    const length = Number(res.headers['content-length'] ?? 0);
    if (length > maxBytes) {
      await drain(res.body);
      throw new FetchError('the page is too large', 'too_large');
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of res.body) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new FetchError('the page is too large', 'too_large');
      chunks.push(chunk);
    }
    return { url: url.toString(), contentType, text: Buffer.concat(chunks).toString('utf8') };
  }
  throw new FetchError('too many redirects', 'redirects');
}

/** Follows a short link's redirects (each checked) and returns where it ends up, without reading the page there. */
export async function resolveRedirects(input: string, options: Pick<GetOptions, 'timeoutMs' | 'maxRedirects'> = {}, requester: Requester = httpsRequester): Promise<string> {
  const { timeoutMs = 8_000, maxRedirects = 3 } = options;
  let url = checkUrl(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requester(url, { timeoutMs, headers: { 'user-agent': 'Mozilla/5.0 (compatible; enplaceBot/1.0)', accept: '*/*' } });
    await drain(res.body);
    if (!REDIRECTS.has(res.status)) return url.toString();
    const location = res.headers['location'];
    if (typeof location !== 'string' || !location) throw new FetchError('a redirect without a destination', 'redirects');
    url = checkUrl(new URL(location, url));
  }
  throw new FetchError('too many redirects', 'redirects');
}

/** Reads and drops a body we do not want, so the connection can end. Capped so a huge body cannot hold us up. */
async function drain(body: AsyncIterable<Uint8Array>): Promise<void> {
  let seen = 0;
  try {
    for await (const chunk of body) {
      seen += chunk.byteLength;
      if (seen > 65_536) break;
    }
  } catch {
    // ignore: we are discarding it anyway
  }
}
