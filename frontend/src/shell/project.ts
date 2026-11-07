import { api, ApiError } from './api';
import { emit, on } from './events';
import { storage } from './storage';
import type { ProjectRef } from './types';

const KEY = 'formext.project';
let current: ProjectRef | null = null;
const subs = new Set<(p: ProjectRef | null) => void>();

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function toProjectRef(raw: unknown, fallbackId = ''): ProjectRef {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const body = (r.project && typeof r.project === 'object' ? r.project : r) as Record<string, unknown>;
  const manifest = (body.manifest && typeof body.manifest === 'object' ? body.manifest : {}) as Record<string, unknown>;
  return {
    id: str(body.id) || fallbackId,
    name: str(body.name) || str(manifest.name) || str(manifest.id) || fallbackId,
    product: str(body.product) || str(manifest.product),
    dir: str(body.dir) || str(body.path),
    manifest,
  };
}

function publish(next: ProjectRef | null): void {
  current = next;
  if (next) storage.set(KEY, next.id);
  else storage.remove(KEY);
  for (const cb of [...subs]) {
    try {
      cb(next);
    } catch (err) {
      console.error(err);
    }
  }
  emit('shell.project', next);
}

async function fetchRef(id: string): Promise<ProjectRef> {
  return toProjectRef(await api.get<unknown>(`/api/projects/${encodeURIComponent(id)}`), id);
}

export async function open(id: string): Promise<void> {
  if (!id) {
    publish(null);
    return;
  }
  const ref = await fetchRef(id);
  publish(ref);
}

export function close(): void {
  publish(null);
}

export async function refresh(): Promise<void> {
  if (!current) return;
  const id = current.id;
  try {
    const ref = await fetchRef(id);
    if (current?.id !== id) return;
    const same = ref.name === current.name && ref.product === current.product && ref.dir === current.dir && JSON.stringify(ref.manifest) === JSON.stringify(current.manifest);
    if (!same) publish(ref);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && current?.id === id) publish(null);
  }
}

export async function restore(): Promise<void> {
  const id = storage.get(KEY);
  if (!id) return;
  try {
    await open(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) storage.remove(KEY);
  }
}

let pending = 0;
on('project.changed', (data: any) => {
  if (!current) return;
  const id = data?.id ?? data?.project ?? data?.project_id;
  if (id && id !== current.id) return;
  clearTimeout(pending);
  pending = window.setTimeout(refresh, 120);
});
on('project.deleted', (data: any) => {
  const id = data?.id ?? data?.project;
  if (current && id === current.id) publish(null);
});

export const project = {
  current: () => current,
  onChange(cb: (p: ProjectRef | null) => void): () => void {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  },
  open,
};
