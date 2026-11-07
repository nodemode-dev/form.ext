import type { AppSim, Json } from '../types';
import { refuse, invalid, need, uid, esc, bytesToB64, buildPdf, pageSpec } from '../util';

interface Field { name: string; type: string; page: number; x: number; y: number; w: number; h: number; value: string; readonly: boolean; required: boolean; options?: string[] }
interface Page { w: number; h: number; rotate: number; text: string[]; marks: string[] }
interface State {
  open: boolean;
  id: string;
  key: string;
  name: string;
  path: string;
  page: number;
  tab: string;
  dirty: boolean;
  meta: { title: string; author: string; subject: string; keywords: string };
  pages: Page[];
  fields: Field[];
  comments: Json[];
}

const A4 = { w: 595.276, h: 841.89 };

function summary(s: State) {
  if (!s.open) return { open: false };
  return {
    open: true, id: s.id, key: s.key, name: s.name, path: s.path, pages: s.pages.length, page: s.page, tab: s.tab, dirty: s.dirty,
    info: { bytes: pdfBytes(s).length, encrypted: false, locked: false, ...s.meta, creator: 'formpdf', producer: 'formpdf 0.59.0', created: '2026-11-07T00:15:04+00:00', modified: '2026-11-07T00:15:04+00:00', pages: s.pages.length, sizes: s.pages.map((p) => ({ w: p.w, h: p.h, rotate: p.rotate })), outline: [], fields: s.fields.length, signed: false, version: '1.4' },
  };
}

function pdfBytes(s: State) {
  return buildPdf(s.pages.map((p) => ({ w: p.w, h: p.h, text: [...p.text, ...p.marks] })), s.fields.map((f) => ({ name: f.name, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, value: f.value })), s.meta.title);
}

function open(s: State) {
  if (!s.open) refuse('open a PDF first');
}

function onPages(s: State, spec: unknown, mark: (p: Page, n: number, total: number) => void) {
  for (const n of pageSpec(spec, s.pages.length)) mark(s.pages[n - 1], n, s.pages.length);
}

const change = 'change';
const sim: AppSim<State> = {
  product: 'formpdf',
  app: 'formpdf',
  appVersion: '0.59.0',
  docLabel: 'PDF',
  title: (s) => (s.open ? s.name : 'No PDF open'),
  initial: () => ({
    open: true,
    id: 'pdf_bgwnjva0yf',
    key: 'pdf_bgwnjva0yf',
    name: 'membership-form.pdf',
    path: '/home/me/Documents/membership-form.pdf',
    page: 1,
    tab: 'view',
    dirty: false,
    meta: { title: 'Harbour Rowing Club membership', author: 'Club secretary', subject: 'Membership form', keywords: 'membership' },
    pages: [
      { ...A4, rotate: 0, marks: [], text: ['Harbour Rowing Club', 'Membership form 2027', 'Full name', 'Email', 'Membership type', 'Start date'] },
      { ...A4, rotate: 0, marks: [], text: ['Club rules', 'Members row with a partner after dark.', 'Boats return to the rack by 21:00.'] },
      { ...A4, rotate: 0, marks: [], text: ['Signature', 'Signed', 'Date'] },
    ],
    fields: [
      { name: 'full_name', type: 'text', page: 1, x: 200, y: 130, w: 300, h: 22, value: '', readonly: false, required: true },
      { name: 'email', type: 'text', page: 1, x: 200, y: 152, w: 300, h: 22, value: '', readonly: false, required: true },
      { name: 'membership', type: 'text', page: 1, x: 200, y: 174, w: 200, h: 22, value: 'Adult', readonly: false, required: false },
      { name: 'start_date', type: 'text', page: 1, x: 200, y: 196, w: 140, h: 22, value: '', readonly: false, required: false },
      { name: 'signed_on', type: 'text', page: 3, x: 200, y: 130, w: 140, h: 22, value: '', readonly: false, required: false },
    ],
    comments: [{ page: 2, index: 0, nm: 'c1', kind: 'note', label: 'Note', text: 'Check the curfew time with the board.', author: 'Sam', date: '2026-11-06T18:20:00Z', color: '#ffd400', rect: [420, 120, 440, 140], replies: [], status: 'none' }],
  }),
  defaultRead: 'summary',
  reads: {
    summary,
    text: (s, p) => (open(s), { pages: pageSpec(p.pages, s.pages.length).map((n) => ({ page: n, text: [...s.pages[n - 1].text, ...s.pages[n - 1].marks].join('\n') })) }),
    fields: (s) => (open(s), { fields: s.fields.map((f) => ({ ...f })) }),
    comments: (s) => (open(s), { comments: s.comments }),
    selection: (s) => (open(s), { page: s.page, tab: s.tab, pages: s.pages.length }),
    file: (s) => { open(s); const b = pdfBytes(s); return { name: s.name, type: 'application/pdf', size: b.length, data: bytesToB64(b) }; },
  },
  apply: 'atomic',
  undo: true,
  applyKinds: [change],
  step: (s) => {
    s.id = uid('pdf_');
    s.dirty = true;
  },
  applyExtra: (s) => ({ id: s.id, pages: s.pages.length }),
  cmds: {
    page_numbers: { title: 'Page numbers', kind: change, args: { position: 'bottom-center|...', format: '"{n}" | "Page {n} of {total}"', start: 'number?', size: 'number?', color: 'string?', pages: 'string?' }, fn: (s, a) => { onPages(s, a.pages, (p, n, t) => p.marks.push(String(a.format ?? '{n}').replace('{n}', String(n + Number(a.start ?? 1) - 1)).replace('{total}', String(t)))); return { command: 'page_numbers', detail: 'numbered' }; } },
    header_footer: { title: 'Header and footer', kind: change, args: { header: '{ left, center, right }', footer: '{ left, center, right }', pages: 'string?' }, fn: (s, a) => { onPages(s, a.pages, (p, n, t) => { for (const part of [a.header, a.footer]) if (part) p.marks.push(Object.values(part).join('  ').replace(/<<page>>/g, String(n)).replace(/<<pages>>/g, String(t)).replace(/<<file>>/g, s.name)); }); return { command: 'header_footer', detail: 'added' }; } },
    watermark: { title: 'Watermark', kind: change, args: { text: 'string', opacity: '0..1', angle: 'number?', pages: 'string?' }, fn: (s, a) => { need(a, 'text'); onPages(s, a.pages, (p) => p.marks.push(`[watermark] ${a.text}`)); return { command: 'watermark', detail: `watermark ${a.text}` }; } },
    annotate: { title: 'Annotate', kind: change, args: { annotations: '[{ kind, page, ... }]', highlight: 'string?' }, fn: (s, a) => { const list = Array.isArray(a.annotations) ? a.annotations : a.highlight ? [{ kind: 'highlight', page: 1, text: a.highlight }] : invalid('annotations or highlight is required'); for (const x of list) s.comments.push({ page: x.page ?? 1, index: s.comments.length, nm: uid('c'), kind: x.kind ?? 'note', label: x.kind ?? 'Note', text: x.text ?? x.contents ?? '', author: 'Extension', date: new Date().toISOString(), color: x.color ?? '#ffd400', rect: x.rect ?? [72, 72, 92, 92], replies: [], status: 'none' }); return { command: 'annotate', detail: `${list.length} annotations` }; } },
    fill: { title: 'Fill form', kind: change, args: { values: '{ field name: value }', flatten: 'boolean?' }, fn: (s, a) => { if (!a.values || typeof a.values !== 'object') invalid('values must be an object'); for (const [k, v] of Object.entries(a.values)) { const f = s.fields.find((x) => x.name === k) ?? refuse(`the PDF has no field ${k}`); if (f.readonly) refuse(`${k} is read only`); f.value = String(v); } if (a.flatten) s.fields = []; return { command: 'fill', detail: `${Object.keys(a.values).length} fields` }; } },
    form: { title: 'Form fields', kind: change, args: { create: '[{ type, page, x, y, w, h, name }]', rename: '{ old: new }', delete: '[names]' }, fn: (s, a) => { for (const c of a.create ?? []) s.fields.push({ name: c.name, type: c.type ?? 'text', page: c.page ?? 1, x: c.x, y: c.y, w: c.w, h: c.h, value: '', readonly: false, required: false }); for (const [o, n] of Object.entries(a.rename ?? {})) { const f = s.fields.find((x) => x.name === o) ?? refuse(`the PDF has no field ${o}`); f.name = String(n); } s.fields = s.fields.filter((f) => !(a.delete ?? []).includes(f.name)); return { command: 'form', detail: 'fields changed' }; } },
    organize: { title: 'Organize pages', kind: change, args: { order: '[page numbers]', delete: '[pages]', rotate: '90|180|270', pages: 'string?', blank: '[after page]' }, fn: (s, a) => { if (a.order) s.pages = a.order.map((n: number) => s.pages[n - 1] ?? refuse(`there is no page ${n}`)); if (a.rotate) onPages(s, a.pages, (p) => (p.rotate = (p.rotate + Number(a.rotate)) % 360)); if (a.delete) { if (a.delete.length >= s.pages.length) refuse('a PDF needs at least one page'); s.pages = s.pages.filter((_, i) => !a.delete.includes(i + 1)); } for (const b of a.blank ?? []) s.pages.splice(b, 0, { ...A4, rotate: 0, text: [], marks: [] }); s.page = Math.min(s.page, s.pages.length); return { command: 'organize', detail: `${s.pages.length} pages` }; } },
    crop: { title: 'Crop', kind: change, args: { margins: '{ l, t, r, b }', box: '{ x, y, w, h }', auto: 'boolean?', pages: 'string?' }, fn: (s, a) => { onPages(s, a.pages, (p) => { const m = a.margins ?? { l: 0, t: 0, r: 0, b: 0 }; p.w -= (m.l ?? 0) + (m.r ?? 0); p.h -= (m.t ?? 0) + (m.b ?? 0); }); return { command: 'crop', detail: 'cropped' }; } },
    redact: { title: 'Redact', kind: change, args: { areas: '[{ page, x, y, w, h }]', query: 'string?', preset: 'email|phone|card|date' }, fn: (s, a) => { let n = 0; const re = a.preset === 'email' ? /\S+@\S+/g : a.query ? new RegExp(String(a.query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null; if (re) for (const p of s.pages) p.text = p.text.map((t) => t.replace(re, (m) => (n++, '#'.repeat(m.length)))); n += (a.areas ?? []).length; return { command: 'redact', detail: `${n} redactions` }; } },
    metadata: { title: 'Metadata', kind: change, args: { title: 'string?', author: 'string?', subject: 'string?', keywords: 'string?', strip: 'boolean?' }, fn: (s, a) => { for (const k of ['title', 'author', 'subject', 'keywords'] as const) if (a[k] !== undefined) s.meta[k] = String(a[k]); if (a.strip) s.meta = { title: '', author: '', subject: '', keywords: '' }; return { command: 'metadata', detail: 'metadata set' }; } },
    edit_items: { title: 'Edit page items', kind: change, args: { add: '[{ page, kind: text, text, x, y }]', update: '[]', remove: '[]' }, fn: (s, a) => { for (const x of a.add ?? []) (s.pages[(x.page ?? 1) - 1] ?? refuse(`there is no page ${x.page}`)).marks.push(String(x.text ?? '[picture]')); return { command: 'edit_items', detail: 'items changed' }; } },
    compress: { title: 'Compress', kind: change, args: { quality: '10..95' }, fn: () => ({ command: 'compress', detail: 'compressed' }) },
    sanitize: { title: 'Sanitize', kind: change, args: { remove: '[metadata, javascript, comments, ...]' }, fn: (s, a) => { if ((a.remove ?? []).includes('comments')) s.comments = []; if ((a.remove ?? []).includes('metadata')) s.meta = { title: '', author: '', subject: '', keywords: '' }; return { command: 'sanitize', detail: 'sanitized' }; } },
    find: { title: 'Find', kind: 'read', args: { query: 'string' }, fn: (s, a) => { need(a, 'query'); const hits = s.pages.flatMap((p, i) => p.text.filter((t) => t.toLowerCase().includes(String(a.query).toLowerCase())).map((t) => ({ page: i + 1, text: t }))); return { text: `${hits.length} matches`, data: hits }; } },
    info: { title: 'Info', kind: 'read', fn: (s) => ({ text: s.name, data: summary(s).info }) },
    'pdf-go-page': { title: 'Go to Page', kind: 'window', args: { page: 'number' }, fn: (s, a) => { const p = Number(a.page); if (!(p >= 1 && p <= s.pages.length)) refuse(`there is no page ${a.page}`); s.page = p; return { page: p }; } },
    'pdf-fit-width': { title: 'Fit Width', kind: 'window', fn: () => true },
    'pdf-fit-page': { title: 'Fit Page', kind: 'window', fn: () => true },
    'pdf-tab-view': { title: 'View tab', kind: 'window', fn: (s) => ((s.tab = 'view'), true) },
    'pdf-tab-fill': { title: 'Fill and Sign tab', kind: 'window', fn: (s) => ((s.tab = 'fill'), true) },
    'pdf-tab-comment': { title: 'Comment tab', kind: 'window', fn: (s) => ((s.tab = 'comment'), true) },
    'pdf-tab-organize': { title: 'Organize tab', kind: 'window', fn: (s) => ((s.tab = 'organize'), true) },
    'pdf-save': { title: 'Save', kind: 'window', fn: (s) => ((s.dirty = false), true) },
  },
  runResult: (_s, _c, r) => r,
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify([p.pages, p.fields, p.comments, p.meta, p.dirty]) !== JSON.stringify([n.pages, n.fields, n.comments, n.meta, n.dirty])) out.push({ name: 'document.changed', data: summary(n) });
    if (p.page !== n.page || p.tab !== n.tab) out.push({ name: 'selection.changed', data: { page: n.page, tab: n.tab, pages: n.pages.length } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'a PDF opens or closes, any change, undo, save', sample: (s) => summary(s) },
    { name: 'selection.changed', note: 'another page or tab', sample: (s) => ({ page: s.page, tab: s.tab, pages: s.pages.length }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['document.read { what: "file" } hands over the open PDF', 'net.fetch: -32003'] },
  tokens: { '--bg-primary': '--bg', '--bg-secondary': '--panel', '--bg-tertiary': '--panel', '--text-primary': '--text', '--text-secondary': '--muted', '--border-color': '--border', '--accent-color': '--accent' },
  view: (s) => `<div class="sim-pages">${s.pages.map((p, i) => `<div class="sim-page${i + 1 === s.page ? ' on' : ''}"><b>${i + 1}</b>${p.text.slice(0, 2).map((t) => `<span>${esc(t)}</span>`).join('')}${p.marks.slice(-2).map((t) => `<span class="sim-mark">${esc(t)}</span>`).join('')}</div>`).join('')}</div><table class="sim-table">${s.fields.map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.value) || '<span class="sim-m">empty</span>'}</td></tr>`).join('')}</table><div class="sim-m">${s.comments.length} comments, ${s.dirty ? 'unsaved changes' : 'saved'}</div>`,
  samples: ['members.csv', 'membership-form.pdf'],
};

export default sim;
