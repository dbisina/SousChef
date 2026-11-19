import { cookieFromSetCookie, resolveTikTokVideo, videoUrlFromPage } from '@/lib/tiktokVideo';

const page = (video: Record<string, unknown> | undefined) =>
  `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({
    __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { desc: 'pasta', ...(video ? { video } : {}) } } } },
  })}</script></html>`;

describe('finding the video file in a TikTok page', () => {
  it('prefers playAddr, then downloadAddr, then the first bitrate', () => {
    expect(videoUrlFromPage(page({ playAddr: 'https://v16.tiktok.com/video/a', downloadAddr: 'https://v16.tiktok.com/video/b' }))).toBe('https://v16.tiktok.com/video/a');
    expect(videoUrlFromPage(page({ downloadAddr: 'https://v16.tiktok.com/video/b' }))).toBe('https://v16.tiktok.com/video/b');
    expect(videoUrlFromPage(page({ bitrateInfo: [{ PlayAddr: { UrlList: ['https://v19.tiktokcdn.com/c'] } }] }))).toBe('https://v19.tiktokcdn.com/c');
  });

  it('gives null for a page with no video, no JSON, broken JSON or a non-https address', () => {
    expect(videoUrlFromPage(page(undefined))).toBeNull();
    expect(videoUrlFromPage('<html>blocked</html>')).toBeNull();
    expect(videoUrlFromPage('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{oops</script>')).toBeNull();
    expect(videoUrlFromPage(page({ playAddr: 'http://v16.tiktok.com/video/a' }))).toBeNull();
  });
});

describe('the cookie TikTok hands out with the page', () => {
  it('keeps name=value pairs, drops attributes, and does not split an Expires date', () => {
    const header = 'tt_chain_token=abc==; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure, ttwid=1|xyz; Domain=.tiktok.com; HttpOnly';
    expect(cookieFromSetCookie(header)).toBe('tt_chain_token=abc==; ttwid=1|xyz');
    expect(cookieFromSetCookie(null)).toBe('');
    expect(cookieFromSetCookie('')).toBe('');
  });
});

describe('resolving a link on the phone', () => {
  const reply = (ok: boolean, html: string, setCookie: string | null): typeof fetch =>
    (async () => ({ ok, text: async () => html, headers: { get: (k: string) => (k.toLowerCase() === 'set-cookie' ? setCookie : null) } })) as unknown as typeof fetch;

  it('returns the video address and cookie', async () => {
    const found = await resolveTikTokVideo('https://www.tiktok.com/@a/video/1', reply(true, page({ playAddr: 'https://v16.tiktok.com/video/a' }), 'tt_chain_token=abc; Path=/'));
    expect(found).toEqual({ videoUrl: 'https://v16.tiktok.com/video/a', cookie: 'tt_chain_token=abc' });
  });

  it('returns the address alone when no cookie is readable, and null when the page is refused or has no video', async () => {
    expect(await resolveTikTokVideo('https://www.tiktok.com/@a/video/1', reply(true, page({ playAddr: 'https://v16.tiktok.com/video/a' }), null))).toEqual({ videoUrl: 'https://v16.tiktok.com/video/a' });
    expect(await resolveTikTokVideo('https://www.tiktok.com/@a/video/1', reply(false, '', null))).toBeNull();
    expect(await resolveTikTokVideo('https://www.tiktok.com/@a/video/1', reply(true, '<html></html>', null))).toBeNull();
  });
});
