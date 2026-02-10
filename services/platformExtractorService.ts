/**
 * Platform-specific content extraction service.
 *
 * For each supported platform (Instagram, YouTube, TikTok, X/Twitter, Threads,
 * generic websites) this module provides an extractor that returns a
 * standardised `PlatformContent` object containing:
 *   - captionText / pageText (text content)
 *   - videoUrl   (direct MP4 when available)
 *   - thumbnailUrl
 *   - title / author
 *   - jsonLd structured data (websites)
 *
 * Extractors are designed to be **fast** — they parallelise independent network
 * requests in every platform handler so the user never waits longer than needed.
 */

import { detectPlatform } from './recipeImportService';

// ────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────
export interface PlatformContent {
  platform: string;
  videoUrl?: string;       // Direct downloadable video URL (mp4)
  captionText?: string;    // Caption / description / transcript text
  thumbnailUrl?: string;   // Thumbnail / cover image URL
  title?: string;          // Post / video title
  author?: string;         // Creator / author name
  pageText?: string;       // Full scraped page text (websites)
  jsonLd?: string;         // Schema.org / JSON-LD structured data
  transcript?: string;     // YouTube transcript / captions text
}

// ────────────────────────────────────────────────────────
// Main dispatcher
// ────────────────────────────────────────────────────────
export async function extractPlatformContent(
  url: string,
  platform?: string,
): Promise<PlatformContent> {
  const p = platform || detectPlatform(url);

  switch (p) {
    case 'instagram':
      return extractInstagramContent(url);
    case 'youtube':
      return extractYouTubeContent(url);
    case 'tiktok':
      return extractTikTokContent(url);
    case 'x':
      return extractTwitterContent(url);
    case 'threads':
      return extractThreadsContent(url);
    case 'facebook':
      return extractFacebookContent(url);
    case 'pinterest':
      return extractPinterestContent(url);
    case 'reddit':
      return extractRedditContent(url);
    default:
      return extractGenericWebContent(url, p);
  }
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Safe JSON parse – never throws */
function safeParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Decode common HTML entities in attribute values */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Extract og:* / meta tags from raw HTML */
function extractOgTags(html: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const ogRegex =
    /<meta[^>]*(?:property|name)=["'](og:[^"']+|twitter:[^"']+|description)["'][^>]*content=["']([^"']*)["']/gi;
  const reverseRegex =
    /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](og:[^"']+|twitter:[^"']+|description)["']/gi;

  let m: RegExpExecArray | null;
  while ((m = ogRegex.exec(html)) !== null) tags[m[1]] = decodeHtmlEntities(m[2]);
  while ((m = reverseRegex.exec(html)) !== null) tags[m[2]] = decodeHtmlEntities(m[1]);

  // <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) tags['title'] = titleMatch[1].trim();

  return tags;
}

/** Strip HTML → plain text (fast) */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract JSON-LD blocks from HTML */
function extractJsonLd(html: string): string | undefined {
  const matches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!matches) return undefined;
  for (const block of matches) {
    const content = block
      .replace(/<script[^>]*>/, '')
      .replace(/<\/script>/i, '')
      .trim();
    const parsed = safeParse(content);
    if (parsed) {
      const str = JSON.stringify(parsed);
      if (/recipe|ingredient/i.test(str)) return str.slice(0, 8000);
    }
  }
  return undefined;
}

/** Fetch oEmbed data from noembed or platform-specific endpoints */
async function fetchOEmbed(
  url: string,
  platform: string,
): Promise<{ title?: string; author?: string; thumbnail?: string; description?: string } | null> {
  const endpoints: string[] = [];

  if (platform === 'youtube')
    endpoints.push(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  else if (platform === 'tiktok')
    endpoints.push(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  else if (platform === 'instagram')
    endpoints.push(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&omitscript=true`);

  // Universal fallback
  endpoints.push(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, { headers: { Accept: 'application/json' } });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.error) continue;
      return {
        title: d.title,
        author: d.author_name || d.author,
        thumbnail: d.thumbnail_url,
        description: d.description,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Safely fetch HTML from a URL */
async function fetchHtml(url: string, ua: string = MOBILE_UA): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    return r.text();
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────
// Instagram
// ────────────────────────────────────────────────────────
async function extractInstagramContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'instagram' };

  // Extract shortcode
  const scMatch = url.match(/\/(p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
  const shortcode = scMatch?.[2];
  const isReel = scMatch?.[1] === 'reel' || scMatch?.[1] === 'reels';

  // Run page fetch + oEmbed + embed/captioned in parallel for speed
  const [pageHtml, oembedData, embedHtml] = await Promise.all([
    fetchHtml(url, MOBILE_UA),
    fetchOEmbed(url, 'instagram'),
    shortcode
      ? fetchHtml(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, DESKTOP_UA)
      : Promise.resolve(null),
  ]);

  // oEmbed data
  if (oembedData) {
    result.title = oembedData.title;
    result.author = oembedData.author;
    result.thumbnailUrl = oembedData.thumbnail;
  }

  // Page HTML → og tags + video URL
  if (pageHtml) {
    const og = extractOgTags(pageHtml);
    if (!result.title && og['og:title']) result.title = og['og:title'];
    if (og['og:description']) result.captionText = og['og:description'];
    if (og['og:image'] && !result.thumbnailUrl) result.thumbnailUrl = og['og:image'];

    // Try to extract direct video URL
    const videoUrl =
      og['og:video'] ||
      og['og:video:secure_url'] ||
      og['twitter:player:stream'];
    if (videoUrl && videoUrl.includes('.mp4')) {
      result.videoUrl = videoUrl.replace(/&amp;/g, '&');
    }

    // Try to extract video from page JSON data
    if (!result.videoUrl) {
      const videoMatch =
        pageHtml.match(/"video_url"\s*:\s*"([^"]+)"/) ||
        pageHtml.match(/"video_versions"\s*:\s*\[.*?"url"\s*:\s*"([^"]+)"/);
      if (videoMatch?.[1]) {
        result.videoUrl = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      }
    }
  }

  // Embed/captioned page → get caption text (most reliable for caption)
  if (embedHtml) {
    const captionClean = htmlToText(embedHtml);
    if (captionClean.length > 50) {
      // The embed page often has the caption as the main text content
      result.captionText = captionClean.slice(0, 5000);
    }
  }

  // ── Fallback video extraction via proxy services (Instagram blocks direct scraping) ──
  if (!result.videoUrl && shortcode) {
    // Try ddinstagram (modified Instagram frontend that exposes video URLs)
    try {
      const ddHtml = await fetchHtml(
        `https://ddinstagram.com/reel/${shortcode}/`,
        DESKTOP_UA,
      );
      if (ddHtml) {
        // ddinstagram puts the video URL in og:video or a direct <video> tag
        const ddOg = extractOgTags(ddHtml);
        const ddVideo = ddOg['og:video'] || ddOg['og:video:secure_url'];
        if (ddVideo && (ddVideo.includes('.mp4') || ddVideo.includes('instagram'))) {
          result.videoUrl = ddVideo.replace(/&amp;/g, '&');
          console.log('Instagram video found via ddinstagram');
        }
        // Also grab a working thumbnail from ddinstagram
        if (!result.thumbnailUrl || result.thumbnailUrl.includes('cdninstagram.com')) {
          const ddThumb = ddOg['og:image'];
          if (ddThumb) result.thumbnailUrl = ddThumb;
        }
      }
    } catch {
      // ddinstagram unavailable — try next
    }

    // Try d.ddinstagram.com (direct media endpoint)
    if (!result.videoUrl) {
      try {
        const directUrl = `https://d.ddinstagram.com/reel/${shortcode}/`;
        const directResp = await fetch(directUrl, {
          method: 'HEAD',
          redirect: 'follow',
          headers: { 'User-Agent': MOBILE_UA },
        });
        const contentType = directResp.headers.get('content-type') || '';
        if (contentType.includes('video')) {
          result.videoUrl = directResp.url; // Final redirect URL is the video
          console.log('Instagram video found via d.ddinstagram direct');
        }
      } catch {
        // direct endpoint unavailable
      }
    }
  }

  // ── Fallback thumbnail: Use embed page's og:image if CDN thumbnail failed/absent ──
  if ((!result.thumbnailUrl || result.thumbnailUrl.includes('cdninstagram.com')) && embedHtml) {
    const embedOg = extractOgTags(embedHtml);
    if (embedOg['og:image']) {
      result.thumbnailUrl = embedOg['og:image'];
    }
  }

  // Last-resort thumbnail from shortcode
  if (!result.thumbnailUrl && shortcode) {
    result.thumbnailUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  }

  return result;
}

// ────────────────────────────────────────────────────────
// YouTube
// ────────────────────────────────────────────────────────
async function extractYouTubeContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'youtube' };

  // Extract video ID
  const idMatch =
    url.match(/(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  const videoId = idMatch?.[1];

  // Run oEmbed + page fetch in parallel
  const [oembedData, pageHtml] = await Promise.all([
    fetchOEmbed(url, 'youtube'),
    videoId
      ? fetchHtml(`https://www.youtube.com/watch?v=${videoId}`, DESKTOP_UA)
      : fetchHtml(url, DESKTOP_UA),
  ]);

  // oEmbed data
  if (oembedData) {
    result.title = oembedData.title;
    result.author = oembedData.author;
    result.thumbnailUrl = oembedData.thumbnail;
  }

  // High-res thumbnail
  if (videoId && !result.thumbnailUrl) {
    result.thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Parse page for description + caption tracks
  if (pageHtml) {
    // Extract description from ytInitialPlayerResponse
    const playerRespMatch = pageHtml.match(
      /var ytInitialPlayerResponse\s*=\s*({[\s\S]*?});\s*(?:var|<\/script)/,
    );
    if (playerRespMatch) {
      const playerData = safeParse(playerRespMatch[1]);
      if (playerData) {
        // Description
        const desc =
          playerData?.videoDetails?.shortDescription ||
          playerData?.microformat?.playerMicroformatRenderer?.description?.simpleText;
        if (desc) result.captionText = desc;

        // Caption tracks
        const captionTracks =
          playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (captionTracks?.length) {
          // Prefer English
          const enTrack =
            captionTracks.find((t: any) => t.languageCode === 'en') ||
            captionTracks.find((t: any) => /en/.test(t.languageCode)) ||
            captionTracks[0];
          if (enTrack?.baseUrl) {
            result.transcript = await fetchYouTubeTranscript(enTrack.baseUrl);
          }
        }
      }
    }

    // Fallback: try extracting description from ytInitialData
    if (!result.captionText) {
      const dataMatch = pageHtml.match(
        /var ytInitialData\s*=\s*({[\s\S]*?});\s*(?:var|<\/script|window)/,
      );
      if (dataMatch) {
        const data = safeParse(dataMatch[1]);
        if (data) {
          // Try to find description in engagement panel
          const descText = JSON.stringify(data).match(
            /"description"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]{20,})"/,
          );
          if (descText) {
            result.captionText = descText[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"');
          }
        }
      }
    }

    // og tags fallback
    if (!result.captionText || !result.title) {
      const og = extractOgTags(pageHtml);
      if (!result.title && og['og:title']) result.title = og['og:title'];
      if (!result.captionText && og['og:description'])
        result.captionText = og['og:description'];
    }
  }

  // If transcript is unavailable or too short, provide the lowest-resolution
  // muxed stream URL so recipeImportService can download it as a fallback.
  // Muxed formats (streamingData.formats) contain both audio + video, which is
  // critical for Gemini to hear the audio.
  const hasUsableTranscript = result.transcript && result.transcript.length > 50;

  if (!hasUsableTranscript && pageHtml) {
    const playerRespMatch2 = pageHtml.match(
      /var ytInitialPlayerResponse\s*=\s*({[\s\S]*?});\s*(?:var|<\/script)/,
    );
    const playerData2 = playerRespMatch2 ? safeParse(playerRespMatch2[1]) : null;
    const streamingData = playerData2?.streamingData;

    if (streamingData) {
      // Prefer muxed formats (have both audio + video)
      const muxedFormats: any[] = streamingData.formats || [];
      if (muxedFormats.length > 0) {
        // Sort by height (ascending) to pick the lowest resolution
        const sorted = [...muxedFormats]
          .filter((f: any) => f.url || f.signatureCipher)
          .sort((a: any, b: any) => (a.height || 9999) - (b.height || 9999));

        const lowest = sorted[0];
        if (lowest?.url) {
          result.videoUrl = lowest.url;
          console.log(
            `YouTube fallback: using ${lowest.height || '?'}p muxed stream (transcript unavailable)`,
          );
        }
      }
    }
  }

  return result;
}

/** Fetch and parse a YouTube transcript from a caption track base URL */
async function fetchYouTubeTranscript(baseUrl: string): Promise<string | undefined> {
  try {
    // Try JSON format first (json3)
    const jsonUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
    const resp = await fetch(jsonUrl);
    if (resp.ok) {
      const data = await resp.json();
      const text = data.events
        ?.filter((e: any) => e.segs)
        .map((e: any) =>
          e.segs
            .map((s: any) => s.utf8)
            .join('')
            .trim(),
        )
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text && text.length > 20) return text.slice(0, 15000);
    }

    // Fallback: XML format
    const xmlResp = await fetch(baseUrl);
    if (xmlResp.ok) {
      const xml = await xmlResp.text();
      const textParts = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
      if (textParts) {
        const text = textParts
          .map((t) =>
            t
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .trim(),
          )
          .filter(Boolean)
          .join(' ');
        if (text.length > 20) return text.slice(0, 15000);
      }
    }
  } catch (e) {
    console.log('YouTube transcript fetch failed:', e);
  }
  return undefined;
}

// ────────────────────────────────────────────────────────
// TikTok
// ────────────────────────────────────────────────────────
async function extractTikTokContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'tiktok' };

  // Run oEmbed + page fetch in parallel
  const [oembedData, pageHtml] = await Promise.all([
    fetchOEmbed(url, 'tiktok'),
    fetchHtml(url, MOBILE_UA),
  ]);

  // oEmbed
  if (oembedData) {
    result.title = oembedData.title;
    result.captionText = oembedData.title; // TikTok oEmbed title IS the caption
    result.author = oembedData.author;
    result.thumbnailUrl = oembedData.thumbnail;
  }

  // Parse page HTML for video URL + enhanced caption
  if (pageHtml) {
    const og = extractOgTags(pageHtml);
    if (!result.title && og['og:title']) result.title = og['og:title'];
    if (og['og:description'] && (!result.captionText || result.captionText.length < (og['og:description']?.length || 0))) {
      result.captionText = og['og:description'];
    }
    if (og['og:image'] && !result.thumbnailUrl) result.thumbnailUrl = og['og:image'];

    // Strategy 1: Extract from __UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalMatch = pageHtml.match(
      /<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i,
    );
    if (universalMatch) {
      const uData = safeParse(universalMatch[1]);
      if (uData) {
        const videoDetail =
          uData?.['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
        if (videoDetail) {
          if (videoDetail.video?.playAddr) {
            result.videoUrl = videoDetail.video.playAddr;
          } else if (videoDetail.video?.downloadAddr) {
            result.videoUrl = videoDetail.video.downloadAddr;
          }
          if (videoDetail.desc) result.captionText = videoDetail.desc;
          if (videoDetail.author?.nickname && !result.author)
            result.author = videoDetail.author.nickname;
        }
      }
    }

    // Strategy 2: Regex fallback for video URLs
    if (!result.videoUrl) {
      const playMatch =
        pageHtml.match(/"playAddr"\s*:\s*"([^"]+)"/) ||
        pageHtml.match(/"downloadAddr"\s*:\s*"([^"]+)"/) ||
        pageHtml.match(/<video[^>]*src=["']([^"']+)["']/i);
      if (playMatch) {
        result.videoUrl = playMatch[1]
          .replace(/\\u002F/g, '/')
          .replace(/\\u0026/g, '&')
          .replace(/\\/g, '');
      }
    }

    // Strategy 3: Try SIGI_STATE (older TikTok page format)
    if (!result.videoUrl) {
      const sigiMatch = pageHtml.match(
        /<script[^>]*id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/i,
      );
      if (sigiMatch) {
        const sigiData = safeParse(sigiMatch[1]);
        if (sigiData) {
          const items = sigiData?.ItemModule;
          if (items) {
            const firstKey = Object.keys(items)[0];
            const item = items[firstKey];
            if (item?.video?.playAddr) result.videoUrl = item.video.playAddr;
            if (item?.desc && !result.captionText) result.captionText = item.desc;
          }
        }
      }
    }
  }

  // Strategy 4: Try tikwm.com API as last resort for video URL
  if (!result.videoUrl) {
    try {
      const tikwmResp = await fetch(
        `https://tikwm.com/api/?url=${encodeURIComponent(url)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (tikwmResp.ok) {
        const tikwmData = await tikwmResp.json();
        if (tikwmData?.data?.play) {
          result.videoUrl = tikwmData.data.play;
          if (!result.captionText && tikwmData.data.title)
            result.captionText = tikwmData.data.title;
          if (!result.thumbnailUrl && tikwmData.data.cover)
            result.thumbnailUrl = tikwmData.data.cover;
          if (!result.author && tikwmData.data.author?.nickname)
            result.author = tikwmData.data.author.nickname;
        }
      }
    } catch {
      // tikwm unavailable — continue without video
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────
// X / Twitter
// ────────────────────────────────────────────────────────
async function extractTwitterContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'x' };

  // Strategy 1: fxtwitter API (most reliable for tweets + video URLs)
  const fxUrl = url.replace(/https?:\/\/(x|twitter)\.com/i, 'https://api.fxtwitter.com');
  // Strategy 2: vxtwitter API as fallback
  const vxUrl = url.replace(/https?:\/\/(x|twitter)\.com/i, 'https://api.vxtwitter.com');

  // Try fxtwitter first
  try {
    const resp = await fetch(fxUrl, { headers: { Accept: 'application/json' } });
    if (resp.ok) {
      const data = await resp.json();
      if (data.tweet) {
        const tweet = data.tweet;
        result.captionText = tweet.text;
        result.author = tweet.author?.name || tweet.author?.screen_name;
        result.title = tweet.author?.name
          ? `${tweet.author.name}'s post`
          : 'X Post';

        // Video URL
        if (tweet.media?.videos?.length) {
          // Get highest quality video
          const video = tweet.media.videos[0];
          result.videoUrl = video.url;
          result.thumbnailUrl = video.thumbnail_url || tweet.media?.photos?.[0]?.url;
        } else if (tweet.media?.photos?.length) {
          result.thumbnailUrl = tweet.media.photos[0].url;
        }

        return result; // Got everything from fxtwitter
      }
    }
  } catch {
    // fxtwitter failed, try vxtwitter
  }

  // Fallback: vxtwitter
  try {
    const resp = await fetch(vxUrl, { headers: { Accept: 'application/json' } });
    if (resp.ok) {
      const data = await resp.json();
      if (data.text) {
        result.captionText = data.text;
        result.author = data.user_name;
        result.title = data.user_name ? `${data.user_name}'s post` : 'X Post';
        if (data.mediaURLs?.length) {
          // Check for video in media_extended
          const videoMedia = data.media_extended?.find(
            (m: any) => m.type === 'video',
          );
          if (videoMedia?.url) {
            result.videoUrl = videoMedia.url;
            result.thumbnailUrl = videoMedia.thumbnail_url;
          } else {
            result.thumbnailUrl = data.mediaURLs[0];
          }
        }
        return result;
      }
    }
  } catch {
    // vxtwitter also failed
  }

  // Last resort: fetch page for og tags
  const html = await fetchHtml(url, DESKTOP_UA);
  if (html) {
    const og = extractOgTags(html);
    result.title = og['og:title'];
    result.captionText = og['og:description'];
    result.thumbnailUrl = og['og:image'];
    const ogVideo = og['og:video'] || og['twitter:player:stream'];
    if (ogVideo && ogVideo.includes('.mp4')) result.videoUrl = ogVideo;
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Threads
// ────────────────────────────────────────────────────────
async function extractThreadsContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'threads' };

  // Threads doesn't have a public API or oEmbed without auth.
  // Best effort: scrape the page with both UAs in parallel.
  const [mobileHtml, desktopHtml] = await Promise.all([
    fetchHtml(url, MOBILE_UA),
    fetchHtml(url, DESKTOP_UA),
  ]);

  const html = desktopHtml || mobileHtml;
  if (html) {
    const og = extractOgTags(html);
    result.title = og['og:title'] || og['title'];
    result.captionText = og['og:description'] || og['description'];
    result.thumbnailUrl = og['og:image'];

    // Try to get video URL
    const videoUrl = og['og:video'] || og['og:video:secure_url'];
    if (videoUrl && (videoUrl.includes('.mp4') || videoUrl.includes('video'))) {
      result.videoUrl = videoUrl.replace(/&amp;/g, '&');
    }

    // Extract text content from page body as fallback
    if (!result.captionText) {
      const bodyText = htmlToText(html);
      if (bodyText.length > 50) {
        result.captionText = bodyText.slice(0, 5000);
      }
    }

    // Try to find video in JSON data
    if (!result.videoUrl) {
      const videoMatch =
        html.match(/"video_url"\s*:\s*"([^"]+)"/) ||
        html.match(/"playback_url"\s*:\s*"([^"]+)"/);
      if (videoMatch?.[1]) {
        result.videoUrl = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      }
    }
  }

  // Fallback: try noembed
  if (!result.captionText) {
    const oembed = await fetchOEmbed(url, 'threads');
    if (oembed) {
      result.title = result.title || oembed.title;
      result.author = oembed.author;
      result.thumbnailUrl = result.thumbnailUrl || oembed.thumbnail;
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Facebook
// ────────────────────────────────────────────────────────
async function extractFacebookContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'facebook' };

  const html = await fetchHtml(url, DESKTOP_UA);
  if (html) {
    const og = extractOgTags(html);
    result.title = og['og:title'] || og['title'];
    result.captionText = og['og:description'];
    result.thumbnailUrl = og['og:image'];
    const videoUrl = og['og:video'] || og['og:video:secure_url'];
    if (videoUrl && videoUrl.includes('.mp4')) {
      result.videoUrl = videoUrl.replace(/&amp;/g, '&');
    }
  }

  const oembed = await fetchOEmbed(url, 'facebook');
  if (oembed) {
    result.title = result.title || oembed.title;
    result.author = oembed.author;
    result.thumbnailUrl = result.thumbnailUrl || oembed.thumbnail;
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Pinterest
// ────────────────────────────────────────────────────────
async function extractPinterestContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'pinterest' };

  const [html, oembed] = await Promise.all([
    fetchHtml(url, DESKTOP_UA),
    fetchOEmbed(url, 'pinterest'),
  ]);

  if (html) {
    const og = extractOgTags(html);
    result.title = og['og:title'] || og['title'];
    result.captionText = og['og:description'];
    result.thumbnailUrl = og['og:image'];
    result.jsonLd = extractJsonLd(html);

    // Pinterest often links to the source website
    const pageText = htmlToText(html);
    if (pageText.length > 100) result.pageText = pageText.slice(0, 10000);
  }

  if (oembed) {
    result.title = result.title || oembed.title;
    result.author = oembed.author;
    result.thumbnailUrl = result.thumbnailUrl || oembed.thumbnail;
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Reddit
// ────────────────────────────────────────────────────────
async function extractRedditContent(url: string): Promise<PlatformContent> {
  const result: PlatformContent = { platform: 'reddit' };

  // Reddit has a great JSON API
  try {
    const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json');
    const resp = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'SousChef/1.0' },
    });
    if (resp.ok) {
      const data = await resp.json();
      const post = data?.[0]?.data?.children?.[0]?.data;
      if (post) {
        result.title = post.title;
        result.author = post.author;
        result.captionText = post.selftext || post.title;
        result.thumbnailUrl =
          post.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') ||
          (post.thumbnail?.startsWith('http') ? post.thumbnail : undefined);

        // Check for linked media
        if (post.is_video && post.media?.reddit_video?.fallback_url) {
          result.videoUrl = post.media.reddit_video.fallback_url;
        }

        // Get top comments (often contain full recipes)
        const comments = data?.[1]?.data?.children?.slice(0, 5);
        if (comments?.length) {
          const commentTexts = comments
            .map((c: any) => c.data?.body)
            .filter(Boolean)
            .join('\n\n');
          if (commentTexts) {
            result.captionText =
              (result.captionText || '') + '\n\nCOMMENTS:\n' + commentTexts.slice(0, 5000);
          }
        }
      }
    }
  } catch {
    // JSON API failed, fall back to HTML
    const html = await fetchHtml(url, DESKTOP_UA);
    if (html) {
      const og = extractOgTags(html);
      result.title = og['og:title'];
      result.captionText = og['og:description'];
      result.thumbnailUrl = og['og:image'];
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Generic websites (recipe sites, blogs, etc.)
// ────────────────────────────────────────────────────────
async function extractGenericWebContent(
  url: string,
  platform: string,
): Promise<PlatformContent> {
  const result: PlatformContent = { platform };

  const html = await fetchHtml(url, DESKTOP_UA);
  if (!html) {
    // Try mobile UA if desktop failed
    const mobileHtml = await fetchHtml(url, MOBILE_UA);
    if (!mobileHtml) return result;
    return parseWebpageHtml(mobileHtml, result);
  }

  return parseWebpageHtml(html, result);
}

function parseWebpageHtml(html: string, result: PlatformContent): PlatformContent {
  // Extract structured data (most reliable for recipe sites)
  result.jsonLd = extractJsonLd(html);

  // Extract metadata
  const og = extractOgTags(html);
  result.title = og['og:title'] || og['title'];
  result.captionText = og['og:description'] || og['description'];
  result.thumbnailUrl = og['og:image'];

  // Video URL (some recipe sites have cooking videos)
  const videoUrl = og['og:video'] || og['og:video:secure_url'];
  if (videoUrl && videoUrl.includes('.mp4')) {
    result.videoUrl = videoUrl.replace(/&amp;/g, '&');
  }

  // Full page text
  const pageText = htmlToText(html);
  if (pageText.length > 100) {
    result.pageText = pageText.slice(0, 12000);
  }

  return result;
}
