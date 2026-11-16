import { describe, expect, it } from 'vitest';
import { normalizeEmail, slugifyHandle } from '../src/auth/service';

describe('slugifyHandle', () => {
  it.each([
    ['Ama Okafor', 'ama_okafor'],
    ['  Chef   Ama  ', 'chef_ama'],
    ['Chloé Müller', 'chloe_muller'],
    ['ÅNGSTRÖM', 'angstrom'],
    ['John O\'Neil-Smith', 'john_o_neil_smith'],
    ['Ama123', 'ama123'],
    ['A very long display name that goes on', 'a_very_long_display'],
    ['Jo', 'jochef'],
    ['!!!', 'chef'],
    ['', 'chef'],
    ['日本語', 'chef'],
  ])('%j becomes %j', (name, handle) => {
    expect(slugifyHandle(name)).toBe(handle);
  });

  it('always produces a valid username', () => {
    for (const name of ['x', 'ab', 'A.B.C', '___', 'Zoë 🍲 Cook', 'a'.repeat(100)]) {
      expect(slugifyHandle(name)).toMatch(/^[a-z0-9_]{3,20}$/);
    }
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ama@Example.COM ')).toBe('ama@example.com');
  });
});
