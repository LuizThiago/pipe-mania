import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@view': path.resolve(__dirname, 'src/view'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@pixijs': path.resolve(__dirname, 'src/pixi'),
    },
  },
});
