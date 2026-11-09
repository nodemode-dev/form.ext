import { ext as suffix, shaB64, text, toB64, utf8 } from './bytes';
import { HttpError } from './errors';
import * as kit from './kit';
import type { Folder, Json } from './kit';
import { workspace } from './workspace';

const SCRIPT = new Set(['.js', '.mjs']);
const MAX_URL = 2 * 1024 * 1024 - 1024;
const SPEC = /(\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?|\bexport\s*(?:[\w*{}\s,$]+?\s*from\s*)|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g;

function resolve(from: string, ref: string): string | null {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  const parts = clean.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const p of clean.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(p);
  }
  return parts.join('/');
}

function dataUrl(rel: string, data: Uint8Array): string {
  const type = kit.TYPES[suffix(rel)] ?? 'application/octet-stream';
  return `data:${type.split(';')[0]};base64,${toB64(data)}`;
}

export interface FrameDocument {
  html: string;
  csp: string;
  modules: number;
}

export async function frameDocument(folder: Folder, entry: string, id: string, version: string): Promise<FrameDocument> {
  const vbase = `https://package.formext.invalid/${id}/${version}/`;
  const hashes: string[] = [];
  const imports: Record<string, string> = {};
  const integrity: Record<string, string> = {};
  for (const [rel, data] of folder) {
    if (!SCRIPT.has(suffix(rel))) continue;
    const src = text(data).replace(SPEC, (all, lead: string, q: string, ref: string) => {
      if (!/^\.{0,2}\//.test(ref)) return all;
      const target = resolve(rel, ref);
      return target && folder.has(target) ? `${lead}${q}${vbase}${target}${q}` : all;
    });
    const bytes = utf8(src);
    const url = `data:text/javascript;base64,${toB64(bytes)}`;
    const hash = `sha256-${await shaB64(bytes)}`;
    imports[vbase + rel] = url;
    integrity[url] = hash;
    hashes.push(`'${hash}'`);
  }
  const doc = new DOMParser().parseFromString(text(folder.get(entry)!), 'text/html');
  const inline = async (code: string, type: string) => {
    const s = doc.createElement('script');
    if (type) s.type = type;
    s.textContent = code;
    hashes.push(`'sha256-${await shaB64(utf8(code))}'`);
    return s;
  };
  const cssText = (css: string, from: string) =>
    css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q: string, ref: string) => {
      const target = resolve(from, ref.trim());
      return target && folder.has(target) ? `url(${q}${dataUrl(target, folder.get(target)!)}${q})` : all;
    });
  for (const el of [...doc.querySelectorAll<HTMLScriptElement>('script[src]')]) {
    const target = resolve(entry, el.getAttribute('src') ?? '');
    if (!target || !folder.has(target) || !SCRIPT.has(suffix(target))) continue;
    const module = (el.getAttribute('type') ?? '').toLowerCase() === 'module';
    const next = module ? await inline(`import ${JSON.stringify(vbase + target)};`, 'module') : await inline(text(folder.get(target)!), el.getAttribute('type') ?? '');
    el.replaceWith(next);
  }
  for (const el of [...doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')]) {
    const target = resolve(entry, el.getAttribute('href') ?? '');
    if (!target || !folder.has(target)) continue;
    const style = doc.createElement('style');
    style.textContent = cssText(text(folder.get(target)!), target);
    el.replaceWith(style);
  }
  for (const el of [...doc.querySelectorAll('style')]) el.textContent = cssText(el.textContent ?? '', entry);
  for (const el of [...doc.querySelectorAll('[src], [poster], link[rel~="icon"][href]')]) {
    if (el.tagName === 'SCRIPT') continue;
    for (const attr of ['src', 'poster', 'href']) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const target = resolve(entry, v);
      if (target && folder.has(target)) el.setAttribute(attr, dataUrl(target, folder.get(target)!));
    }
  }
  const map = JSON.stringify({ imports, integrity });
  const head = doc.head;
  const importmap = await inline(map, 'importmap');
  const finalCsp = `default-src 'none'; script-src ${hashes.join(' ')} 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
  const meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = finalCsp;
  head.prepend(importmap);
  head.prepend(meta);
  const charset = doc.querySelector('meta[charset]');
  if (charset) head.prepend(charset);
  return { html: `<!doctype html>\n${doc.documentElement.outerHTML}`, csp: finalCsp, modules: Object.keys(imports).length };
}

export async function record(pid: string, product: string | null, app: string | null, appVersion: string | null): Promise<Json> {
  const folder = workspace.folder(pid);
  const manifest = workspace.manifest(pid);
  const target = product || String(manifest.product || '');
  const mid = String(manifest.id || '');
  const e = kit.extension(kit.ID_RE.test(mid) ? mid : pid, '0.0.0', 'development', workspace.packageDir(pid));
  kit.check(e, folder, target, appVersion || '9.99.9', app || target);
  const rec = kit.publicRecord(e, `/api/preview/${pid}/files`);
  if (e.state === 'ready' && e.entry_ui) {
    const built = await frameDocument(folder, kit.normRel(e.entry_ui), e.id, e.version);
    const url = `data:text/html;charset=utf-8;base64,${toB64(utf8(built.html))}`;
    if (url.length > MAX_URL) {
      e.state = 'refused';
      e.reason = `its page and scripts come to ${Math.round(url.length / 1024)} KB as one document; the browser demo serves at most 2 MB per frame (the desktop app has no such limit)`;
      return { project: pid, product: target, record: kit.publicRecord(e, `/api/preview/${pid}/files`), manifest, csp: kit.cspFor('') };
    }
    rec.base = '';
    rec.entryUi = url;
    return { project: pid, product: target, record: rec, manifest, csp: kit.cspFor(''), demo: { served: 'data: document', csp: built.csp, modules: built.modules } };
  }
  return { project: pid, product: target, record: rec, manifest, csp: kit.cspFor('') };
}

export function fetchRelay(): never {
  throw new HttpError(503, 'The browser demo makes no network requests, so net.fetch has no relay here. In the desktop app form.ext fetches the https:// address for the extension.');
}
