import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  base: '/cropimage/',
  server: {
    port: 3100,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        'guide-vanilla': resolve(__dirname, 'src/guide-vanilla.html'),
        'guide-react': resolve(__dirname, 'src/guide-react.html'),
        'guide-svelte': resolve(__dirname, 'src/guide-svelte.html'),
        'guide-forms': resolve(__dirname, 'src/guide-forms.html'),
        'guide-adapters': resolve(__dirname, 'src/guide-adapters.html'),
      },
    },
  },
});
