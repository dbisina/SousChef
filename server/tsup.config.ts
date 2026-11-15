import { defineConfig } from 'tsup';

export default defineConfig({
  // index is the server; resealHealth is the key-rotation command (npm run health:reseal).
  entry: ['src/index.ts', 'src/resealHealth.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Everything under node_modules stays external (the native addon and Prisma's engine files must be loaded from disk).
  // The generated Prisma client is our own TypeScript, so it is bundled.
  external: ['@souschef/native', '@node-rs/argon2'],
});
