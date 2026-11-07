import { defineConfig } from 'vite';

const FRONTEND_PORT = 5640;
const BACKEND_PORT = Number(process.env.FORMEXT_BACKEND_PORT) || 8640;
const proxy = {
  '/api': { target: `http://127.0.0.1:${BACKEND_PORT}`, changeOrigin: true, ws: true },
};

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.FORMEXT_BASE || '/',
  server: {
    port: FRONTEND_PORT,
    host: false,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy,
  },
  preview: {
    port: FRONTEND_PORT + 1,
    host: false,
    strictPort: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
});
