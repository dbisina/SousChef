// The edits restructure-to-mobile.sh makes to files after the move. Run from the repository root, after the move.
// Kept separate so each change can be read (and re-run by hand) on its own.
const fs = require('node:fs');
const path = require('node:path');

const root = 'mobile';
const skip = new Set(['node_modules', '.expo', 'dist', 'dist-web', '.git']);

/* ---- 1. Imports of the shared folder: a relative path breaks one level deeper, so use an alias. ---- */
let changed = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const before = fs.readFileSync(full, 'utf8');
      // '../shared/x', '../../shared/x' -> '@shared/x'  (also inside jest.mock and require)
      const after = before.replace(/(['"`])(?:\.\.\/)+shared\//g, '$1@shared/');
      if (after !== before) {
        fs.writeFileSync(full, after);
        changed++;
      }
    }
  }
};
walk(root);
console.log(`rewrote shared imports in ${changed} files`);

/* ---- 2. Config files ---- */
const edit = (file, fn) => {
  const p = path.join(root, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`${file}: expected text not found - make this change by hand (see docs/restructure.md)`);
  fs.writeFileSync(p, after);
};
// Replacement strings are given as functions: "$1" and "$'" mean something special inside a plain replacement string.
const swap = (s, from, to) => {
  if (!s.includes(from)) throw new Error(`expected text not found: ${from.slice(0, 60)}`);
  return s.replace(from, () => to);
};

// TypeScript: the alias; server/ and admin/ are no longer inside this project.
edit('tsconfig.json', (s) => {
  const j = JSON.parse(s);
  j.compilerOptions.paths['@shared/*'] = ['../shared/*'];
  j.exclude = (j.exclude || []).filter((x) => x !== 'server' && x !== 'admin');
  return JSON.stringify(j, null, 2) + '\n';
});

// Jest: the same alias. Code compiled from ../shared still needs this project's packages (Babel helpers, for one).
edit('jest.config.js', (s) => {
  let out = swap(s, `moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }`, `moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../shared/$1', '^@/(.*)$': '<rootDir>/$1' }`);
  out = swap(out, 'setupFiles:', `modulePaths: ['<rootDir>/node_modules'],\n  setupFiles:`);
  return out.replace(", '<rootDir>/server/'", '').replace(", '<rootDir>/admin/'", '');
});

// Metro: files outside the project folder must be watched, and compiled with this project's packages.
edit('metro.config.js', (s) =>
  swap(
    s,
    'const config = getDefaultConfig(__dirname);',
    `const config = getDefaultConfig(__dirname);

// shared/ lives one level up (the server and the admin site use it too). It has no node_modules of its own, so its
// files are compiled with this project's packages.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];`,
  ),
);

// ESLint: server/ and admin/ are not in this project any more.
edit('eslint.config.js', (s) => s.replace(', "server/**", "admin/**"', '').replace(', "server/**"', ''));
