/**
 * TikTok refuses the server's address, but not a phone's. The phone opens the video's public page the way a browser does,
 * reads the video file's own address out of it, and gives that address (and the cookie TikTok handed out with the page) to the
 * server, which downloads that one file and reads the recipe from it.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface PhoneVideo {
  videoUrl: string;
  cookie?: string;
}

/** The video file's address in a TikTok page's embedded JSON, or null when the page has none (private, removed, blocked). */
export function videoUrlFromPage(html: string): string | null {
  const json = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!json) return null;
  try {
    const data = JSON.parse(json) as {
      __DEFAULT_SCOPE__?: { 'webapp.video-detail'?: { itemInfo?: { itemStruct?: { video?: { playAddr?: string; downloadAddr?: string; bitrateInfo?: { PlayAddr?: { UrlList?: string[] } }[] } } } } };
    };
    const v = data.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct?.video;
    const found = v?.playAddr || v?.downloadAddr || v?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];
    return typeof found === 'string' && /^https:\/\//i.test(found) ? found : null;
  } catch {
    return null;
  }
}

/** `name=value` pairs from Set-Cookie header text (several cookies may arrive joined with commas), without their attributes. */
export function cookieFromSetCookie(header: string | null | undefined): string {
  if (!header) return '';
  const pairs: string[] = [];
  // Split on commas that start a new cookie ("a=1; Path=/, b=2"), not on the commas inside an Expires date.
  for (const part of header.split(/,(?=\s*[A-Za-z0-9_.-]+=)/)) {
    const pair = part.trim().split(';')[0]?.trim();
    if (pair && pair.includes('=')) pairs.push(pair);
  }
  return pairs.join('; ');
}

/** Resolves a TikTok link to the video file's address on this phone's own connection. Null when the page gives none. */
export async function resolveTikTokVideo(url: string, request: typeof fetch = fetch): Promise<PhoneVideo | null> {
  const res = await request(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' });
  if (!res.ok) return null;
  const videoUrl = videoUrlFromPage(await res.text());
  if (!videoUrl) return null;
  const cookie = cookieFromSetCookie(res.headers.get('set-cookie'));
  return { videoUrl, ...(cookie ? { cookie } : {}) };
}
