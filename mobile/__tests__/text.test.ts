import { cleanCopy } from '../lib/text';

describe('cleanCopy', () => {
  it('replaces dashes used as punctuation with a comma', () => {
    expect(cleanCopy('Fresh — delivered')).toBe('Fresh, delivered');
    expect(cleanCopy('Fresh—delivered')).toBe('Fresh, delivered');
    expect(cleanCopy('Fresh – delivered')).toBe('Fresh, delivered');
    expect(cleanCopy('Fresh -- delivered')).toBe('Fresh, delivered');
  });
  it('handles empty input', () => {
    expect(cleanCopy(undefined)).toBe('');
    expect(cleanCopy('  hi  ')).toBe('hi');
  });
});
