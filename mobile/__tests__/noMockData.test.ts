// The app shows real data or an empty state: never invented people, recipes, plans, photos or numbers. This test keeps
// sample content from quietly coming back.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'services', 'stores', 'constants', 'types'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sources = SOURCE_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) => /\.(ts|tsx)$/.test(f));
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

describe('no sample content in the app', () => {
  it('has no bundled sample data or sample photos', () => {
    expect(existsSync(path.join(ROOT, 'data', 'sample'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'data', 'seedData.ts'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'assets', 'sample'))).toBe(false);
  });

  it('imports neither sample data nor sample photos', () => {
    const offenders = sources.filter((f) => /from ['"]@\/(data\/(sample|seedData)|assets\/sample)/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('ships only the app\'s own photography (assets/photos: ingredients and dishes), no people or accounts', () => {
    const assets = walk(path.join(ROOT, 'assets'))
      .filter((f) => /\.(jpe?g)$/i.test(f))
      .map(rel)
      .filter((f) => !/(^|\/)(icon|adaptive-icon|splash-icon)\.jpg$/.test(f)) // the app's own icon and splash picture
      .filter((f) => !/^assets\/(photos|games|enplace-brand-assets|brand)\//.test(f)); // the app's own fixed imagery: food photography, game card art and the brand kit
    expect(assets).toEqual([]);
  });

  it('does not invent numbers with Math.random in a screen or store', () => {
    const offenders = sources
      .filter((f) => /^(app|components|stores)\//.test(rel(f)))
      .filter((f) => /Math\.random\(\)/.test(readFileSync(f, 'utf8')))
      .map(rel);
    // the voice store only uses it to name a timer
    expect(offenders.filter((f) => f !== 'stores/voiceStore.ts')).toEqual([]);
  });

  it('has no restaurant or ordering feature (there is no server side for it)', () => {
    expect(existsSync(path.join(ROOT, 'app', 'order'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'app', 'restaurant'))).toBe(false);
    expect(existsSync(path.join(ROOT, 'stores', 'orderStore.ts'))).toBe(false);
  });
});
