import { emit } from '../../../frontend/src/shell/events';
import { now, strictText, text, utf8 } from './bytes';
import { bad, conflict, notFound } from './errors';
import type { Folder, Json } from './kit';
import * as fs from './vfs';
import { settings } from './settings';

export const PRODUCTS = ['formvis', 'formcut', 'formwav', 'formpdf', 'formdeck', 'formlit', 'formmd', 'formencoder', 'formvfx', 'formmcp', 'formtray', 'formskills', 'formportal'];
export const DATA = `${fs.HOME}/.local/share/ai.nodemode.formext`;
export const PROJECTS = `${DATA}/projects`;
const INDEX = `${DATA}/projects.json`;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HIDDEN = new Set(['.git', '.formext', 'node_modules', '__pycache__', '.DS_Store', 'Thumbs.db', '.venv', 'venv']);
const MAX_FILE = 50 * 1024 * 1024;

export const dataDir = (name: string) => `${DATA}/${name}`;

export function slug(t: string): string {
  let out = (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  out = out.slice(0, 48).replace(/^-+|-+$/g, '');
  if (out.length < 2) out = `${out}-extension`.replace(/^-+|-+$/g, '');
  return out;
}

export function cleanRel(rel: string): string {
  if (typeof rel !== 'string' || !rel || rel.includes('\x00')) throw bad('invalid path');
  const t = rel.replace(/\\/g, '/');
  if (t.startsWith('/') || /^[A-Za-z]:/.test(t)) throw bad('absolute paths are not allowed');
  const parts = t.split('/').filter((p) => p && p !== '.');
  if (!parts.length || parts.includes('..')) throw bad('path leaves the project');
  if (parts.join('/').length > 400) throw bad('path is too long');
  return parts.join('/');
}

function readJson(path: string): Json {
  const raw = fs.read(path);
  if (!raw) return null;
  try {
    return JSON.parse(text(raw));
  } catch {
    return null;
  }
}

interface Index {
  linked: Record<string, string>;
  recent: string[];
  meta: Record<string, Json>;
}

function index(): Index {
  const d = readJson(INDEX);
  const data = d && typeof d === 'object' ? d : {};
  return { linked: data.linked ?? {}, recent: data.recent ?? [], meta: data.meta ?? {} };
}

function saveIndex(d: Index): void {
  fs.write(INDEX, utf8(JSON.stringify(d, null, 2)));
}

function writeJson(path: string, value: unknown): void {
  fs.write(path, utf8(`${JSON.stringify(value, null, 2)}\n`));
}

export { readJson, writeJson };

class Workspace {
  ids(): string[] {
    const ids = fs.children(PROJECTS).filter((n) => ID_RE.test(n) && fs.isDir(`${PROJECTS}/${n}`));
    for (const [pid, folder] of Object.entries(index().linked)) if (!ids.includes(pid) && fs.isDir(folder)) ids.push(pid);
    return ids;
  }

  uniqueId(base: string): string {
    const taken = new Set([...this.ids(), ...Object.keys(index().linked)]);
    let candidate = slug(base);
    let n = 2;
    while (taken.has(candidate) || fs.exists(`${PROJECTS}/${candidate}`)) candidate = `${slug(base).slice(0, 44)}-${n++}`;
    return candidate;
  }

  exists(pid: string): boolean {
    try {
      this.dir(pid);
      return true;
    } catch {
      return false;
    }
  }

  dir(pid: string): string {
    if (typeof pid !== 'string' || !ID_RE.test(pid)) throw notFound('no such project');
    const linked = index().linked[pid];
    if (linked) {
      if (fs.isDir(linked)) return linked;
      throw notFound(`the folder of ${pid} is gone: ${linked}`);
    }
    const folder = `${PROJECTS}/${pid}`;
    if (fs.isDir(folder)) return folder;
    throw notFound(`no such project: ${pid}`);
  }

  packagePrefix(pid: string): string {
    const root = this.dir(pid);
    if (fs.isFile(`${root}/package/manifest.json`) || !fs.isFile(`${root}/manifest.json`)) return 'package';
    return '';
  }

  packageDir(pid: string): string {
    const p = this.packagePrefix(pid);
    const root = this.dir(pid);
    return p ? `${root}/${p}` : root;
  }

  manifest(pid: string): Json {
    const d = readJson(`${this.packageDir(pid)}/manifest.json`);
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  }

  folder(pid: string): Folder {
    return folderAt(this.packageDir(pid));
  }

  get(pid: string): Json {
    const root = this.dir(pid);
    const prefix = this.packagePrefix(pid);
    const mpath = prefix ? `${root}/${prefix}/manifest.json` : `${root}/manifest.json`;
    let raw: Json = null;
    let error: string | null = null;
    const data = fs.read(mpath);
    if (data) {
      try {
        raw = JSON.parse(strictText(data) ?? '');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          error = 'manifest.json is not an object';
          raw = null;
        }
      } catch (e) {
        error = `manifest.json is not valid JSON: ${(e as Error).message}`;
      }
    } else error = 'manifest.json is missing';
    const manifest = raw || {};
    const idx = index();
    const meta = idx.meta[pid] ?? {};
    return {
      id: pid,
      name: manifest.name || meta.name || pid,
      product: manifest.product || meta.product || '',
      version: manifest.version || '',
      dir: root,
      package_dir: prefix ? `${root}/${prefix}` : root,
      package_prefix: prefix,
      manifest,
      manifest_error: error,
      linked: pid in idx.linked,
      created: meta.created ?? null,
      opened: meta.opened ?? null,
      modified: fs.mtime(root) ?? now(),
    };
  }

  projects(): Json[] {
    const out: Json[] = [];
    for (const pid of this.ids()) {
      try {
        out.push(this.get(pid));
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => (b.modified || 0) - (a.modified || 0));
  }

  recent(limit = 12): Json[] {
    const out: Json[] = [];
    for (const pid of index().recent) {
      try {
        out.push(this.get(pid));
      } catch {
        continue;
      }
      if (out.length >= limit) break;
    }
    return out;
  }

  touch(pid: string): void {
    this.dir(pid);
    const idx = index();
    idx.recent = [pid, ...idx.recent.filter((r) => r !== pid).slice(0, 49)];
    idx.meta[pid] = { ...(idx.meta[pid] ?? {}), opened: now() };
    saveIndex(idx);
  }

  private record(pid: string, name: string, product: string, linked?: string): void {
    const idx = index();
    idx.meta[pid] = { name, product, created: now(), opened: now() };
    if (linked) idx.linked[pid] = linked;
    idx.recent = [pid, ...idx.recent.filter((r) => r !== pid).slice(0, 49)];
    saveIndex(idx);
  }

  create(name: string, product: string, files: Record<string, Uint8Array> = {}): Json {
    name = (name || '').trim();
    if (!name) throw bad('a project needs a name');
    if (!PRODUCTS.includes(product)) throw bad(`unknown product: ${product}`);
    let entries = Object.entries(files);
    if (entries.length && !entries.some(([k]) => cleanRel(k).startsWith('package/'))) entries = entries.map(([k, v]) => [`package/${cleanRel(k)}`, v]);
    const pid = this.uniqueId(name);
    const root = `${PROJECTS}/${pid}`;
    fs.batch(() => {
      for (const [rel, data] of entries) fs.write(`${root}/${cleanRel(rel)}`, data);
      if (!fs.isFile(`${root}/package/manifest.json`)) writeJson(`${root}/package/manifest.json`, this.starter(pid, name, product));
    });
    this.record(pid, name, product);
    const project = this.get(pid);
    emit('project.created', { id: pid, project });
    return project;
  }

  private starter(pid: string, name: string, product: string): Json {
    return { format: 'formai-package', format_version: 1, id: pid, name, product, kind: 'script-plugin', version: '0.1.0', author: settings.value('author') || 'me', licence: settings.value('licence') || 'Apache-2.0', native: false, permissions: [], api: '1', description: '' };
  }

  importFolder(path: string, link = false, name?: string | null): Json {
    const source = String(path || '').trim().replace(/^~(?=\/|$)/, fs.HOME).replace(/\/+$/, '');
    if (!source.startsWith('/') || !fs.isDir(source)) throw notFound(`no such folder: ${path}. The demo's disk holds ${fs.HOME}/Extensions/hello (the contract kit's example); open that one, import a .formpkg, or start from New.`);
    let pkgRoot: string;
    let layout: string;
    if (fs.isFile(`${source}/package/manifest.json`)) [pkgRoot, layout] = [`${source}/package`, 'project'];
    else if (fs.isFile(`${source}/manifest.json`)) [pkgRoot, layout] = [source, 'package'];
    else throw bad('the folder has no manifest.json (at its root or in package/)');
    const manifest = readJson(`${pkgRoot}/manifest.json`);
    if (!manifest || typeof manifest !== 'object') throw bad('manifest.json is not valid JSON');
    const title = name || manifest.name || source.split('/').pop() || 'project';
    const product = manifest.product || '';
    for (const [pid, folder] of Object.entries(index().linked)) {
      if (link && folder === source) {
        this.touch(pid);
        return this.get(pid);
      }
    }
    const pid = this.uniqueId(manifest.id || title);
    if (link) this.record(pid, title, product, source);
    else {
      const root = `${PROJECTS}/${pid}`;
      const target = layout === 'project' ? root : `${root}/package`;
      fs.batch(() => {
        for (const rel of fs.walk(source)) {
          if (rel.split('/').some((p) => HIDDEN.has(p))) continue;
          fs.write(`${target}/${rel}`, fs.read(`${source}/${rel}`)!);
        }
      });
      this.record(pid, title, product);
    }
    const project = this.get(pid);
    emit('project.created', { id: pid, project });
    return project;
  }

  remove(pid: string): Json {
    const root = this.dir(pid);
    const idx = index();
    let result: Json;
    if (pid in idx.linked) {
      delete idx.linked[pid];
      result = { id: pid, removed: 'link', dir: root };
    } else {
      const dest = `${DATA}/trash/${pid}-${Math.floor(now())}`;
      fs.move(root, dest);
      result = { id: pid, removed: 'trash', dir: dest };
    }
    delete idx.meta[pid];
    idx.recent = idx.recent.filter((r) => r !== pid);
    saveIndex(idx);
    emit('project.deleted', { id: pid });
    return result;
  }

  listFiles(pid: string): Json[] {
    const root = this.dir(pid);
    const prefix = this.packagePrefix(pid);
    return fs
      .walk(root)
      .filter((rel) => !rel.split('/').some((p) => HIDDEN.has(p)))
      .map((rel) => ({ path: rel, size: fs.size(`${root}/${rel}`), modified: fs.mtime(`${root}/${rel}`), package: !prefix || rel.startsWith(`${prefix}/`) }));
  }

  read(pid: string, rel: string): Uint8Array {
    const clean = cleanRel(rel);
    const data = fs.read(`${this.dir(pid)}/${clean}`);
    if (!data) throw notFound(fs.isDir(`${this.dir(pid)}/${clean}`) ? `not a file: ${clean}` : `no such file: ${clean}`);
    return data;
  }

  mtime(pid: string, rel: string): number {
    return fs.mtime(`${this.dir(pid)}/${cleanRel(rel)}`) ?? now();
  }

  private changed(pid: string, rels: string[], kind: string): void {
    const prefix = this.packagePrefix(pid);
    const mrel = prefix ? `${prefix}/manifest.json` : 'manifest.json';
    const data: Json = { id: pid, paths: rels, kind, source: 'engine' };
    if (rels.includes(mrel)) data.manifest = this.manifest(pid);
    emit('project.changed', data);
  }

  write(pid: string, rel: string, data: Uint8Array): Json {
    const clean = cleanRel(rel);
    if (data.length > MAX_FILE) throw bad('the file is larger than 50 MB');
    const target = `${this.dir(pid)}/${clean}`;
    if (fs.isDir(target)) throw conflict(`a folder is at ${clean}`);
    const at = fs.write(target, data);
    this.changed(pid, [clean], 'write');
    return { path: clean, size: data.length, modified: at };
  }

  delete(pid: string, rel: string): Json {
    const clean = cleanRel(rel);
    const target = `${this.dir(pid)}/${clean}`;
    if (!fs.exists(target)) throw notFound(`no such file: ${clean}`);
    fs.remove(target);
    this.changed(pid, [clean], 'delete');
    return { path: clean, deleted: true };
  }

  move(pid: string, src: string, dst: string): Json {
    const a = cleanRel(src);
    const b = cleanRel(dst);
    const root = this.dir(pid);
    if (!fs.exists(`${root}/${a}`)) throw notFound(`no such file: ${a}`);
    if (fs.exists(`${root}/${b}`)) throw conflict(`${b} already exists`);
    fs.move(`${root}/${a}`, `${root}/${b}`);
    this.changed(pid, [a, b], 'move');
    return { from: a, to: b };
  }
}

export function folderAt(dir: string): Folder {
  const out: Folder = new Map();
  for (const rel of fs.walk(dir)) out.set(rel, fs.read(`${dir}/${rel}`)!);
  return out;
}

export const workspace = new Workspace();
