import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from '../storage/storage';

/** What the model says about when a step happens in the video, in seconds. */
export interface StepTime {
  start: number;
  end: number;
}

export const MIN_CLIP_SECONDS = 3;
export const MAX_CLIP_SECONDS = 12;
/** Most clips one import may make, and the most seconds of video they add up to. */
export const MAX_CLIPS = 25;
export const MAX_TOTAL_CLIP_SECONDS = 180;

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Turns the model's step times into clip ranges, one slot per step: null where it could not tell, where the times make no
 * sense or where the cuts would pass the caps. A step the model placed for less than 3 seconds is widened to 3; one longer than 12
 * is cut to its first 12. Times past the end of the video are rejected (never invented to fill a gap).
 */
export function clipRanges(times: (StepTime | null | undefined)[], steps: number, duration: number): (StepTime | null)[] {
  const limit = isNumber(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  let used = 0;
  let made = 0;
  const out: (StepTime | null)[] = [];
  for (let i = 0; i < steps; i++) {
    const t = times[i];
    if (!t || !isNumber(t.start) || !isNumber(t.end) || t.start < 0 || t.end <= t.start || t.start >= limit) {
      out.push(null);
      continue;
    }
    const start = Math.round(t.start * 10) / 10;
    let end = Math.min(t.end, limit);
    if (end - start < MIN_CLIP_SECONDS) end = Math.min(start + MIN_CLIP_SECONDS, limit);
    if (end - start < 1) {
      out.push(null);
      continue;
    }
    end = Math.round(Math.min(end, start + MAX_CLIP_SECONDS) * 10) / 10;
    if (made >= MAX_CLIPS || used + (end - start) > MAX_TOTAL_CLIP_SECONDS) {
      out.push(null);
      continue;
    }
    used += end - start;
    made++;
    out.push({ start, end });
  }
  return out;
}

type Run = (bin: string, args: string[], timeoutMs: number) => Promise<{ stdout: string }>;

const exec: Run = (bin, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve({ stdout })));
  });

/** One silent, small clip from `video` (480 pixels high, no sound, ready to start playing before it has all arrived). */
export async function cutClip(video: string, outDir: string, name: string, range: StepTime, ffmpeg: string, run: Run = exec): Promise<Buffer | null> {
  const out = path.join(outDir, name);
  try {
    await run(
      ffmpeg,
      ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(range.start), '-i', video, '-t', String(Math.round((range.end - range.start) * 10) / 10), '-an', '-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      60_000,
    );
    const bytes = await readFile(out);
    return bytes.byteLength > 2_000 ? bytes : null;
  } catch {
    return null;
  } finally {
    await rm(out, { force: true }).catch(() => undefined);
  }
}

/** Puts the clip in the store under `key` and returns its public address; null when the store is not set up or refuses it. */
export async function putClip(storage: Storage | null, key: string, bytes: Buffer): Promise<string | null> {
  if (!storage) return null;
  try {
    await storage.write(key, bytes, 'video/mp4');
    return storage.publicUrl(key);
  } catch {
    return null;
  }
}
