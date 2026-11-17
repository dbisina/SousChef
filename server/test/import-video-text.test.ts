import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ImportResult } from '@shared';
import { captionsToText, instagramCaptionFromEmbed, tiktokFromPage, ytDlpSource, type VideoText } from '../src/imports/videoText';
import { downloadVideo, frameTimes, isAllowedVideoUrl, ytDlpFrames, type WatchedVideo } from '../src/imports/videoFrames';
import { makeApp, register, type TestApp } from './helpers';
import { call } from './recipeHelpers';

const recipeJson = JSON.stringify({
  found: true,
  title: 'Garlic Butter Pasta',
  servings: 2,
  prepTime: 5,
  cookTime: 15,
  difficulty: 'easy',
  cuisine: 'italian',
  category: 'dinner',
  ingredients: [
    { name: 'spaghetti', amount: 200, unit: 'g' },
    { name: 'butter', amount: 3, unit: 'tbsp' },
    { name: 'garlic', amount: 4, unit: 'clove' },
  ],
  instructions: ['Boil the pasta', 'Melt butter with garlic', 'Toss together'],
  tags: ['pasta'],
  confidence: 0.9,
});

describe('reading captions and pages', () => {
  it('turns auto-captions with their rolling repeats into one clean passage', () => {
    const vtt = `WEBVTT\nKind: captions\nLanguage: en\n\n00:00:01.000 --> 00:00:03.000\nboil the <c>spaghetti</c>\n\n00:00:03.000 --> 00:00:05.000\nboil the spaghetti\nuntil it is al dente\n\n00:00:05.000 --> 00:00:07.000\nuntil it is al dente\nthen add butter &amp; garlic\n`;
    expect(captionsToText(vtt)).toBe('boil the spaghetti until it is al dente then add butter & garlic');
  });

  it('finds the caption in an Instagram embed page', () => {
    const html = '<html><div class="Caption"><a class="CaptionUsername" href="/chef">chef</a><br/>Garlic butter pasta: 200g spaghetti, 3 tbsp butter, 4 cloves garlic. Boil, melt, toss.</div><div class="CaptionComments"></div></html>';
    expect(instagramCaptionFromEmbed(html)).toContain('200g spaghetti, 3 tbsp butter');
    expect(instagramCaptionFromEmbed(html)).not.toContain('chef\n');
    const og = '<meta property="og:description" content="12 likes, 1 comments - chef on March 3, 2026: &quot;Garlic butter pasta with 200g spaghetti and 3 tbsp butter.&quot;.">';
    expect(instagramCaptionFromEmbed(og)).toBe('Garlic butter pasta with 200g spaghetti and 3 tbsp butter.');
    expect(instagramCaptionFromEmbed('<html></html>')).toBeUndefined();
  });

  it('finds the description in the JSON a TikTok page carries', () => {
    const data = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { desc: 'Garlic butter pasta in 15 minutes', author: { nickname: 'Chef Ama' }, video: { cover: 'https://p16.tiktokcdn.com/c.jpg' } } } } } };
    const html = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script>`;
    expect(tiktokFromPage(html)).toEqual({ description: 'Garlic butter pasta in 15 minutes', author: 'Chef Ama', image: 'https://p16.tiktokcdn.com/c.jpg' });
    expect(tiktokFromPage('<html></html>')).toEqual({});
  });

  it('reads yt-dlp output: caption, uploader, picture and the longest subtitle track', async () => {
    let seen: string[] = [];
    const source = ytDlpSource({
      bin: 'yt-dlp',
      proxy: 'http://proxy.example:8080',
      run: async (_bin, args) => {
        seen = args;
        return { stdout: JSON.stringify({ title: 'Pasta', description: 'Garlic butter pasta recipe', uploader: 'Chef Ama', thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg' }) };
      },
      readSubs: async () => ['WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nshort', 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nboil the pasta for ten minutes'],
    });
    const out = await source('https://www.youtube.com/watch?v=abc');
    expect(out).toEqual({ title: 'Pasta', description: 'Garlic butter pasta recipe', author: 'Chef Ama', image: 'https://i.ytimg.com/vi/x/hq.jpg', transcript: 'boil the pasta for ten minutes' });
    expect(seen).toContain('--skip-download');
    expect(seen).toContain('--proxy');
    expect(seen.at(-2)).toBe('--');
    expect(seen.at(-1)).toBe('https://www.youtube.com/watch?v=abc');
  });
});

describe('importing a video with captions read by yt-dlp', () => {
  let t: TestApp;
  let source: (url: string) => Promise<VideoText>;
  beforeAll(async () => {
    t = await makeApp({ ACCESS_TOKEN_TTL_SECONDS: String(60 * 86400), IMPORT_RATE_LIMIT_MAX: '100000' }, { videoText: (url) => source(url) });
  });
  afterAll(() => t.close());
  beforeEach(async () => {
    await t.reset();
    source = async () => ({});
  });

  const importLink = (who: Awaited<ReturnType<typeof register>>, url: string) => call(t, 'POST', '/v1/imports', who, { url });

  it('reads a YouTube recipe from the subtitles with the text model, without a model that watches video', async () => {
    const ama = await register(t);
    const YT = 'https://www.youtube.com/watch?v=abcdefghijk';
    t.web.json(`https://www.youtube.com/oembed?url=${encodeURIComponent(YT)}&format=json`, { title: 'Pasta', author_name: 'Chef Ama' });
    source = async () => ({ description: 'Quick pasta', transcript: 'we boil 200 grams of spaghetti then melt three tablespoons of butter with four cloves of garlic and toss it all together' });
    t.ai.deepseek.handler = () => recipeJson;
    t.ai.nebius.handler = () => recipeJson;
    const body = (await importLink(ama, YT)).json<ImportResult>();
    expect(body).toMatchObject({ status: 'done', platform: 'youtube' });
    expect(body.recipe?.title).toBe('Garlic Butter Pasta');
    expect(t.ai.gemini.calls).toHaveLength(0);
    const prompt = [...t.ai.deepseek.calls, ...t.ai.nebius.calls][0]?.prompt ?? '';
    expect(prompt).toContain('Words spoken in the video');
    expect(prompt).toContain('200 grams of spaghetti');
  });

  it('uses the TikTok page when the oEmbed card only has a short title', async () => {
    const ama = await register(t);
    const full = 'https://www.tiktok.com/@chef.ama/video/7234567890123456780';
    t.web.json(`https://www.tiktok.com/oembed?url=${encodeURIComponent(full)}`, { title: 'pasta', author_name: 'chef.ama' });
    const data = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { desc: 'Garlic butter pasta: 200g spaghetti, 3 tbsp butter, 4 cloves garlic. Boil the pasta, melt butter with garlic, toss.' } } } } };
    t.web.page(full, `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(data)}</script>`);
    t.ai.deepseek.handler = () => recipeJson;
    t.ai.nebius.handler = () => recipeJson;
    const body = (await importLink(ama, full)).json<ImportResult>();
    expect(body).toMatchObject({ status: 'done', platform: 'tiktok' });
  });

  it('reads an Instagram caption from the public embed page when yt-dlp is blocked', async () => {
    const ama = await register(t);
    const url = 'https://www.instagram.com/reel/CxYz123AbCd/';
    source = async () => {
      throw new Error('login required');
    };
    t.web.page(
      'https://www.instagram.com/p/CxYz123AbCd/embed/captioned/',
      '<div class="Caption"><a class="CaptionUsername" href="/c">c</a><br/>Garlic butter pasta: 200g spaghetti, 3 tbsp butter, 4 cloves garlic. Boil, melt butter with garlic, toss.</div><div class="CaptionComments"></div>',
    );
    t.ai.deepseek.handler = () => recipeJson;
    t.ai.nebius.handler = () => recipeJson;
    expect((await importLink(ama, url)).json<ImportResult>()).toMatchObject({ status: 'done', platform: 'instagram' });
  });

  it('still asks for frames when nothing readable can be found', async () => {
    const ama = await register(t);
    source = async () => {
      throw new Error('blocked');
    };
    const body = (await importLink(ama, 'https://www.instagram.com/reel/CxYz999AbCd/')).json<ImportResult>();
    expect(body.status).toBe('needs_frames');
  });
});

describe('watching a video for its recipe', () => {
  it('spreads the pictures through the middle of the video', () => {
    expect(frameTimes(80, 4)).toEqual([10, 30, 50, 70]);
    expect(frameTimes(0, 3)).toHaveLength(3); // an unknown length is treated as a minute
    expect(frameTimes(2, 8)).toHaveLength(2); // never more pictures than seconds
  });

  it('downloads a small copy, takes pictures with ffmpeg, and returns them', async () => {
    const { writeFile } = await import('node:fs/promises');
    const calls: string[] = [];
    const source = ytDlpFrames({
      ytDlp: 'yt-dlp',
      ffmpeg: 'ffmpeg',
      frames: 3,
      run: async (bin, args) => {
        calls.push(bin);
        if (bin === 'yt-dlp') {
          await writeFile(args[args.indexOf('-o') + 1] as string, Buffer.alloc(100));
        } else if (args.includes('-frames:v')) {
          await writeFile(args[args.length - 1] as string, Buffer.alloc(6000, 7));
        } else {
          throw Object.assign(new Error('ffmpeg needs an output'), { stderr: '  Duration: 00:01:30.00, start: 0.000000' });
        }
        return { stdout: '' };
      },
    });
    const frames = await source('https://www.tiktok.com/@a/video/1');
    expect(frames).toHaveLength(3);
    expect(frames[0]).toMatchObject({ mimeType: 'image/jpeg' });
    expect(calls[0]).toBe('yt-dlp');
  });

  it('fails cleanly when the video cannot be downloaded', async () => {
    const source = ytDlpFrames({ ytDlp: 'yt-dlp', ffmpeg: 'ffmpeg', run: async () => ({ stdout: '' }) });
    await expect(source('https://www.tiktok.com/@a/video/1')).rejects.toThrow('could not be downloaded');
  });
});

describe('reading a video from its pictures', () => {
  let w: TestApp;
  let frames: () => Promise<{ base64: string; mimeType: 'image/jpeg' }[]>;
  beforeAll(async () => {
    w = await makeApp({ IMPORT_RATE_LIMIT_MAX: '100000' }, { videoFrames: () => frames() });
  });
  afterAll(() => w.close());
  beforeEach(() => w.reset());

  it('reads the recipe from the pictures when the caption has none, so the phone never has to send frames', async () => {
    const ama = await register(w);
    frames = async () => [{ base64: Buffer.alloc(8, 1).toString('base64'), mimeType: 'image/jpeg' }];
    w.ai.gemini.handler = () => recipeJson;
    w.ai.nebius.handler = () => recipeJson;
    const body = (await call(w, 'POST', '/v1/imports', ama, { url: 'https://www.tiktok.com/@a/video/7234567890123456799' })).json<ImportResult>();
    expect(body).toMatchObject({ status: 'done', platform: 'tiktok', recipe: { title: 'Garlic Butter Pasta' } });
  });

  it('asks the phone for frames only when the video could not be watched either', async () => {
    const ama = await register(w);
    frames = async () => {
      throw new Error('blocked');
    };
    const body = (await call(w, 'POST', '/v1/imports', ama, { url: 'https://www.tiktok.com/@a/video/7234567890123456798' })).json<ImportResult>();
    expect(body.status).toBe('needs_frames');
  });
});

describe('step clips from a watched video', () => {
  let w: TestApp;
  let released = 0;
  const watched = (): WatchedVideo => ({
    frames: [{ base64: Buffer.alloc(8, 1).toString('base64'), mimeType: 'image/jpeg' }],
    times: [10],
    duration: 90,
    cut: async (ranges) => ranges.map((r) => (r ? Buffer.alloc(3000, 5) : null)),
    release: async () => {
      released++;
    },
  });
  const withTimes = JSON.stringify({ ...JSON.parse(recipeJson), stepTimes: [{ start: 5, end: 15 }, null, { start: 40, end: 52 }] });
  const link = (id: string) => `https://www.tiktok.com/@a/video/${id}`;
  beforeAll(async () => {
    w = await makeApp({ IMPORT_RATE_LIMIT_MAX: '100000' }, { videoFrames: async () => watched() });
  });
  afterAll(() => w.close());
  beforeEach(async () => {
    await w.reset();
    released = 0;
    w.ai.gemini.handler = () => withTimes;
    w.ai.nebius.handler = () => withTimes;
  });

  it('cuts a clip for each step the model could place, stores them under the importer, and deletes the downloaded copy', async () => {
    const ama = await register(w);
    const body = (await call(w, 'POST', '/v1/imports', ama, { url: link('7234567890123456711') })).json<ImportResult>();
    expect(body.status).toBe('done');
    expect(body.recipe?.stepClips).toEqual([expect.stringMatching(/^https:\/\/media\.test\/import-clips\/.+\/0\.mp4$/), null, expect.stringMatching(/\/2\.mp4$/)]);
    expect(released).toBe(1);
    const mine = [...w.storage.files.keys()].filter((k) => k.startsWith(`import-clips/${ama.user.id}/`));
    expect(mine).toHaveLength(2);
    expect(w.storage.files.get(mine[0] as string)?.contentType).toBe('video/mp4');
  });

  it('keeps the clips out of what other people get from the shared import cache', async () => {
    const [ama, kemi] = [await register(w), await register(w)];
    const url = link('7234567890123456712');
    await call(w, 'POST', '/v1/imports', ama, { url });
    const again = (await call(w, 'POST', '/v1/imports', kemi, { url })).json<ImportResult>();
    expect(again.recipe?.title).toBe('Garlic Butter Pasta');
    expect(again.recipe?.stepClips).toBeUndefined();
    const cached = await w.db.importCache.findFirstOrThrow({ where: { sourceUrl: url } });
    expect(JSON.stringify(cached.recipe)).not.toContain('stepClips');
  });

  it('still imports the recipe when the store refuses the clips, or the model gave no times', async () => {
    const ama = await register(w);
    const refuse = w.storage.write.bind(w.storage);
    w.storage.write = async () => {
      throw new Error('storage unavailable');
    };
    const refused = (await call(w, 'POST', '/v1/imports', ama, { url: link('7234567890123456713') })).json<ImportResult>();
    w.storage.write = refuse;
    expect(refused).toMatchObject({ status: 'done', recipe: { title: 'Garlic Butter Pasta' } });
    expect(refused.recipe?.stepClips).toBeUndefined();

    w.ai.gemini.handler = () => recipeJson;
    w.ai.nebius.handler = () => recipeJson;
    const plain = (await call(w, 'POST', '/v1/imports', ama, { url: link('7234567890123456714') })).json<ImportResult>();
    expect(plain.recipe?.stepClips).toBeUndefined();
    expect(released).toBe(2);
  });

  it('keeps clips on a saved want-to-cook item', async () => {
    const ama = await register(w);
    const body = (await call(w, 'POST', '/v1/imports', ama, { url: link('7234567890123456715') })).json<ImportResult>();
    const saved = await call(w, 'POST', '/v1/me/want-to-cook', ama, { imported: body.recipe });
    expect(saved.statusCode).toBe(201);
    const list = (await call(w, 'GET', '/v1/me/want-to-cook', ama)).json<{ items: { imported?: { stepClips?: (string | null)[] } }[] }>();
    expect(list.items[0]?.imported?.stepClips?.[0]).toMatch(/0\.mp4$/);
  });
});

describe('reading a video the phone fetched', () => {
  it('only accepts https addresses on a platform\'s own video network', () => {
    expect(isAllowedVideoUrl('https://v16-webapp-prime.tiktok.com/video/tos/alisg/x/?a=1')).toBe(true);
    expect(isAllowedVideoUrl('https://v19.tiktokcdn.com/x.mp4')).toBe(true);
    for (const bad of ['http://v16.tiktok.com/x', 'https://evil.example.com/x.mp4', 'https://tiktok.com.evil.example/x', 'https://169.254.169.254/latest', 'https://user:pw@v16.tiktok.com/x', 'https://v16.tiktok.com:8443/x', 'not a url']) {
      expect(isAllowedVideoUrl(bad), bad).toBe(false);
    }
  });

  it('downloads with the cookie, refuses what is too small or too large, and never follows a redirect', async () => {
    const seen: { url: string; headers: Record<string, string>; redirect?: string }[] = [];
    const reply = (status: number, bytes: number, headers: Record<string, string> = {}): typeof fetch =>
      (async (url: string, init?: RequestInit) => {
        seen.push({ url, headers: init?.headers as Record<string, string>, ...(init?.redirect ? { redirect: init.redirect } : {}) });
        return { ok: status < 400, status, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null }, arrayBuffer: async () => new ArrayBuffer(bytes) };
      }) as unknown as typeof fetch;
    const ok = await downloadVideo('https://v16.tiktok.com/video/x', 'tt_chain_token=abc', reply(206, 50_000));
    expect(ok.byteLength).toBe(50_000);
    expect(seen[0]).toMatchObject({ url: 'https://v16.tiktok.com/video/x', redirect: 'error' });
    expect(seen[0]?.headers['cookie']).toBe('tt_chain_token=abc');
    await expect(downloadVideo('https://evil.example.com/x', undefined, reply(200, 50_000))).rejects.toThrow('not allowed');
    await expect(downloadVideo('https://v16.tiktok.com/x', undefined, reply(403, 10))).rejects.toThrow('403');
    await expect(downloadVideo('https://v16.tiktok.com/x', undefined, reply(200, 100))).rejects.toThrow('not a video');
    await expect(downloadVideo('https://v16.tiktok.com/x', undefined, reply(200, 100, { 'content-length': String(500 * 1024 * 1024) }))).rejects.toThrow('too large');
  });

  describe('finishing an import from it', () => {
    let w: TestApp;
    let downloaded: { url: string; cookie?: string } | null = null;
    beforeAll(async () => {
      w = await makeApp(
        { IMPORT_RATE_LIMIT_MAX: '100000' },
        {
          phoneVideo: {
            download: async (url, cookie) => {
              downloaded = { url, ...(cookie ? { cookie } : {}) };
              if (url.includes('bad')) throw new Error('the video could not be downloaded (403)');
              return Buffer.alloc(20_000);
            },
            frames: async () => [{ base64: Buffer.alloc(8, 1).toString('base64'), mimeType: 'image/jpeg' }],
          },
        },
      );
    });
    afterAll(() => w.close());
    beforeEach(async () => {
      await w.reset();
      downloaded = null;
    });

    const needsVideo = async (who: Awaited<ReturnType<typeof register>>, id = '7234567890123456701') =>
      (await call(w, 'POST', '/v1/imports', who, { url: `https://www.tiktok.com/@a/video/${id}` })).json<ImportResult>();

    it('reads the recipe from the video file the phone resolved, and caches it', async () => {
      const ama = await register(w);
      const pending = await needsVideo(ama);
      expect(pending.status).toBe('needs_frames');
      w.ai.gemini.handler = () => recipeJson;
      w.ai.nebius.handler = () => recipeJson;
      const res = await call(w, 'POST', `/v1/imports/${pending.id}/video`, ama, { videoUrl: 'https://v16-webapp-prime.tiktok.com/video/tos/x', cookie: 'tt_chain_token=abc' });
      expect(res.statusCode).toBe(200);
      expect(res.json<ImportResult>()).toMatchObject({ id: pending.id, status: 'done', platform: 'tiktok', recipe: { title: 'Garlic Butter Pasta' } });
      expect(downloaded).toEqual({ url: 'https://v16-webapp-prime.tiktok.com/video/tos/x', cookie: 'tt_chain_token=abc' });
      expect(await w.db.importCache.count({ where: { key: 'tiktok:7234567890123456701' } })).toBe(1);
    });

    it('turns away someone else\'s import, a bad address and a download that fails', async () => {
      const [ama, kemi] = [await register(w), await register(w)] as const;
      const pending = await needsVideo(ama, '7234567890123456702');
      expect((await call(w, 'POST', `/v1/imports/${pending.id}/video`, kemi, { videoUrl: 'https://v16.tiktok.com/x' })).statusCode).toBe(404);
      expect((await call(w, 'POST', `/v1/imports/${pending.id}/video`, ama, { videoUrl: 'not a url' })).statusCode).toBe(400);
      expect((await call(w, 'POST', `/v1/imports/${pending.id}/video`, ama, { videoUrl: 'https://v16.tiktok.com/bad' })).statusCode).toBe(400);
      expect((await call(w, 'POST', `/v1/imports/${pending.id}/video`, undefined, { videoUrl: 'https://v16.tiktok.com/x' })).statusCode).toBe(401);
    });
  });
});
