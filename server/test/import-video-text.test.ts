import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ImportResult } from '@shared';
import { captionsToText, instagramCaptionFromEmbed, tiktokFromPage, ytDlpSource, type VideoText } from '../src/imports/videoText';
import { frameTimes, ytDlpFrames } from '../src/imports/videoFrames';
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
