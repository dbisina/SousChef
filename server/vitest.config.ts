import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared$/, replacement: `${shared}/index.ts` },
      { find: /^@shared\//, replacement: `${shared}/` },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    // One database shared by all test files: run files one after another so they do not wipe each other's rows.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
