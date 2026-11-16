/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The built site is served by Caddy under /admin/, next to the API, so it needs no CORS and no second domain.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared/index.ts', import.meta.url)) },
  },
  server: {
    port: 5174,
    // Local development: the API runs on port 3000; same-origin calls are forwarded to it.
    proxy: { '/v1': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
});
