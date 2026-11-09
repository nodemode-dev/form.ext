export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export interface Transport {
  request(method: string, p: string, body?: unknown): Promise<unknown>;
  url(p: string): string;
}

let transport: Transport | null = null;

export function useTransport(t: Transport): void {
  transport = t;
}

export function apiUrl(p: string): string {
  if (transport) return transport.url(p);
  if (/^https?:\/\//.test(p)) return p;
  if (p.startsWith('/api/') || p === '/api') return p;
  if (p.startsWith('/')) return `/api${p}`;
  return `/api/${p}`;
}

function encodeBody(body: unknown): { body?: BodyInit; type?: string } {
  if (body === undefined) return {};
  if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) return { body };
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return { body: body as BodyInit, type: 'application/octet-stream' };
  if (typeof body === 'string') return { body, type: 'text/plain; charset=utf-8' };
  return { body: JSON.stringify(body), type: 'application/json' };
}

function messageOf(status: number, detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail) return detail;
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    if (typeof d.detail === 'string') return d.detail;
    if (typeof d.message === 'string') return d.message;
    if (Array.isArray(d.detail) && d.detail.length) {
      const first = d.detail[0] as Record<string, unknown>;
      if (typeof first?.msg === 'string') return first.msg;
    }
    if (d.detail && typeof d.detail === 'object' && typeof (d.detail as Record<string, unknown>).message === 'string') return (d.detail as Record<string, string>).message;
  }
  if (status === 0) return 'The engine is not reachable.';
  return fallback || `Request failed (${status})`;
}

const TEXTUAL = /^(text\/|application\/(javascript|xml|x-yaml|yaml|toml)|image\/svg\+xml)/;

export async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('json')) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  if (TEXTUAL.test(type)) return res.text();
  return res.arrayBuffer();
}

export async function request<T>(method: string, p: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  if (transport) return transport.request(method, p, body) as Promise<T>;
  const { body: payload, type } = encodeBody(body);
  const headers = new Headers(init.headers);
  if (type && !headers.has('content-type')) headers.set('content-type', type);
  if (!headers.has('accept')) headers.set('accept', 'application/json, text/plain, */*');
  let res: Response;
  try {
    res = await fetch(apiUrl(p), { ...init, method, headers, body: payload });
  } catch (err) {
    throw new ApiError(0, messageOf(0, null, ''), err);
  }
  let data: unknown = null;
  try {
    data = await readBody(res);
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError(res.status, messageOf(res.status, data, res.statusText), data);
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
};

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
