import type { AppSim, Json } from '../types';
import { refuse, invalid, num, uid, esc } from '../util';

interface El { id: string; type: string; ph?: string; x: number; y: number; w: number; h: number; rot: number; text?: string; name?: string; opacity?: number; font?: string; size?: number; bold?: boolean }
interface Slide { id: string; title: string; layout: string; layoutName: string; hidden: boolean; notes: string; elements: El[] }
interface State { id: string; title: string; slides: Slide[]; current: string; selection: string[]; rev: number }

function cur(s: State): Slide {
  return s.slides.find((x) => x.id === s.current) ?? refuse('Open a deck first.');
}

function sel(s: State): El[] {
  const els = cur(s).elements.filter((e) => s.selection.includes(e.id));
  if (!els.length) refuse('Select something on the slide first.');
  return els;
}

function slideOut(s: State, sl: Slide, only?: string[]) {
  return {
    product: 'formdeck',
    deck: { id: s.id, title: s.title, size: { w: 960, h: 540 } },
    slide: { id: sl.id, n: s.slides.indexOf(sl) + 1, title: sl.title, layout: sl.layout, layoutName: sl.layoutName, hidden: sl.hidden, notes: sl.notes },
    selection: s.current === sl.id ? s.selection : [],
    elements: sl.elements.filter((e) => !only || only.includes(e.id)).map((e) => ({ ...e })),
  };
}

function deck(s: State) {
  const c = cur(s);
  return {
    product: 'formdeck',
    deck: { id: s.id, title: s.title, size: { w: 960, h: 540 }, slideCount: s.slides.length, theme: { name: 'Studio', colors: { dk1: '#111111', lt1: '#FFFFFF', dk2: '#17151B', lt2: '#F2F2F2', accent1: '#F97316' }, fonts: { major: 'Inter', minor: 'Inter' } }, sections: [] },
    current: { slide: c.id, n: s.slides.indexOf(c) + 1 },
    selection: { slide: c.id, elements: s.selection },
    slides: s.slides.map((x, i) => ({ id: x.id, n: i + 1, title: x.title, layout: x.layout, layoutName: x.layoutName, hidden: x.hidden, notes: x.notes, elements: x.elements.length })),
  };
}

function slideBy(s: State, ref: string): Slide {
  return s.slides.find((x) => x.id === ref) ?? s.slides[Number(ref) - 1] ?? refuse(`There is no slide ${ref}.`);
}

function rawOp(s: State, op: Json) {
  if (!op || typeof op.op !== 'string' || !Array.isArray(op.path)) invalid('each op is { op, path, value }');
  let target: Json = { slides: s.slides };
  const path = [...op.path];
  const last = path.pop();
  for (const k of path) {
    target = typeof k === 'object' && k ? (target as Json[]).find((x) => x.id === k.id) : target?.[k];
    if (target === undefined) refuse(`apply-ops: ${JSON.stringify(op.path)} is not in the deck`);
  }
  if (op.op === 'set') target[last] = op.value;
  else if (op.op === 'ins') (target[last] as Json[]).splice(op.index ?? (target[last] as Json[]).length, 0, op.value);
  else if (op.op === 'del') Array.isArray(target) ? target.splice(Number(last), 1) : delete target[last];
  else refuse(`apply-ops: ${op.op} is not set, ins, del or move`);
  for (const sl of s.slides) sl.title = sl.elements.find((e) => e.ph === 'title' || e.ph === 'ctrTitle')?.text ?? sl.title;
}

function each(fn: (e: El, a: Json) => void) {
  return (s: State, a: Json) => {
    for (const e of sel(s)) fn(e, a);
    return 'done';
  };
}

const slide = (id: string, title: string, body: string, notes = ''): Slide => ({
  id, title, layout: 'l_content', layoutName: 'Title and Content', hidden: false, notes,
  elements: [
    { id: `${id}t`, type: 'shape', ph: 'title', x: 60, y: 40, w: 840, h: 80, rot: 0, text: title },
    { id: `${id}b`, type: 'shape', ph: 'body', x: 60, y: 136, w: 840, h: 348, rot: 0, text: body },
  ],
});

const sim: AppSim<State> = {
  product: 'formdeck',
  app: 'formdeck',
  appVersion: '0.32.0',
  docLabel: 'Deck',
  title: (s) => s.title,
  initial: () => ({
    id: 'd_ufb5zg2s',
    title: 'Quarterly review',
    slides: [
      slide('s1', 'Quarterly review', 'Harbour Rowing Club\nQ3 2026'),
      slide('s2', 'Revenue grew 18%', 'Memberships up 42\nBoat hire up 9%\nCafe flat', 'Pause after the number.'),
      { ...slide('s3', 'Next steps', 'New rack for the doubles\nWinter training plan'), elements: [...slide('s3', 'Next steps', 'New rack for the doubles\nWinter training plan').elements, { id: 's3i', type: 'image', name: 'rack.jpg', x: 620, y: 300, w: 280, h: 180, rot: 0 }] },
    ],
    current: 's2',
    selection: ['s2b'],
    rev: 14,
  }),
  defaultRead: 'deck',
  reads: {
    deck,
    slide: (s) => slideOut(s, cur(s)),
    selection: (s) => slideOut(s, cur(s), s.selection),
    json: (s) => ({ product: 'formdeck', format: 'formdeck', version: 1, id: s.id, title: s.title, size: { w: 960, h: 540 }, slides: s.slides }),
  },
  readFallback: (s, what) => {
    if (what.startsWith('slide:')) return slideOut(s, slideBy(s, what.slice(6)));
    invalid(`${what} is not deck, slide, slide:<id>, selection or json`);
  },
  apply: 'partial',
  undo: true,
  step: (s) => {
    s.rev += 1;
  },
  catalogue: (id, c) => ({ id, title: c.title, args: c.args ? { type: 'object', properties: Object.fromEntries(Object.entries(c.args).map(([k, v]) => [k, { type: v.replace('?', ''), description: v }])), required: Object.entries(c.args).filter(([, v]) => !v.endsWith('?')).map(([k]) => k) } : undefined }),
  cmds: {
    'apply-ops': { title: 'Apply Deck Ops', args: { ops: 'array' }, fn: (s, a) => { if (!Array.isArray(a.ops)) invalid('ops must be a list'); a.ops.forEach((op: Json) => rawOp(s, op)); return `applied ${a.ops.length} ops`; } },
    'go-to-slide': { title: 'Go to Slide', args: { number: 'number' }, fn: (s, a) => { const sl = s.slides[num(a.number, 'number') - 1] ?? refuse(`There is no slide ${a.number}.`); s.current = sl.id; s.selection = []; return `slide ${a.number}`; } },
    'new-slide': { title: 'New Slide', fn: (s) => { const id = uid('s'); s.slides.splice(s.slides.indexOf(cur(s)) + 1, 0, slide(id, 'Click to add title', '')); s.current = id; s.selection = []; return 'done'; } },
    'duplicate-slide': { title: 'Duplicate Slide', fn: (s) => { const c = cur(s); const id = uid('s'); s.slides.splice(s.slides.indexOf(c) + 1, 0, { ...JSON.parse(JSON.stringify(c)), id, elements: c.elements.map((e) => ({ ...e, id: uid('e') })) }); return 'done'; } },
    'delete-slide': { title: 'Delete Slide', fn: (s) => { if (s.slides.length < 2) refuse('A deck needs one slide.'); const i = s.slides.indexOf(cur(s)); s.slides.splice(i, 1); s.current = s.slides[Math.max(0, i - 1)].id; s.selection = []; return 'done'; } },
    'hide-slide': { title: 'Hide Slide', fn: (s) => ((cur(s).hidden = !cur(s).hidden), 'done') },
    'set-font': { title: 'Font', args: { font: 'string' }, fn: each((e, a) => (e.font = String(a.font))) },
    'set-font-size': { title: 'Font Size', args: { size: 'number' }, fn: each((e, a) => (e.size = num(a.size, 'size'))) },
    'set-position-size': { title: 'Position and Size', args: { x: 'number', y: 'number', w: 'number', h: 'number' }, fn: each((e, a) => Object.assign(e, { x: num(a.x, 'x'), y: num(a.y, 'y'), w: num(a.w, 'w'), h: num(a.h, 'h') })) },
    'set-rotation': { title: 'Rotation', args: { degrees: 'number' }, fn: each((e, a) => (e.rot = num(a.degrees, 'degrees'))) },
    'set-opacity': { title: 'Opacity', args: { percent: 'number' }, fn: each((e, a) => (e.opacity = num(a.percent, 'percent'))) },
    bold: { title: 'Bold', fn: each((e) => (e.bold = !e.bold)) },
    duplicate: { title: 'Duplicate', fn: (s) => { const c = cur(s); for (const e of sel(s)) c.elements.push({ ...e, id: uid('e'), x: e.x + 20, y: e.y + 20 }); return 'done'; } },
    delete: { title: 'Delete', fn: (s) => { const ids = sel(s).map((e) => e.id); cur(s).elements = cur(s).elements.filter((e) => !ids.includes(e.id)); s.selection = []; return 'done'; } },
    'export-pdf': { title: 'Export as PDF', fn: () => refuse('Export as PDF is risky (it writes a file) and is not open to extensions.') },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify([p.slides, p.title]) !== JSON.stringify([n.slides, n.title])) out.push({ name: 'document.changed', data: { deck: n.id, rev: n.rev } });
    if (p.current !== n.current || JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: { slide: n.current, n: n.slides.findIndex((x) => x.id === n.current) + 1, elements: n.selection } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'the open deck changed', sample: (s) => ({ deck: s.id, rev: s.rev }) },
    { name: 'selection.changed', note: 'the current slide or selected elements changed', sample: (s) => ({ slide: s.current, n: 2, elements: s.selection }) },
    { name: 'deck.opened', note: 'another deck was opened', sample: (s) => ({ deck: s.id, title: s.title }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: true, notes: ['net.fetch: through the engine, 50 MB, 30 s', 'document.apply stops at the first failing op; the ops before it stay as one undo step'] },
  tokens: { '--field': '--panel' },
  view: (s) => `<div class="sim-slides">${s.slides.map((x, i) => `<div class="sim-slide${x.id === s.current ? ' on' : ''}${x.hidden ? ' off' : ''}"><b>${i + 1}</b><span>${esc(x.title)}</span><span class="sim-m">${x.elements.length} elements${x.notes ? ', notes' : ''}</span></div>`).join('')}</div><div class="sim-m">selected ${esc(s.selection.join(', ') || 'nothing')}, rev ${s.rev}</div>`,
  samples: ['figures.csv', 'photo.png'],
};

export default sim;
