import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CropImage',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'crop-image.js';
        if (format === 'cjs') return 'crop-image.cjs';
        return 'crop-image.iife.js';
      },
    },
  },
});
