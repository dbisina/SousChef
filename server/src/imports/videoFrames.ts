import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** A few pictures taken from a video, ready to hand to a model that can see. */
export interface VideoFrame {
  base64: string;
  mimeType: 'image/jpeg';
}

/** Downloads the video and takes pictures from it. Throws when the video cannot be fetched or read. */
export type VideoFrameSource = (url: string) => Promise<VideoFrame[]>;

export interface FrameOptions {
  /** yt-dlp, e.g. "yt-dlp". */
  ytDlp: string;
  /** ffmpeg, e.g. "ffmpeg". */
  ffmpeg: string;
  /** Optional outbound proxy for platforms that block data-centre addresses. */
  proxy?: string;
  /** How many pictures to take (spread evenly through the video). */
  frames?: number;
  timeoutMs?: number;
  /** Replaceable in tests. */
  run?: (bin: string, args: string[], timeoutMs: number) => Promise<{ stdout: string }>;
}

const exec = (bin: string, args: string[], timeoutMs: number) =>
  new Promise<{ stdout: string }>((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve({ stdout })));
  });

/** The seconds at which to take `count` pictures of a video `duration` seconds long: spread through the middle, not the very ends. */
export function frameTimes(duration: number, count: number): number[] {
  const length = Number.isFinite(duration) && duration > 0 ? duration : 60;
  const n = Math.max(1, Math.min(count, Math.floor(length)));
  return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * length * 10) / 10);
}

/**
 * Watches a public video the way a person would: yt-dlp downloads a small copy (low resolution, capped size, nothing kept),
 * ffmpeg takes evenly spaced pictures, and the copy is deleted. The pictures show the on-screen text, the ingredients and the steps.
 */
export function ytDlpFrames(options: FrameOptions): VideoFrameSource {
  const run = options.run ?? exec;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const count = options.frames ?? 8;
  return async (url) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'frames-'));
    try {
      const file = path.join(dir, 'v.mp4');
      await run(
        options.ytDlp,
        [
          '--no-warnings',
          '--no-playlist',
          '--socket-timeout',
          '15',
          '--max-filesize',
          '60M',
          // The smallest picture that is still readable: text on screen has to survive.
          '-f',
          'worst[height>=480]/worst[height>=360]/worst/best',
          '--merge-output-format',
          'mp4',
          '-o',
          file,
          ...(options.proxy ? ['--proxy', options.proxy] : []),
          '--',
          url,
        ],
        timeoutMs,
      );
      const downloaded = (await readdir(dir)).find((n) => n.startsWith('v.'));
      if (!downloaded) throw new Error('the video could not be downloaded');
      const video = path.join(dir, downloaded);

      let duration = 0;
      try {
        const probed = await run(options.ffmpeg, ['-hide_banner', '-i', video], 15_000).catch((e: { stderr?: string }) => ({ stdout: String(e.stderr ?? '') }));
        const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(probed.stdout);
        if (m) duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      } catch {
        duration = 0;
      }
      const times = frameTimes(duration, count);
      for (let i = 0; i < times.length; i++) {
        await run(
          options.ffmpeg,
          ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(times[i]), '-i', video, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', path.join(dir, `f${String(i).padStart(2, '0')}.jpg`)],
          30_000,
        ).catch(() => undefined);
      }
      const names = (await readdir(dir)).filter((n) => /^f\d+\.jpg$/.test(n)).sort();
      const frames: VideoFrame[] = [];
      for (const n of names) {
        const bytes = await readFile(path.join(dir, n));
        if (bytes.byteLength > 5_000) frames.push({ base64: bytes.toString('base64'), mimeType: 'image/jpeg' });
      }
      if (frames.length === 0) throw new Error('no pictures could be taken from the video');
      return frames;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}
