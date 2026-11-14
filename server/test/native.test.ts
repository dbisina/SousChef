import { describe, expect, it } from 'vitest';
import { parseLink, videoCacheKey } from '../src/videoLink';

// The parsing rules are unit tested in Rust (server/native/links). These check the Node side of the bridge:
// the compiled addon loads, and its answers arrive in the shape the TypeScript types promise.
describe('video link parser (Rust addon)', () => {
  it('turns every shape of one video into one cache key', () => {
    const keys = new Set(
      [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ?si=tracking',
        'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      ].map(videoCacheKey),
    );
    expect([...keys]).toEqual(['youtube:dQw4w9WgXcQ']);
  });

  it('knows TikTok and Instagram videos', () => {
    expect(videoCacheKey('https://www.tiktok.com/@chef.ama/video/7234567890123456789?is_from_webapp=1')).toBe('tiktok:7234567890123456789');
    expect(videoCacheKey('https://www.instagram.com/chef.ama/reel/CxYz123AbCd/?igsh=abc')).toBe('instagram:CxYz123AbCd');
  });

  it('reports a short link as needing to be resolved, with its code', () => {
    expect(videoCacheKey('https://vm.tiktok.com/ZMabc123/')).toBeNull();
    expect(parseLink('https://vm.tiktok.com/ZMabc123/')).toEqual({ platform: 'tiktok', id: 'ZMabc123', canonical: null });
  });

  it('returns null for anything that is not a video link', () => {
    for (const bad of ['', 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ']) {
      expect(parseLink(bad)).toBeNull();
      expect(videoCacheKey(bad)).toBeNull();
    }
  });

  it('is fast enough to run on every import without thinking about it', () => {
    const start = performance.now();
    for (let i = 0; i < 20_000; i++) videoCacheKey(`https://www.tiktok.com/@a/video/${7_000_000_000_000_000_000n + BigInt(i)}`);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
