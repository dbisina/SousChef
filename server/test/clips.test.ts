import { describe, expect, it } from 'vitest';
import { clipRanges, cutClip, putClip, MAX_CLIPS, MAX_CLIP_SECONDS, MIN_CLIP_SECONDS } from '../src/imports/clips';
import { isWatched, type WatchedVideo } from '../src/imports/videoFrames';

describe('clip ranges', () => {
  it('gives one slot per step and keeps sensible times as they are', () => {
    expect(clipRanges([{ start: 4, end: 10 }, null, { start: 20, end: 26 }], 3, 60)).toEqual([{ start: 4, end: 10 }, null, { start: 20, end: 26 }]);
  });

  it('widens a very short step to the minimum and cuts a long one to the maximum', () => {
    const [short, long] = clipRanges([{ start: 10, end: 11 }, { start: 20, end: 60 }], 2, 120);
    expect(short).toEqual({ start: 10, end: 10 + MIN_CLIP_SECONDS });
    expect(long).toEqual({ start: 20, end: 20 + MAX_CLIP_SECONDS });
  });

  it('never invents a clip: bad, backwards, negative or past-the-end times give none', () => {
    const got = clipRanges([{ start: 5, end: 5 }, { start: 9, end: 3 }, { start: -2, end: 4 }, { start: 90, end: 99 }, { start: Number.NaN, end: 4 }, undefined], 6, 60);
    expect(got).toEqual([null, null, null, null, null, null]);
  });

  it('does not run past the end of the video', () => {
    expect(clipRanges([{ start: 57, end: 70 }], 1, 60)).toEqual([{ start: 57, end: 60 }]);
  });

  it('stops at the caps on clips and on total length', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ start: i * 4, end: i * 4 + 3 }));
    const got = clipRanges(many, 40, 400);
    expect(got.filter(Boolean)).toHaveLength(MAX_CLIPS);
    expect(got.slice(MAX_CLIPS).every((r) => r === null)).toBe(true);
    const long = Array.from({ length: 20 }, (_, i) => ({ start: i * 20, end: i * 20 + 12 }));
    const total = clipRanges(long, 20, 600).reduce((s, r) => s + (r ? r.end - r.start : 0), 0);
    expect(total).toBeLessThanOrEqual(180);
  });

  it('treats an unknown duration as no limit', () => {
    expect(clipRanges([{ start: 100, end: 108 }], 1, 0)).toEqual([{ start: 100, end: 108 }]);
  });
});

describe('cutting and storing', () => {
  it('asks ffmpeg for a silent, small clip of exactly the range', async () => {
    const calls: string[][] = [];
    const run = async (_bin: string, args: string[]) => {
      calls.push(args);
      return { stdout: '' };
    };
    // ffmpeg writes nothing in this test, so there is no file to read back: the cut reports "none".
    expect(await cutClip('/tmp/v.mp4', '/tmp', 'c0.mp4', { start: 4.5, end: 10.5 }, 'ffmpeg', run)).toBeNull();
    const args = calls[0] ?? [];
    expect(args).toEqual(expect.arrayContaining(['-ss', '4.5', '-t', '6', '-an', '-movflags', '+faststart']));
    expect(args.join(' ')).toContain('scale=-2:480');
  });

  it('stores the clip and returns its public address, or null when the store refuses it or is missing', async () => {
    const stored = new Map<string, string>();
    const storage = {
      write: async (key: string, _b: Buffer, type: string) => {
        if (key.includes('refused')) throw new Error('no');
        stored.set(key, type);
      },
      publicUrl: (k: string) => `https://media.test/${k}`,
    };
    const bytes = Buffer.alloc(3000, 1);
    expect(await putClip(storage as never, 'import-clips/u/b/0.mp4', bytes)).toBe('https://media.test/import-clips/u/b/0.mp4');
    expect(stored.get('import-clips/u/b/0.mp4')).toBe('video/mp4');
    expect(await putClip(storage as never, 'refused/0.mp4', bytes)).toBeNull();
    expect(await putClip(null, 'k', bytes)).toBeNull();
  });

  it('tells a watched video from a plain list of pictures', () => {
    const watched = { frames: [], times: [], duration: 10, cut: async () => [], release: async () => undefined } as WatchedVideo;
    expect(isWatched(watched)).toBe(true);
    expect(isWatched([])).toBe(false);
  });
});
