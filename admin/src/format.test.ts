import { describe, expect, it } from 'vitest';
import { ago, int, percent, usd } from './format';

describe('format', () => {
  it('shows money with enough places for tiny AI costs', () => {
    expect(usd(0)).toBe('$0');
    expect(usd(0.0031)).toBe('$0.0031');
    expect(usd(12.5)).toBe('$12.50');
  });

  it('groups big numbers', () => {
    expect(int(1234567)).toBe('1,234,567');
  });

  it('says how long ago', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    expect(ago('2026-11-15T11:59:50Z', now)).toBe('just now');
    expect(ago('2026-11-15T11:59:00Z', now)).toBe('1 minute ago');
    expect(ago('2026-11-15T09:00:00Z', now)).toBe('3 hours ago');
    expect(ago('2026-11-13T12:00:00Z', now)).toBe('2 days ago');
    expect(ago('2026-11-16T12:00:00Z', now)).toBe('just now'); // a clock a little ahead is not "in the future"
  });

  it('works out the share of a budget, never over 100', () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(9, 4)).toBe(100);
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 0)).toBe(100);
  });
});
