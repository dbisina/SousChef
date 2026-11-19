import { parseShareURL } from '@/lib/shareExtension';

describe('parseShareURL', () => {
  const tiktok = 'https://vm.tiktok.com/ZMabc123/';
  const enc = encodeURIComponent(tiktok);

  it('reads the enplace share link', () => {
    expect(parseShareURL(`enplace://share?url=${enc}`)).toBe(tiktok);
  });

  it('still reads the older souschef link', () => {
    expect(parseShareURL(`souschef://share?url=${enc}`)).toBe(tiktok);
  });

  it('ignores other links', () => {
    expect(parseShareURL('enplace://recipe/1')).toBeNull();
    expect(parseShareURL('https://example.com/share?url=x')).toBeNull();
  });
});
