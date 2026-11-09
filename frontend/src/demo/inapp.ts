import { useTransport } from '../shell/api';
import { start } from './engine/ready';
import { seed } from './engine/seed';
import { toB64 } from './engine/bytes';
import { apiUrl, request } from './transport';
import { catchDownloads } from './downloads';

const MEDIA = `${import.meta.env.BASE_URL}demos/studio/`;

async function packages(): Promise<Record<string, string>> {
  const names = (await (await fetch(`${MEDIA}packages.json`)).json()) as string[];
  const out: Record<string, string> = {};
  for (const name of names) {
    const res = await fetch(`${MEDIA}packages/${encodeURIComponent(name)}`);
    if (res.ok) out[name] = toB64(new Uint8Array(await res.arrayBuffer()));
  }
  return out;
}

export function install(): void {
  useTransport({
    url: apiUrl,
    async request(method, p, body) {
      const out = await request<Record<string, unknown> | null>(method, p, body);
      if (method === 'GET' && /^\/?(api\/)?health$/.test(p) && out) return { ...out, version: 'demo in this window', frontend: 'app' };
      return out;
    },
  });
  catchDownloads();
  start(async () => {
    window.__FORMEXT_PACKAGES__ = await packages().catch(() => ({}));
    await seed();
  });
}
