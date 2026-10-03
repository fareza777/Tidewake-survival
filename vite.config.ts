import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: { port: 5199, strictPort: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**', 'src/data/**', 'src/core/rng.ts', 'src/core/save.ts', 'src/core/saveData.ts', 'src/core/settings.ts', 'src/core/i18n.ts', 'src/core/viewport.ts'],
      exclude: ['src/data/tileIndex.ts'],
      reporter: ['text'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
} as never);
