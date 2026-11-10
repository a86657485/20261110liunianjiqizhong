import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
    outDir: 'dist',
    sourcemap: false,
    cssTarget: 'chrome87',
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8830',
      '/assets/recall': 'http://127.0.0.1:8830',
    },
  },
});
