// Builds the Rust addon in server/native and names the result the way native/index.js looks for it:
//   souschef-native.<platform>-<arch>-<abi>.node
// Needs the Rust toolchain (cargo). In Docker this runs for you.
//
//   node scripts/build-native.mjs            release build (default)
//   node scripts/build-native.mjs --debug    faster compile, slower code

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'native');
const release = !process.argv.includes('--debug');

const { platform, arch } = process;
const cpu = arch === 'arm64' ? 'arm64' : 'x64';
let suffix;
let artifact;
if (platform === 'linux') {
  let musl = false;
  try {
    musl = readFileSync('/usr/bin/ldd', 'utf8').includes('musl');
  } catch {
    // glibc systems without that file are treated as glibc.
  }
  suffix = `linux-${cpu}-${musl ? 'musl' : 'gnu'}`;
  artifact = 'libsouschef_native.so';
} else if (platform === 'win32') {
  suffix = `win32-${cpu}-msvc`;
  artifact = 'souschef_native.dll';
} else if (platform === 'darwin') {
  suffix = `darwin-${cpu}`;
  artifact = 'libsouschef_native.dylib';
} else {
  throw new Error(`unsupported platform ${platform}-${arch}`);
}

const args = ['build', ...(release ? ['--release'] : [])];
const result = spawnSync('cargo', args, { cwd: root, stdio: 'inherit', shell: platform === 'win32' });
if (result.status !== 0) process.exit(result.status ?? 1);

const built = join(root, 'target', release ? 'release' : 'debug', artifact);
if (!existsSync(built)) throw new Error(`cargo finished but ${built} does not exist`);
const target = join(root, `souschef-native.${suffix}.node`);
copyFileSync(built, target);
process.stdout.write(`built ${target}\n`);
