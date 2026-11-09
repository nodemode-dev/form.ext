import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, 'demo/packs/packages.js');
const OUT = join(ROOT, 'frontend/public/demos/studio');
const PACKAGES = join(OUT, 'packages');

const text = readFileSync(PACK, 'utf8');
const m = text.match(/^window\.__FORMEXT_PACKAGES__=(\{.*\});\s*$/s);
if (!m) throw new Error(`${PACK} does not hold window.__FORMEXT_PACKAGES__`);
const packs = JSON.parse(m[1]);

rmSync(PACKAGES, { recursive: true, force: true });
mkdirSync(PACKAGES, { recursive: true });
const names = Object.keys(packs).filter((n) => /^[a-z0-9][a-z0-9.-]*\.formpkg$/.test(n)).sort();
for (const name of names) writeFileSync(join(PACKAGES, name), Buffer.from(packs[name], 'base64'));
writeFileSync(join(OUT, 'packages.json'), `${JSON.stringify(names, null, 2)}\n`);

const bytes = readdirSync(PACKAGES).reduce((n, f) => n + readFileSync(join(PACKAGES, f)).length, 0);
console.log(`${names.length} packages, ${bytes} bytes, in ${OUT}`);
