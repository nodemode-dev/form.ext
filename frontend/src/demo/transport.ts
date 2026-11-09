import { ApiError } from '../shell/api';
import { dispatch } from './engine/router';
import { ready } from './engine/ready';
import { arrayBuffer, toB64 } from './engine/bytes';
import { TYPES } from './engine/kit';
import { workspace } from './engine/workspace';

function normal(p: string): string {
  return /^https?:\/\//.test(p) ? p : p.startsWith('/api/') || p === '/api' ? p : p.startsWith('/') ? `/api${p}` : `/api/${p}`;
}

export function apiUrl(p: string): string {
  const path = normal(p);
  const m = path.match(/^\/api\/projects\/([^/]+)\/files\/(.+)$/);
  if (m) {
    try {
      const rel = m[2].split('/').map(decodeURIComponent).join('/');
      const data = workspace.read(decodeURIComponent(m[1]), rel);
      const s = rel.slice(rel.lastIndexOf('.')).toLowerCase();
      return `data:${(TYPES[s] ?? 'application/octet-stream').split(';')[0]};base64,${toB64(data)}#`;
    } catch {
      return 'data:,#';
    }
  }
  return path;
}

function messageOf(status: number, detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail) return detail;
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.detail === 'string') return d.detail;
    if (typeof d.message === 'string') return d.message;
  }
  if (status === 0) return 'The engine is not reachable.';
  return fallback || `Request failed (${status})`;
}

let inflight = 0;
const idle = new Set<() => void>();

export function pending(): number {
  return inflight;
}

export function whenIdle(): Promise<void> {
  return inflight === 0 ? Promise.resolve() : new Promise((r) => idle.add(r));
}

function settle(): void {
  inflight--;
  if (inflight === 0) for (const r of [...idle]) idle.delete(r), r();
}

export async function request<T>(method: string, p: string, body?: unknown): Promise<T> {
  inflight++;
  try {
    await ready;
    const url = new URL(normal(p), 'http://engine.invalid');
    const res = await dispatch({ method, path: url.pathname, query: url.searchParams, body });
    const out = res.body as Record<string, unknown> | null;
    if (res.status >= 400) throw new ApiError(res.status, messageOf(res.status, out, ''), JSON.parse(JSON.stringify(out)));
    if (out && typeof out === 'object' && out.__raw instanceof Uint8Array) return arrayBuffer(out.__raw) as T;
    return (out === undefined ? null : JSON.parse(JSON.stringify(out))) as T;
  } finally {
    settle();
  }
}
