import { ext as suffix, pyRepr, shaHex, strictText } from './bytes';
import { writeZip } from './zip';

export const PRODUCTS = ['formvis', 'formcut', 'formwav', 'formpdf', 'formdeck', 'formlit', 'formmd', 'formencoder', 'formvfx', 'formmcp', 'formtray', 'formskills', 'formportal'];
export const KINDS = ['effect-stack', 'wgsl-kernel', 'audio-chain', 'caption-look', 'lut', 'timeline-template', 'script-plugin', 'action-set', 'preset', 'theme', 'native-plugin'];
export const PERMISSIONS = ['document', 'files-read', 'files-write', 'network', 'models', 'native-code'];
export const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.cube': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
export const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
export const LOCAL_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
export const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 512;
const SKIP = new Set(['.DS_Store', 'Thumbs.db']);

export type Folder = Map<string, Uint8Array>;
export type Json = any;

export function readManifest(folder: Folder): { manifest: Json; error: string } {
  const raw = folder.get('manifest.json');
  if (!raw) return { manifest: null, error: "[Errno 2] No such file or directory: 'manifest.json'" };
  const t = strictText(raw);
  if (t === null) return { manifest: null, error: "'utf-8' codec can't decode the file" };
  try {
    return { manifest: JSON.parse(t), error: '' };
  } catch (e) {
    return { manifest: null, error: (e as Error).message };
  }
}

export function problems(folder: Folder): [string[], Json] {
  const out: string[] = [];
  const read = readManifest(folder);
  if (read.error) return [[`manifest.json: ${read.error}`], {}];
  const m = read.manifest;
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new TypeError('the manifest is not an object');
  const req = ['format', 'format_version', 'id', 'name', 'product', 'kind', 'version', 'author', 'licence', 'native', 'permissions'];
  for (const key of req) if (!(key in m)) out.push(`manifest.json: ${key} is required`);
  if (m.format !== 'formai-package') out.push('manifest.json: format must be formai-package');
  if (m.format_version !== 1) out.push('manifest.json: format_version must be 1');
  if (m.native === true) out.push('manifest.json: native extensions are not supported by API 1 hosts');
  const isObj = (v: unknown) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(m.entry ?? {})) {
    out.push('manifest.json: entry must be an object');
    m.entry = {};
  }
  if (!isObj(m.contributes ?? {})) {
    out.push('manifest.json: contributes must be an object');
    m.contributes = {};
  }
  for (const group of ['panels', 'commands']) {
    const items = (m.contributes || {})[group];
    if (items !== undefined && items !== null && (!Array.isArray(items) || items.some((i: unknown) => !isObj(i)))) {
      out.push(`manifest.json: contributes.${group} must be a list of objects`);
      m.contributes[group] = [];
    }
  }
  if (typeof ((m.entry || {}).ui ?? '') !== 'string') {
    out.push('manifest.json: entry.ui must be a path inside the package');
    m.entry = {};
  }
  if (!ID_RE.test(String(m.id ?? ''))) out.push('manifest.json: id must match ^[a-z0-9][a-z0-9-]{1,63}$');
  if (!PRODUCTS.includes(m.product)) out.push(`manifest.json: product must be one of ${PRODUCTS.join(', ')}`);
  if (!KINDS.includes(m.kind)) out.push(`manifest.json: kind must be one of ${KINDS.join(', ')}`);
  if (!VERSION_RE.test(String(m.version ?? ''))) out.push('manifest.json: version must be x.y.z');
  if (m.minimum_app !== undefined && m.minimum_app !== null && !VERSION_RE.test(String(m.minimum_app))) out.push('manifest.json: minimum_app must be x.y.z');
  if (typeof m.native !== 'boolean') out.push('manifest.json: native must be true or false');
  const perms = m.permissions;
  if (!Array.isArray(perms) || perms.some((p: unknown) => !PERMISSIONS.includes(p as string)) || new Set(perms).size !== perms.length) out.push(`manifest.json: permissions must be unique values from ${PERMISSIONS.join(', ')}`);
  if (m.api !== '1') out.push('manifest.json: api must be "1" (every API 1 host refuses a package without it)');
  const contributes = m.contributes || {};
  const entry = (m.entry || {}).ui;
  for (const group of ['panels', 'commands']) {
    for (const item of contributes[group] || []) {
      if (!LOCAL_RE.test(String(item.id ?? ''))) out.push(`manifest.json: contributes.${group} id ${pyRepr(item.id)} must match ^[a-z0-9][a-z0-9-]{0,31}$`);
      if (!item.title) out.push(`manifest.json: contributes.${group} ${pyRepr(item.id)} needs a title`);
    }
  }
  const panelIds = new Set((contributes.panels || []).map((p: Json) => p.id));
  for (const c of contributes.commands || []) {
    if (c.panel && !panelIds.has(c.panel)) out.push(`manifest.json: command ${pyRepr(c.id)} names panel ${pyRepr(c.panel)}, which is not contributed`);
  }
  if (((contributes.panels || []).length || (contributes.commands || []).length) && !entry) out.push('manifest.json: entry.ui is required when panels or commands are contributed');
  if (entry && (String(entry).includes('\\') || ['', '.'].includes(String(entry).split('/').pop() ?? '') || !folder.has(normRel(entry)))) out.push(`manifest.json: entry.ui ${entry} is not a file in the folder`);
  return [out, m];
}

export function normRel(rel: string): string {
  const parts: string[] = [];
  for (const p of String(rel).split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') return `../${rel}`;
    parts.push(p);
  }
  return parts.join('/');
}

export function filesOf(folder: Folder): [string[], string[]] {
  const out: string[] = [];
  const errs: string[] = [];
  for (const rel of [...folder.keys()].sort()) {
    const parts = rel.split('/');
    if (parts.some((p) => p.startsWith('.')) || SKIP.has(parts[parts.length - 1])) continue;
    const s = suffix(rel);
    if (!(s in TYPES)) {
      errs.push(`${rel}: the file type ${s || '(none)'} is not allowed`);
      continue;
    }
    if (rel.length > 200) {
      errs.push(`${rel}: the path is longer than 200 characters`);
      continue;
    }
    out.push(rel);
  }
  if (out.length > MAX_FILES) errs.push(`${out.length} files; at most ${MAX_FILES}`);
  return [out, errs];
}

export class KitRefused extends Error {}

export async function build(folder: Folder): Promise<{ file: string; data: Uint8Array; sha256: string; bytes: number; manifest: Json }> {
  let [errs, m] = problems(folder);
  const [files, ferrs] = filesOf(folder);
  errs = errs.concat(ferrs);
  if (errs.length) throw new KitRefused(`refused: ${errs.join('; ')}`);
  const data = await writeZip(files.slice().sort().map((rel) => ({ path: rel, data: folder.get(rel)! })));
  if (data.length > MAX_BYTES) throw new KitRefused(`refused: ${data.length} bytes; at most ${MAX_BYTES}`);
  return { file: `${m.id}-${m.version}.formpkg`, data, sha256: await shaHex(data), bytes: data.length, manifest: m };
}

export function entry(m: Json, url: string, digest: string, size: number): Json {
  const e: Json = {};
  for (const k of ['id', 'name', 'product', 'kind', 'author', 'version', 'licence', 'native', 'permissions']) e[k] = m[k];
  e.description = m.description || m.name;
  e.url = url;
  e.sha256 = digest;
  e.bytes = size;
  for (const k of ['minimum_app', 'api', 'homepage', 'support']) if (m[k]) e[k] = m[k];
  return e;
}

export interface Extension {
  id: string;
  version: string;
  source: string;
  path: string;
  name: string;
  kind: string;
  description: string;
  permissions: string[];
  entry_ui: string;
  panels: Json[];
  commands: Json[];
  state: 'ready' | 'refused';
  reason: string;
}

export function extension(id: string, version: string, source: string, path: string): Extension {
  return { id, version, source, path, name: '', kind: '', description: '', permissions: [], entry_ui: '', panels: [], commands: [], state: 'ready', reason: '' };
}

export function publicRecord(e: Extension, base: string): Json {
  return {
    id: e.id,
    name: e.name || e.id,
    version: e.version,
    kind: e.kind,
    source: e.source,
    description: e.description,
    permissions: e.permissions,
    base: `${base}/${e.id}/${e.version}/`,
    entryUi: e.entry_ui,
    panels: e.panels,
    commands: e.commands,
    path: e.source === 'development' ? e.path : null,
    state: e.state,
    reason: e.reason,
  };
}

function versionTuple(v: string): number[] {
  const parts = v.split('.').slice(0, 3).map((p) => Number(p));
  return parts.some((p) => !Number.isInteger(p)) ? [0, 0, 0] : parts;
}

function newer(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) return x > y;
  }
  return false;
}

export function safeRel(rel: string): boolean {
  return Boolean(rel) && !rel.startsWith('/') && !rel.includes('\\') && !rel.split('/').includes('..') && rel.length <= 200;
}

export function check(e: Extension, folder: Folder | null, product: string, appVersion: string, appName: string): Extension {
  const refuse = (reason: string) => {
    e.state = 'refused';
    e.reason = reason;
    return e;
  };
  const read = folder ? readManifest(folder) : { manifest: null, error: 'missing' };
  const manifest = read.manifest;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return refuse('its manifest.json is missing or not valid JSON');
  if (manifest.format !== 'formai-package' || manifest.format_version !== 1) return refuse('it is not a formai package');
  e.name = String(manifest.name || e.id).slice(0, 80);
  e.kind = String(manifest.kind || '');
  e.description = String(manifest.description || '').slice(0, 400);
  if (e.source === 'development' && VERSION_RE.test(String(manifest.version ?? ''))) e.version = String(manifest.version);
  if (manifest.id !== e.id) return refuse(`its manifest says ${pyRepr(manifest.id)}, not ${pyRepr(e.id)}`);
  if (manifest.product !== product) return refuse(`it is made for ${manifest.product ?? 'None'}, not ${appName}`);
  if (String(manifest.version ?? '') !== e.version && e.source !== 'development') return refuse(`its manifest says version ${manifest.version}, FormPortal says ${e.version}`);
  e.version = String(manifest.version || e.version);
  if (!VERSION_RE.test(e.version)) return refuse('its version is not x.y.z');
  if (manifest.api !== '1') return refuse(`it needs extension API ${manifest.api ?? 'None'}; this ${appName} offers API 1`);
  if (manifest.native) return refuse(`native extensions are not supported by ${appName}`);
  const perms = manifest.permissions || [];
  if (!Array.isArray(perms) || perms.some((p: unknown) => !PERMISSIONS.includes(p as string))) return refuse('it asks for a permission that does not exist');
  e.permissions = [...new Set(perms as string[])];
  const minimum = manifest.minimum_app;
  if (minimum && newer(versionTuple(String(minimum)), versionTuple(appVersion))) return refuse(`it needs ${appName} ${minimum} or newer`);
  const entryObj = manifest.entry && typeof manifest.entry === 'object' && !Array.isArray(manifest.entry) ? manifest.entry : {};
  const ui = entryObj.ui ?? '';
  if (typeof ui !== 'string') return refuse('its entry.ui is not a path inside the package');
  const contributes = manifest.contributes && typeof manifest.contributes === 'object' && !Array.isArray(manifest.contributes) ? manifest.contributes : {};
  const ok = (x: Json) => x && typeof x === 'object' && LOCAL_RE.test(String(x.id ?? '')) && x.title;
  const panels = (Array.isArray(contributes.panels) ? contributes.panels : []).filter(ok);
  const commands = (Array.isArray(contributes.commands) ? contributes.commands : []).filter(ok);
  if ((panels.length || commands.length) && !ui) return refuse('it contributes panels or commands but has no entry.ui');
  if (ui) {
    if (!safeRel(ui)) return refuse('its entry.ui is not a path inside the package');
    if (['', '.'].includes(ui.split('/').pop() ?? '') || !folder!.has(normRel(ui))) return refuse(`its entry.ui ${ui} is not in the package`);
  }
  e.entry_ui = ui;
  e.panels = panels.map((p: Json) => ({ id: p.id, title: String(p.title).slice(0, 60), location: p.location === 'dock' || p.location === 'dialog' ? p.location : 'dock' }));
  e.commands = commands.map((c: Json) => ({ id: c.id, title: String(c.title).slice(0, 80), ...(c.panel ? { panel: c.panel } : {}) }));
  return e;
}

export function cspFor(base = ''): string {
  const src = /^(https?:\/\/|formext:\/\/)/.test(base) ? base : "'self'";
  return `default-src 'none'; script-src ${src} 'wasm-unsafe-eval'; style-src ${src} 'unsafe-inline'; img-src ${src} data: blob:; media-src ${src} data: blob:; font-src ${src}; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
}

export const PERMISSION_WORDS: Record<string, string> = {
  document: 'Read and change the open document',
  'files-read': 'Open files you choose',
  'files-write': 'Save files where you choose',
  network: 'Reach the internet',
  models: 'Use local models',
  'native-code': 'Run native code',
};

export const PLAIN: Record<string, string> = {
  document: 'read and change the open document',
  'files-read': 'open files you choose',
  'files-write': 'save files where you choose',
  network: 'reach the internet',
  models: 'use local models',
  'native-code': 'run native code',
};
