// Loads the compiled addon for this platform. `napi build --platform --no-js` writes
// souschef-native.<platform>-<arch>-<abi>.node next to this file; this loader picks the right one.
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

function isMusl() {
  if (process.platform !== 'linux') return false;
  try {
    return readFileSync('/usr/bin/ldd', 'utf8').includes('musl');
  } catch {
    return false;
  }
}

function suffix() {
  const { platform, arch } = process;
  if (platform === 'linux') return `linux-${arch === 'arm64' ? 'arm64' : 'x64'}-${isMusl() ? 'musl' : 'gnu'}`;
  if (platform === 'win32') return `win32-${arch === 'arm64' ? 'arm64' : 'x64'}-msvc`;
  if (platform === 'darwin') return `darwin-${arch === 'arm64' ? 'arm64' : 'x64'}`;
  throw new Error(`@souschef/native: unsupported platform ${platform}-${arch}`);
}

const file = join(__dirname, `souschef-native.${suffix()}.node`);
if (!existsSync(file)) {
  throw new Error(
    `@souschef/native: ${file} is missing. Build it with "npm run native:build" (needs the Rust toolchain; in Docker this runs for you).`,
  );
}

module.exports = require(file);
