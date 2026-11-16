import { describe, expect, it } from 'vitest';
import { FetchError, checkUrl, isPublicAddress, resolveRedirects, safeGet, safeLookup } from '../src/imports/net';
import { FakeWeb } from './webHelpers';

describe('which addresses are the public internet', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '172.15.255.255', '2606:4700:4700::1111', '2a00:1450:4009:81f::200e'])('%s is public', (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    '10.0.0.1', '10.255.255.255', '127.0.0.1', '127.1.2.3', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '::ffff:10.0.0.1', '::ffff:127.0.0.1', '::ffff:169.254.169.254', '64:ff9b::a00:1',
  ])('%s is not', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it('refuses anything that is not an address at all', () => {
    for (const bad of ['', 'localhost', 'example.com', '999.1.1.1', '1.2.3', '0x7f.1', '2130706433']) expect(isPublicAddress(bad)).toBe(false);
  });
});

describe('which web addresses may be fetched', () => {
  it('accepts an ordinary https address', () => {
    expect(checkUrl('https://example.com/recipe?id=1').hostname).toBe('example.com');
    expect(checkUrl('https://example.com:443/x').hostname).toBe('example.com');
    expect(checkUrl('https://8.8.8.8/x').hostname).toBe('8.8.8.8');
  });

  it.each([
    ['http://example.com/', 'not https'],
    ['ftp://example.com/', 'not https'],
    ['file:///etc/passwd', 'a file'],
    ['https://user:pass@example.com/', 'a login in the address'],
    ['https://example.com:8080/', 'another port'],
    ['https://localhost/admin', 'localhost'],
    ['https://app.localhost/', 'a .localhost name'],
    ['https://printer.local/', 'a .local name'],
    ['https://metadata.internal/', 'a .internal name'],
    ['https://intranet/', 'a name with no dot'],
    ['https://127.0.0.1/', 'loopback'],
    ['https://169.254.169.254/latest/meta-data/', 'the cloud metadata address'],
    ['https://10.1.2.3/', 'a private address'],
    ['https://[::1]/', 'IPv6 loopback'],
    ['https://[fc00::1]/', 'IPv6 private'],
    ['https://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback'],
    ['not a url', 'not an address'],
  ])('refuses %s (%s)', (url) => {
    expect(() => checkUrl(url)).toThrowError(FetchError);
    try {
      checkUrl(url);
    } catch (e) {
      expect((e as FetchError).reason).toBe('blocked');
    }
  });
});

describe('looking names up at the moment of connecting', () => {
  const look = (host: string) =>
    new Promise<{ error: NodeJS.ErrnoException | null; address?: string }>((resolve) => {
      safeLookup(host, { all: false }, (error, address) => resolve({ error, address: address as string }));
    });

  it('refuses a name that points at this machine', async () => {
    const r = await look('localhost');
    expect(r.error).toBeInstanceOf(FetchError);
  });

  it('refuses an internal address given directly, and lets a public one through', async () => {
    expect((await look('127.0.0.1')).error).toBeInstanceOf(FetchError);
    expect((await look('169.254.169.254')).error).toBeInstanceOf(FetchError);
    const ok = await look('8.8.8.8');
    expect(ok.error).toBeNull();
    expect(ok.address).toBe('8.8.8.8');
  });
});

describe('fetching a page', () => {
  it('returns the text and the final address', async () => {
    const web = new FakeWeb().page('https://example.com/a', '<html>hello</html>');
    expect(await safeGet('https://example.com/a', {}, web.requester)).toEqual({ url: 'https://example.com/a', contentType: 'text/html; charset=utf-8', text: '<html>hello</html>' });
  });

  it('follows redirects, including relative ones, and checks every stop', async () => {
    const web = new FakeWeb()
      .redirect('https://example.com/short', '/long')
      .redirect('https://example.com/long', 'https://other.example.org/final', 301)
      .page('https://other.example.org/final', 'arrived');
    const got = await safeGet('https://example.com/short', {}, web.requester);
    expect(got.text).toBe('arrived');
    expect(got.url).toBe('https://other.example.org/final');
    expect(web.requested).toEqual(['https://example.com/short', 'https://example.com/long', 'https://other.example.org/final']);
  });

  it('refuses a redirect that leads somewhere internal, and does not fetch it', async () => {
    for (const to of ['https://169.254.169.254/latest/meta-data/', 'http://example.com/plain', 'https://localhost/admin', 'https://[::1]/', 'file:///etc/passwd', 'https://example.com:22/']) {
      const web = new FakeWeb().redirect('https://example.com/go', to);
      await expect(safeGet('https://example.com/go', {}, web.requester)).rejects.toMatchObject({ reason: 'blocked' });
      expect(web.requested).toEqual(['https://example.com/go']);
    }
  });

  it('gives up after too many redirects, or a redirect with nowhere to go', async () => {
    const loop = new FakeWeb().redirect('https://example.com/a', 'https://example.com/b').redirect('https://example.com/b', 'https://example.com/a');
    await expect(safeGet('https://example.com/a', { maxRedirects: 3 }, loop.requester)).rejects.toMatchObject({ reason: 'redirects' });
    const empty = new FakeWeb().redirect('https://example.com/a', '');
    await expect(safeGet('https://example.com/a', {}, empty.requester)).rejects.toMatchObject({ reason: 'redirects' });
  });

  it('refuses errors, pages of the wrong type, and pages that are too large', async () => {
    const web = new FakeWeb()
      .page('https://example.com/missing', 'gone', 404)
      .page('https://example.com/pic', 'xxxx', 200, 'image/png')
      .page('https://example.com/big', 'y'.repeat(50_000))
      .page('https://example.com/ok', 'fine');
    await expect(safeGet('https://example.com/missing', {}, web.requester)).rejects.toMatchObject({ reason: 'status', status: 404 });
    await expect(safeGet('https://example.com/pic', {}, web.requester)).rejects.toMatchObject({ reason: 'bad_type' });
    await expect(safeGet('https://example.com/big', { maxBytes: 10_000 }, web.requester)).rejects.toMatchObject({ reason: 'too_large' });
    await expect(safeGet('https://example.com/ok', { maxBytes: 10_000 }, web.requester)).resolves.toMatchObject({ text: 'fine' });
  });

  it('refuses a page whose declared size is already too large, without reading it', async () => {
    const requester = async () => ({
      status: 200,
      headers: { 'content-type': 'text/html', 'content-length': '99999999' },
      body: (async function* () {
        yield Buffer.from('never read in full');
      })(),
    });
    await expect(safeGet('https://example.com/huge', { maxBytes: 1_000_000 }, requester)).rejects.toMatchObject({ reason: 'too_large' });
  });

  it('finds where a short link ends up without reading the page there', async () => {
    const web = new FakeWeb()
      .redirect('https://vm.tiktok.com/ZMabc123/', 'https://www.tiktok.com/@chef/video/7234567890123456789?is_from_webapp=1', 301)
      .page('https://www.tiktok.com/@chef/video/7234567890123456789?is_from_webapp=1', '<html>big page</html>');
    expect(await resolveRedirects('https://vm.tiktok.com/ZMabc123/', {}, web.requester)).toBe('https://www.tiktok.com/@chef/video/7234567890123456789?is_from_webapp=1');
    await expect(resolveRedirects('http://vm.tiktok.com/x', {}, web.requester)).rejects.toMatchObject({ reason: 'blocked' });
  });
});
