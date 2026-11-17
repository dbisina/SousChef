import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cutClip, type StepTime } from './clips';

/** A few pictures taken from a video, ready to hand to a model that can see. */
export interface VideoFrame {
  base64: string;
  mimeType: 'image/jpeg';
}

/** Downloads the video and takes pictures from it. Throws when the video cannot be fetched or read. */
export type VideoFrameSource = (url: string) => Promise<VideoFrame[] | WatchedVideo>;

export interface FrameOptions {
  /** yt-dlp, e.g. "yt-dlp". */
  ytDlp: string;
  /** ffmpeg, e.g. "ffmpeg". */
  ffmpeg: string;
  /** Optional outbound proxy for platforms that block data-centre addresses. */
  proxy?: string;
  /** A cookies file (Netscape format) from a logged-in account, for platforms that refuse anonymous downloads (Instagram). */
  cookiesFile?: string;
  /** How many pictures to take (spread evenly through the video). */
  frames?: number;
  timeoutMs?: number;
  /** Replaceable in tests. */
  run?: (bin: string, args: string[], timeoutMs: number) => Promise<{ stdout: string }>;
}

const exec = (bin: string, args: string[], timeoutMs: number) =>
  new Promise<{ stdout: string }>((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve({ stdout })));
  });

/** The seconds at which to take `count` pictures of a video `duration` seconds long: spread through the middle, not the very ends. */
export function frameTimes(duration: number, count: number): number[] {
  const length = Number.isFinite(duration) && duration > 0 ? duration : 60;
  const n = Math.max(1, Math.min(count, Math.floor(length)));
  return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * length * 10) / 10);
}

type Run = NonNullable<FrameOptions['run']>;

/** A video on disk that has been looked at: its pictures, when each was taken, and a way to cut clips from it. Call `release` when done. */
export interface WatchedVideo {
  frames: VideoFrame[];
  /** The second of the video each picture was taken at (same order as `frames`). */
  times: number[];
  duration: number;
  /** Silent clips for the given ranges (null where one could not be cut). */
  cut: (ranges: (StepTime | null)[]) => Promise<(Buffer | null)[]>;
  /** Deletes the downloaded copy. */
  release: () => Promise<void>;
}

/** What a frame source gives back: just pictures (older callers, tests) or a video that can also be cut. */
export type WatchedOrFrames = VideoFrame[] | WatchedVideo;

export const isWatched = (v: WatchedOrFrames): v is WatchedVideo => !Array.isArray(v);

async function download(url: string, options: FrameOptions, run: Run, timeoutMs: number): Promise<{ dir: string; video: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'frames-'));
  try {
    const file = path.join(dir, 'v.%(ext)s');
    await run(
      options.ytDlp,
      [
        '--no-warnings',
        '--no-playlist',
        '--socket-timeout',
        '15',
        '--max-filesize',
        '60M',
        // Pictures only (no sound is needed): small, but big enough that text on screen survives. Many sites serve picture
        // and sound separately, and a "combined" format does not exist for them.
        '-f',
        'bv*[height<=720][height>=360]/bv*[height>=360]/b/bv*',
        '-o',
        file,
        ...(options.proxy ? ['--proxy', options.proxy] : []),
        ...(options.cookiesFile ? ['--cookies', options.cookiesFile] : []),
        '--',
        url,
      ],
      timeoutMs,
    );
    const downloaded = (await readdir(dir)).find((n) => n.startsWith('v.'));
    if (!downloaded) throw new Error('the video could not be downloaded');
    return { dir, video: path.join(dir, downloaded) };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

/** Looks at a video file in `dir`: evenly spaced pictures plus what is needed to cut clips from it later. */
async function watchFile(dir: string, video: string, ffmpeg: string, count: number, run: Run): Promise<WatchedVideo> {
  const { frames, times, duration } = await takeFrames(dir, video, ffmpeg, count, run);
  return {
    frames,
    times,
    duration,
    cut: async (ranges) => {
      const out: (Buffer | null)[] = [];
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        out.push(range ? await cutClip(video, dir, `clip${i}.mp4`, range, ffmpeg, run) : null);
      }
      return out;
    },
    release: () => rm(dir, { recursive: true, force: true }).catch(() => undefined),
  };
}

/**
 * Watches a public video the way a person would: yt-dlp downloads a small copy (low resolution, capped size), ffmpeg takes
 * evenly spaced pictures and the copy is kept on disk until `release` is called, so clips can be cut from it.
 */
export function ytDlpWatch(options: FrameOptions): (url: string) => Promise<WatchedVideo> {
  const run = options.run ?? exec;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const count = options.frames ?? 8;
  return async (url) => {
    const { dir, video } = await download(url, options, run, timeoutMs);
    try {
      return await watchFile(dir, video, options.ffmpeg, count, run);
    } catch (err) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
  };
}

/** The same, but only the pictures: the copy is deleted straight away. */
export function ytDlpFrames(options: FrameOptions): (url: string) => Promise<VideoFrame[]> {
  const watch = ytDlpWatch(options);
  return async (url) => {
    const watched = await watch(url);
    await watched.release();
    return watched.frames;
  };
}

/** Pictures spread through a video file already on disk (in `dir`), taken with ffmpeg. */
async function takeFrames(dir: string, video: string, ffmpeg: string, count: number, run: Run): Promise<{ frames: VideoFrame[]; times: number[]; duration: number }> {
  let duration = 0;
  try {
    const probed = await run(ffmpeg, ['-hide_banner', '-i', video], 15_000).catch((e: { stderr?: string }) => ({ stdout: String(e.stderr ?? '') }));
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probed.stdout);
    if (m) duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  } catch {
    duration = 0;
  }
  const times = frameTimes(duration, count);
  for (let i = 0; i < times.length; i++) {
    await run(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(times[i]), '-i', video, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', path.join(dir, `f${String(i).padStart(2, '0')}.jpg`)],
      30_000,
    ).catch(() => undefined);
  }
  const names = (await readdir(dir)).filter((n) => /^f\d+\.jpg$/.test(n)).sort();
  const frames: VideoFrame[] = [];
  const taken: number[] = [];
  for (const n of names) {
    const bytes = await readFile(path.join(dir, n));
    if (bytes.byteLength > 5_000) {
      frames.push({ base64: bytes.toString('base64'), mimeType: 'image/jpeg' });
      taken.push(times[Number(n.slice(1, 3))] ?? 0);
    }
  }
  if (frames.length === 0) throw new Error('no pictures could be taken from the video');
  return { frames, times: taken, duration };
}

/** Pictures from video bytes the server already has (a copy the phone's own connection could fetch), kept for cutting until `release`. */
export async function watchBytes(bytes: Buffer, options: Pick<FrameOptions, 'ffmpeg' | 'frames' | 'run'>): Promise<WatchedVideo> {
  const dir = await mkdtemp(path.join(tmpdir(), 'frames-'));
  try {
    const video = path.join(dir, 'v.mp4');
    await writeFile(video, bytes);
    return await watchFile(dir, video, options.ffmpeg, options.frames ?? 8, options.run ?? exec);
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

/** Pictures from video bytes the server already has. */
export async function framesFromBytes(bytes: Buffer, options: Pick<FrameOptions, 'ffmpeg' | 'frames' | 'run'>): Promise<VideoFrame[]> {
  const watched = await watchBytes(bytes, options);
  await watched.release();
  return watched.frames;
}

/** Addresses a phone may hand over for the server to download: a video file on a platform's own video network, over https. */
const VIDEO_HOSTS = /(^|\.)(tiktok\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com|byteoversea\.com|ibytedtos\.com|muscdn\.com)$/i;
export const isAllowedVideoUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.username && !u.password && (u.port === '' || u.port === '443') && VIDEO_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
};

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

/**
 * Downloads a video the phone resolved (the address and the cookie the platform gave the phone). Only allowed video hosts,
 * https, a size cap and a time cap. Throws when refused or too large.
 */
export async function downloadVideo(url: string, cookie: string | undefined, request: typeof fetch = fetch): Promise<Buffer> {
  if (!isAllowedVideoUrl(url)) throw new Error('that video address is not allowed');
  const res = await request(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', referer: 'https://www.tiktok.com/', ...(cookie ? { cookie } : {}), range: 'bytes=0-' },
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`the video could not be downloaded (${res.status})`);
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_VIDEO_BYTES) throw new Error('the video is too large');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new Error('the video is too large');
  if (bytes.byteLength < 10_000) throw new Error('that is not a video');
  return bytes;
}
