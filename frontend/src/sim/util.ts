import { HostError, ERR } from '../../../contract/host/host-bridge';

export { HostError, ERR };

export function refuse(message: string): never {
  throw new HostError(ERR.REFUSED, message);
}

export function invalid(message: string): never {
  throw new HostError(ERR.INVALID, message);
}

export function clone<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}${(Date.now() % 100000).toString(36)}${counter.toString(36)}`;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function need(a: Record<string, unknown>, ...keys: string[]): void {
  for (const k of keys) if (a?.[k] === undefined || a?.[k] === null || a?.[k] === '') invalid(`${k} is required`);
}

export function num(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) invalid(`${name} must be a number`);
  return n;
}

export function bytesToB64(bytes: Uint8Array): string {
  let out = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) out += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(out);
}

export function textToB64(text: string): string {
  return bytesToB64(new TextEncoder().encode(text));
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function pageSpec(spec: unknown, total: number): number[] {
  if (spec === undefined || spec === null || spec === '' || spec === 'all') return Array.from({ length: total }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(\d+)?(-)?(\d+)?$/);
    if (!m) invalid(`pages ${spec} is not a page list`);
    const a = m[1] ? Number(m[1]) : 1;
    const b = m[2] ? (m[3] ? Number(m[3]) : total) : a;
    for (let p = a; p <= Math.min(b, total); p++) out.add(p);
  }
  return [...out].sort((x, y) => x - y);
}

function pdfString(s: string): string {
  return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

export interface PdfField {
  name: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
}

export function buildPdf(pages: { w: number; h: number; text: string[] }[], fields: PdfField[], title: string): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => {
    objs.push(body);
    return objs.length;
  };
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];
  const fieldIds: number[] = [];
  const pageAnnots = pages.map(() => [] as number[]);
  for (const p of pages) {
    const lines = p.text.map((t, i) => `BT /F1 ${i === 0 ? 18 : 11} Tf 56 ${p.h - 72 - i * 22} Td ${pdfString(t)} Tj ET`).join('\n');
    const content = add(`<< /Length ${lines.length} >>\nstream\n${lines}\nendstream`);
    pageIds.push(add(`PAGE:${content}`));
  }
  for (const f of fields) {
    const pg = pages[f.page - 1] ?? pages[0];
    const y0 = pg.h - f.y - f.h;
    const id = add(`<< /Type /Annot /Subtype /Widget /FT /Tx /T ${pdfString(f.name)} /V ${pdfString(f.value)} /DA (/Helv 11 Tf 0 g) /F 4 /Rect [${f.x} ${y0} ${f.x + f.w} ${y0 + f.h}] /P ${pageIds[f.page - 1] ?? pageIds[0]} 0 R /MK << /BC [0.6 0.6 0.6] >> >>`);
    fieldIds.push(id);
    pageAnnots[(f.page - 1) % pages.length].push(id);
  }
  const info = add(`<< /Title ${pdfString(title)} /Producer (form.ext preview) >>`);
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R${fieldIds.length ? ` /AcroForm << /Fields [${fieldIds.map((i) => `${i} 0 R`).join(' ')}] /NeedAppearances true /DR << /Font << /Helv ${font} 0 R >> >> /DA (/Helv 11 Tf 0 g) >>` : ''} >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  pageIds.forEach((id, i) => {
    const content = Number(objs[id - 1].slice(5));
    const annots = pageAnnots[i].length ? ` /Annots [${pageAnnots[i].map((a) => `${a} 0 R`).join(' ')}]` : '';
    objs[id - 1] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pages[i].w} ${pages[i].h}] /Resources << /Font << /F1 ${font} 0 R /Helv ${font} 0 R >> >> /Contents ${content} 0 R${annots} >>`;
  });
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

export function buildWav(seconds: number, rate = 22050): Uint8Array {
  const frames = Math.round(seconds * rate);
  const buf = new ArrayBuffer(44 + frames * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + frames * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const beat = Math.exp(-((t * 2) % 1) * 18);
    const s = 0.35 * Math.sin(2 * Math.PI * 220 * t) * (0.4 + 0.6 * beat) + 0.25 * Math.sin(2 * Math.PI * 55 * t) * beat;
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
  }
  return new Uint8Array(buf);
}

export function canvasPng(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1] ?? '';
}
