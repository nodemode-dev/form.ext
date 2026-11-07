import type { AppSim, Json } from '../types';
import { refuse, invalid, num, esc } from '../util';

interface Photo { id: number; file: string; path: string; kind: string; format: string; width: number; height: number; captureTime: string; offset: string | null; camera: string; lens: string; focal: number | null; aperture: number | null; shutter: string | null; iso: number | null; gps: { lat: number; lon: number; alt: number | null; dir: number | null } | null; rating: number; flag: string; label: string; edited: boolean; keywords: string[]; meta: Record<string, string>; develop: Record<string, number>; collections: number[] }
interface State { photos: Photo[]; selection: number[]; active: number | null; module: string; source: Json; collections: { id: number; name: string; ids: number[] }[]; keywords: string[]; revision: number }

const camera = { camera: 'FUJIFILM X-T5', lens: 'XF16-55mmF2.8 R LM WR', kind: 'raw', format: 'raf', width: 7728, height: 5152 };
const ph = (id: number, file: string, t: string, gps: Photo['gps'], ex: Partial<Photo>): Photo => ({ id, file, path: `/home/me/Pictures/2026/Bristol/${file}`, ...camera, captureTime: t, offset: '+00:00', focal: 23, aperture: 5.6, shutter: '1/250', iso: 160, gps, rating: 0, flag: 'none', label: '', edited: false, keywords: [], meta: { title: '', caption: '', city: 'Bristol', country: 'United Kingdom' }, develop: { 'light.exposure': 0, 'light.contrast': 0, 'color.temp': 5500 }, collections: [], ...ex });

function ids(s: State, v: unknown): number[] {
  if (v === 'selection') return s.selection.length ? [...s.selection] : s.active ? [s.active] : [];
  if (v === 'active') return s.active ? [s.active] : [];
  if (!Array.isArray(v)) invalid('ids must be a list of photo ids, "selection" or "active"');
  for (const i of v) if (!s.photos.some((p) => p.id === i)) refuse(`there is no photo ${i}`);
  return v as number[];
}

function each(s: State, v: unknown, fn: (p: Photo) => void) {
  const list = ids(s, v);
  if (!list.length) refuse('no photos are selected');
  for (const i of list) fn(s.photos.find((p) => p.id === i) as Photo);
  return { photos: list.length };
}

function brief(p: Photo) {
  const { meta: _m, develop: _d, collections: _c, ...rest } = p;
  void _m; void _d; void _c;
  return rest;
}

const sim: AppSim<State> = {
  product: 'formlit',
  app: 'formlit',
  appVersion: '0.50.0',
  docLabel: 'Catalog',
  title: (s) => `formlit - ${s.source.label}`,
  initial: () => ({
    photos: [
      ph(1, 'DSCF4012.RAF', '2026-10-18T07:12:40', { lat: 51.4483, lon: -2.5979, alt: 9, dir: 95 }, { rating: 3, keywords: ['Places|Bristol|Harbourside'] }),
      ph(2, 'DSCF4031.RAF', '2026-10-18T07:41:05', { lat: 51.4497, lon: -2.6012, alt: 11, dir: 110 }, { flag: 'pick' }),
      ph(3, 'DSCF4188.RAF', '2026-10-18T17:58:22', { lat: 51.4545, lon: -2.6295, alt: 64, dir: 260 }, { rating: 4, label: 'yellow' }),
      ph(4, 'IMG_0921.JPG', '2026-10-19T12:03:10', null, { camera: 'iPhone 15', lens: 'iPhone 15 back camera 6.1mm f/1.6', kind: 'jpeg', format: 'jpg', width: 4032, height: 3024, focal: 6.1, aperture: 1.6, shutter: '1/1200', iso: 50 }),
    ],
    selection: [1, 2, 3],
    active: 1,
    module: 'library',
    source: { kind: 'folder', label: '2026/Bristol', id: 7 },
    collections: [{ id: 11, name: 'Harbour mornings', ids: [1, 2] }],
    keywords: ['Places|Bristol|Harbourside', 'Light'],
    revision: 21,
  }),
  defaultRead: 'summary',
  reads: {
    summary: (s) => { const a = s.photos.find((p) => p.id === s.active); return { what: 'summary', catalog: { name: 'formlit', path: '/home/me/Formlit/Catalog/formlit.fldb', photos: s.photos.length }, module: s.module, source: s.source, selection: s.selection, selectionCount: s.selection.length, active: a ? { id: a.id, file: a.file, captureTime: a.captureTime, offset: a.offset, rating: a.rating, flag: a.flag, label: a.label, gps: a.gps } : null, revision: s.revision }; },
    selection: (s) => { const list = (s.selection.length ? s.selection : s.active ? [s.active] : []).map((i) => brief(s.photos.find((p) => p.id === i) as Photo)); return { what: 'selection', photos: list, count: list.length, truncated: false }; },
    photo: (s) => { const p = s.photos.find((x) => x.id === s.active); return { what: 'photo', photo: p ? { ...p, exif: { Make: p.camera.split(' ')[0], Model: p.camera, DateTimeOriginal: p.captureTime.replace('T', ' '), OffsetTimeOriginal: p.offset }, history: 2, masterId: null, copyName: null, stackId: null, missing: false } : null }; },
    catalog: (s) => ({ what: 'catalog', catalog: { name: 'formlit', photos: s.photos.length }, folders: [{ id: 7, path: '/home/me/Pictures/2026/Bristol', photos: s.photos.length }], collections: s.collections.map((c) => ({ id: c.id, name: c.name, kind: 'collection', photos: c.ids.length })), keywords: s.keywords }),
  },
  apply: 'atomic',
  undo: true,
  step: (s) => {
    s.revision += 1;
  },
  cmds: {
    'photo.get': { title: 'Get Photo', args: { id: 'number' }, fn: (s, a) => s.photos.find((p) => p.id === a.id) ?? refuse(`there is no photo ${a.id}`) },
    'library.query': { title: 'Find Photos', args: { source: 'object?', filter: 'object?', sort: 'string?', limit: 'number?' }, fn: (s, a) => ({ ids: s.photos.slice(0, Number(a.limit ?? 500)).map((p) => p.id), count: s.photos.length }) },
    'library.tree': { title: 'Library Tree', fn: (s) => ({ folders: [{ id: 7, path: '/home/me/Pictures/2026/Bristol' }], collections: s.collections, keywords: s.keywords }) },
    'photo.addKeywords': { title: 'Add Keywords', args: { ids: 'ids', keywords: 'string[]' }, fn: (s, a) => { if (!Array.isArray(a.keywords)) invalid('keywords must be a list'); const r = each(s, a.ids, (p) => { for (const k of a.keywords) if (!p.keywords.includes(k)) p.keywords.push(k); }); for (const k of a.keywords) if (!s.keywords.includes(k)) s.keywords.push(k); return r; } },
    'photo.removeKeywords': { title: 'Remove Keywords', args: { ids: 'ids', keywords: 'string[]' }, fn: (s, a) => each(s, a.ids, (p) => (p.keywords = p.keywords.filter((k) => !(a.keywords ?? []).includes(k)))) },
    'photo.rate': { title: 'Rate', args: { ids: 'ids', rating: '0..5', delta: 'number?' }, fn: (s, a) => each(s, a.ids, (p) => (p.rating = Math.max(0, Math.min(5, a.delta !== undefined ? p.rating + Number(a.delta) : num(a.rating, 'rating'))))) },
    'photo.flag': { title: 'Flag', args: { ids: 'ids', flag: 'pick|reject|none' }, fn: (s, a) => { if (!['pick', 'reject', 'none'].includes(a.flag)) invalid('flag is pick, reject or none'); return each(s, a.ids, (p) => (p.flag = a.flag)); } },
    'photo.label': { title: 'Colour Label', args: { ids: 'ids', label: 'red|yellow|green|blue|purple|none' }, fn: (s, a) => each(s, a.ids, (p) => (p.label = a.label === 'none' ? '' : String(a.label))) },
    'photo.setMeta': { title: 'Edit Metadata', args: { ids: 'ids', fields: '{ title, caption, city, ... }' }, fn: (s, a) => each(s, a.ids, (p) => Object.assign(p.meta, a.fields ?? {})) },
    'photo.setGps': { title: 'Set Location', args: { ids: 'ids', lat: 'number', lon: 'number', alt: 'number?' }, fn: (s, a) => each(s, a.ids, (p) => (p.gps = { lat: num(a.lat, 'lat'), lon: num(a.lon, 'lon'), alt: a.alt ?? null, dir: null })) },
    'collection.create': { title: 'New Collection', args: { name: 'string', kind: 'collection', ids: 'ids?' }, fn: (s, a) => { const id = Math.max(10, ...s.collections.map((c) => c.id)) + 1; s.collections.push({ id, name: String(a.name), ids: a.ids ? ids(s, a.ids) : [] }); return { id }; } },
    'collection.addPhotos': { title: 'Add to Collection', args: { id: 'number', ids: 'ids' }, fn: (s, a) => { const c = s.collections.find((x) => x.id === a.id) ?? refuse(`there is no collection ${a.id}`); c.ids = [...new Set([...c.ids, ...ids(s, a.ids)])]; return { photos: c.ids.length }; } },
    'develop.get': { title: 'Develop Settings', args: { id: 'number' }, fn: (s, a) => (s.photos.find((p) => p.id === a.id) ?? refuse(`there is no photo ${a.id}`)).develop },
    'develop.set': { title: 'Set Develop', args: { ids: 'ids', values: '{ "light.exposure": 0.3 }', delta: 'boolean?' }, fn: (s, a) => each(s, a.ids, (p) => { for (const [k, v] of Object.entries(a.values ?? {})) p.develop[k] = a.delta ? (p.develop[k] ?? 0) + Number(v) : Number(v); p.edited = true; }) },
    'develop.auto': { title: 'Auto Settings', args: { ids: 'ids' }, fn: (s, a) => each(s, a.ids, (p) => { p.develop['light.exposure'] = 0.35; p.edited = true; }) },
    'library.select': { title: 'Select Photos', args: { ids: 'ids', active: 'number?' }, fn: (s, a) => { s.selection = ids(s, a.ids); s.active = a.active ?? s.selection[0] ?? null; return { selection: s.selection }; } },
    'photo.delete': { title: 'Delete Photos', fn: () => refuse('deleting photos stays with the person') },
    'catalog.open': { title: 'Open Catalog', fn: () => refuse('switching catalogs stays with the person') },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify([p.photos, p.collections]) !== JSON.stringify([n.photos, n.collections])) {
      const changed = n.photos.filter((x, i) => JSON.stringify(x) !== JSON.stringify(p.photos[i])).map((x) => x.id);
      out.push({ name: 'document.changed', data: { revision: n.revision, photos: changed, lists: JSON.stringify(p.keywords) !== JSON.stringify(n.keywords) ? ['keywords'] : [], label: '' } });
    }
    if (JSON.stringify([p.selection, p.active]) !== JSON.stringify([n.selection, n.active])) out.push({ name: 'selection.changed', data: { selection: n.selection, active: n.active } });
    if (p.module !== n.module) out.push({ name: 'module.changed', data: { module: n.module } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'after any catalog change, undo or redo', sample: (s) => ({ revision: s.revision, photos: [1], lists: ['keywords'], label: 'Add Keywords' }) },
    { name: 'selection.changed', note: 'the selected or active photo changed', sample: (s) => ({ selection: s.selection, active: s.active }) },
    { name: 'module.changed', note: 'library, develop, map, book, slideshow, print, web', sample: () => ({ module: 'map' }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['files.save: Choose Folder, then the engine writes it; never replaces a file', 'net.fetch: -32003'] },
  tokens: {},
  view: (s) => `<table class="sim-table">${s.photos.map((p) => `<tr class="${s.selection.includes(p.id) ? 'on' : ''}"><td>${p.id === s.active ? '<b>' : ''}${esc(p.file)}${p.id === s.active ? '</b>' : ''}</td><td>${esc(p.captureTime.slice(5, 16).replace('T', ' '))}</td><td>${p.gps ? 'GPS' : '<span class="sim-m">no GPS</span>'}</td><td>${'*'.repeat(p.rating)}${p.flag === 'pick' ? ' P' : ''}</td><td class="sim-m">${esc(p.keywords.join(', '))}</td></tr>`).join('')}</table><div class="sim-m">${s.selection.length} selected in ${esc(s.source.label)}, revision ${s.revision}</div>`,
  samples: ['photo.png', 'places.csv'],
};

export default sim;
