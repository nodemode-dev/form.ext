import { fromB64, now, toB64 } from './bytes';

interface Node {
  data: Uint8Array;
  mtime: number;
}

const KEY = 'formext.demo.disk';
const files = new Map<string, Node>();
let timer = 0;
let quiet = false;

export const HOME = '/home/demo';

function norm(path: string): string {
  const parts: string[] = [];
  for (const p of path.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return `/${parts.join('/')}`;
}

export function join(...parts: string[]): string {
  return norm(parts.filter(Boolean).join('/'));
}

function save(): void {
  if (quiet) return;
  clearTimeout(timer);
  timer = window.setTimeout(persist, 400);
}

function persist(): void {
  const out: Record<string, [string, number]> = {};
  for (const [k, v] of files) out[k] = [toB64(v.data), v.mtime];
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    return;
  }
}

export function restore(): boolean {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as Record<string, [string, number]>;
    for (const [k, [b64, mtime]] of Object.entries(data)) files.set(k, { data: fromB64(b64), mtime });
    return files.size > 0;
  } catch {
    files.clear();
    return false;
  }
}

export function forget(): void {
  files.clear();
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}

export function batch<T>(fn: () => T): T {
  quiet = true;
  try {
    return fn();
  } finally {
    quiet = false;
    save();
  }
}

export function isFile(path: string): boolean {
  return files.has(norm(path));
}

export function isDir(path: string): boolean {
  const p = norm(path);
  if (p === '/') return true;
  const prefix = `${p}/`;
  for (const k of files.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

export function exists(path: string): boolean {
  return isFile(path) || isDir(path);
}

export function read(path: string): Uint8Array | null {
  return files.get(norm(path))?.data ?? null;
}

export function mtime(path: string): number | null {
  const p = norm(path);
  const n = files.get(p);
  if (n) return n.mtime;
  let best: number | null = null;
  for (const [k, v] of files) if (k.startsWith(`${p}/`)) best = Math.max(best ?? 0, v.mtime);
  return best;
}

export function write(path: string, data: Uint8Array): number {
  const at = now();
  files.set(norm(path), { data: new Uint8Array(data), mtime: at });
  save();
  return at;
}

export function remove(path: string): number {
  const p = norm(path);
  let n = 0;
  if (files.delete(p)) n++;
  for (const k of [...files.keys()]) if (k.startsWith(`${p}/`)) files.delete(k), n++;
  if (n) save();
  return n;
}

export function move(from: string, to: string): void {
  const a = norm(from);
  const b = norm(to);
  const moved: [string, Node][] = [];
  for (const [k, v] of files) if (k === a || k.startsWith(`${a}/`)) moved.push([k, v]);
  for (const [k] of moved) files.delete(k);
  for (const [k, v] of moved) files.set(b + k.slice(a.length), { data: v.data, mtime: now() });
  save();
}

export function walk(dir: string): string[] {
  const p = norm(dir);
  const prefix = p === '/' ? '/' : `${p}/`;
  return [...files.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort();
}

export function children(dir: string): string[] {
  const set = new Set<string>();
  for (const rel of walk(dir)) set.add(rel.split('/')[0]);
  return [...set].sort();
}

export function size(path: string): number {
  return read(path)?.length ?? 0;
}
