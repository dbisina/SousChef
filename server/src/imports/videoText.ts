import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Everything readable about a public video without watching it. */
export interface VideoText {
  title?: string;
  description?: string;
  author?: string;
  image?: string;
  /** Subtitles or auto-captions as plain text. */
  transcript?: string;
}

export type VideoTextSource = (url: string) => Promise<VideoText>;

export interface YtDlpOptions {
  /** The program, e.g. "yt-dlp". */
  bin: string;
  /** Optional outbound proxy for platforms that block data-centre addresses. */
  proxy?: string;
  /** A cookies file (Netscape format) from a logged-in account, for platforms that refuse anonymous reads (Instagram). */
  cookiesFile?: string;
  timeoutMs?: number;
  /** Replaceable in tests. */
  run?: (bin: string, args: string[], timeoutMs: number) => Promise<{ stdout: string }>;
  /** Replaceable in tests: reads the subtitle files yt-dlp wrote. */
  readSubs?: (dir: string) => Promise<string[]>;
}

const exec = (bin: string, args: string[], timeoutMs: number) =>
  new Promise<{ stdout: string }>((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve({ stdout })));
  });

const clip = (s: unknown, max: number): string | undefined => (typeof s === 'string' && s.trim() ? s.replace(/\s+\n/g, '\n').trim().slice(0, max) : undefined);

/** WebVTT or SRT to plain lines, with the timing, tags and the repeats that auto-captions are full of removed. */
export function captionsToText(raw: string): string {
  const out: string[] = [];
  let last = '';
  for (const line of raw.split(/\r?\n/)) {
    const t = line
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (!t || t === 'WEBVTT' || /^(Kind|Language|NOTE|STYLE)\b/.test(t) || /^\d+$/.test(t) || /-->/.test(t)) continue;
    if (t === last) continue;
    // Rolling auto-captions repeat the previous line as the start of the next one.
    if (last && t.startsWith(last)) out.pop();
    out.push(t);
    last = t;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** The caption, title and subtitles of a YouTube, TikTok or Instagram video, read with yt-dlp (no download). Throws on failure. */
export function ytDlpSource(options: YtDlpOptions): VideoTextSource {
  const run = options.run ?? exec;
  const timeoutMs = options.timeoutMs ?? 30_000;
  return async (url) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ytdlp-'));
    try {
      const args = [
        '--skip-download',
        '--no-warnings',
        '--no-playlist',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        'en.*,en',
        '--sub-format',
        'vtt/srt/best',
        '--dump-single-json',
        '--socket-timeout',
        '15',
        '-o',
        path.join(dir, 's.%(ext)s'),
        ...(options.proxy ? ['--proxy', options.proxy] : []),
        ...(options.cookiesFile ? ['--cookies', options.cookiesFile] : []),
        '--',
        url,
      ];
      const { stdout } = await run(options.bin, args, timeoutMs);
      const info = JSON.parse(stdout) as { title?: string; description?: string; uploader?: string; channel?: string; thumbnail?: string };
      const files = options.readSubs ? await options.readSubs(dir) : await readSubtitleFiles(dir);
      const transcript = files.map(captionsToText).sort((a, b) => b.length - a.length)[0];
      return {
        ...(clip(info.title, 500) ? { title: clip(info.title, 500) as string } : {}),
        ...(clip(info.description, 6000) ? { description: clip(info.description, 6000) as string } : {}),
        ...(clip(info.uploader ?? info.channel, 100) ? { author: clip(info.uploader ?? info.channel, 100) as string } : {}),
        ...(typeof info.thumbnail === 'string' && /^https?:\/\//.test(info.thumbnail) ? { image: info.thumbnail } : {}),
        ...(transcript ? { transcript: transcript.slice(0, 20_000) } : {}),
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}

async function readSubtitleFiles(dir: string): Promise<string[]> {
  const names = (await readdir(dir)).filter((n) => /\.(vtt|srt)$/i.test(n));
  return Promise.all(names.map((n) => readFile(path.join(dir, n), 'utf8')));
}

const decode = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\\n/g, '\n')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

/** The caption of an Instagram post or reel from its public embed page (`/p/<id>/embed/captioned/`). */
export function instagramCaptionFromEmbed(html: string): string | undefined {
  const block = /<div class="Caption"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="CaptionComments"|<\/div>)/i.exec(html)?.[1];
  if (block) {
    const text = decode(block.replace(/<br\s*\/?>/gi, '\n').replace(/<a [^>]*class="CaptionUsername"[^>]*>[\s\S]*?<\/a>/i, '').replace(/<[^>]+>/g, ''));
    if (text.trim().length > 20) return text.trim().slice(0, 6000);
  }
  const og = /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i.exec(html)?.[1];
  if (og) {
    // "123 likes, 4 comments - user on March 3, 2026: "the caption"."
    const m = /:\s*["“]([\s\S]*?)["”]\.?\s*$/.exec(decode(og));
    if (m?.[1] && m[1].length > 20) return m[1].trim().slice(0, 6000);
  }
  return undefined;
}

/** The description of a TikTok video from the JSON its web page carries. */
export function tiktokFromPage(html: string): { description?: string; author?: string; image?: string } {
  const json = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!json) return {};
  try {
    const data = JSON.parse(json) as { __DEFAULT_SCOPE__?: { 'webapp.video-detail'?: { itemInfo?: { itemStruct?: { desc?: string; author?: { nickname?: string; uniqueId?: string }; video?: { cover?: string } } } } } };
    const item = data.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    return {
      ...(clip(item?.desc, 6000) ? { description: clip(item?.desc, 6000) as string } : {}),
      ...(clip(item?.author?.nickname ?? item?.author?.uniqueId, 100) ? { author: clip(item?.author?.nickname ?? item?.author?.uniqueId, 100) as string } : {}),
      ...(typeof item?.video?.cover === 'string' && /^https?:\/\//.test(item.video.cover) ? { image: item.video.cover } : {}),
    };
  } catch {
    return {};
  }
}
