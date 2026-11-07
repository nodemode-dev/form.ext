import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const PORT = 5642;
const HERE = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND = resolve(HERE, '../frontend');
const SHELL = resolve(FRONTEND, 'src/shell');
const PUBLIC = resolve(FRONTEND, 'public');
const PACKAGES = [process.env.FORMEXT_DEMO_PACKAGES].find((p) => p && existsSync(p));
const ICONS = ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'];

function demo() {
  return {
    name: 'formext-demo',
    enforce: 'pre',
    resolveId(source, importer) {
      if (importer && importer.split('?')[0].startsWith(SHELL) && (source === './api' || source === './api.ts')) return resolve(HERE, 'src/api.ts');
      if (source === '@tauri-apps/api/core') return resolve(HERE, 'src/tauri.ts');
      return null;
    },
    transform(code, id) {
      const file = id.split('?')[0];
      if (file.endsWith('/frontend/src/styles/base.css')) return { code: code.replaceAll('url("/fonts/', 'url("../../public/fonts/'), map: null };
      return null;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace('src="/src/main.ts"', 'src="../demo/src/entry.ts"')
          .replace('body.app-ready #app { visibility: visible; }', 'body.app-ready.demo-ready #app { visibility: visible; }')
          .replace(/\s*<link rel="preload"[^>]*>/g, '');
      },
    },
  };
}

function finish() {
  return {
    name: 'formext-demo-finish',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/ crossorigin(="[^"]*")?/g, '')
          .replace(/<script type="module" src="([^"]+)"><\/script>/g, '<script src="./packs/packages.js"></script>\n  <script defer src="$1"></script>')
          .replace(/\b(src|href)="\/(?!\/)/g, '$1="./');
      },
    },
    generateBundle() {
      for (const name of ICONS) this.emitFile({ type: 'asset', fileName: name, source: readFileSync(join(PUBLIC, name)) });
      if (!PACKAGES) return;
      const packs = {};
      for (const name of readdirSync(PACKAGES).sort()) if (name.endsWith('.formpkg')) packs[name] = readFileSync(join(PACKAGES, name)).toString('base64');
      this.emitFile({ type: 'asset', fileName: 'packs/packages.js', source: `window.__FORMEXT_PACKAGES__=${JSON.stringify(packs)};\n` });
    },
  };
}

export default {
  root: FRONTEND,
  base: './',
  publicDir: false,
  plugins: [demo(), finish()],
  clearScreen: false,
  server: {
    port: PORT,
    host: false,
    strictPort: true,
    fs: { allow: [resolve(HERE, '..')] },
  },
  preview: {
    port: PORT + 1,
    host: false,
    strictPort: true,
  },
  build: {
    outDir: HERE,
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: false,
    minify: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 1000000,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: resolve(FRONTEND, 'index.html'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/formext.js',
        assetFileNames: 'assets/formext[extname]',
      },
    },
  },
};
