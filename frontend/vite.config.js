import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: process.env.API_TARGET || 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
});
