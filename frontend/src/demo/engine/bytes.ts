const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const loose = new TextDecoder('utf-8');

export function utf8(text: string): Uint8Array {
  return enc.encode(text);
}

export function text(data: Uint8Array): string {
  return loose.decode(data);
}

export function strictText(data: Uint8Array): string | null {
  try {
    return dec.decode(data);
  } catch {
    return null;
  }
}

export function toB64(data: Uint8Array): string {
  let out = '';
  const step = 0x8000;
  for (let i = 0; i < data.length; i += step) out += String.fromCharCode(...data.subarray(i, i + step));
  return btoa(out);
}

export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isB64(b64: string): boolean {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(b64.replace(/\s+/g, '')) && b64.replace(/\s+/g, '').length % 4 === 0;
}

function buf(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(data)));
}

export function hex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function shaHex(data: Uint8Array): Promise<string> {
  return hex(await sha256(data));
}

export async function shaB64(data: Uint8Array): Promise<string> {
  return toB64(await sha256(data));
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function arrayBuffer(data: Uint8Array): ArrayBuffer {
  return buf(data);
}

export function now(): number {
  return Date.now() / 1000;
}

export function ext(path: string): string {
  const name = path.split('/').pop() ?? '';
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '';
}

export function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

export function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return JSON.stringify(v);
}

export function pyJson(v: unknown): string {
  return JSON.stringify(v, null, 0).replace(/,(?=["\d[{tfn-])/g, ', ').replace(/":/g, '": ');
}

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}

export function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
