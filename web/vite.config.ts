import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: '/inu-market-semi-auto-ui/',
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
