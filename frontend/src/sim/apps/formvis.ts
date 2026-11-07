import type { AppSim, Json } from '../types';
import { refuse, invalid, need, num, uid, esc, canvasPng, b64ToBytes } from '../util';

interface Layer {
  id: string;
  name: string;
  kind: string;
  visible: boolean;
  opacity: number;
  blend: string;
  parentId: string | null;
  draw: Json;
  filters: string[];
}

interface State {
  open: boolean;
  name: string;
  width: number;
  height: number;
  activeLayerId: string | null;
  selection: { x: number; y: number; width: number; height: number } | null;
  history: { steps: number; done: number; last: string };
  layers: Layer[];
  revision: number;
}

const BLENDS: Record<string, GlobalCompositeOperation> = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge', 'color-burn': 'color-burn', 'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity' };

function pub(l: Layer) {
  return { id: l.id, name: l.name, kind: l.kind, visible: l.visible, opacity: l.opacity, blend: l.blend, parentId: l.parentId };
}

function layer(s: State, id: unknown): Layer {
  const l = s.layers.find((x) => x.id === (id ?? s.activeLayerId));
  if (!l) refuse(`there is no layer ${String(id ?? '(active)')}`);
  return l;
}

function addLayer(s: State, l: Omit<Layer, 'id' | 'visible' | 'opacity' | 'blend' | 'parentId' | 'filters'> & Partial<Layer>) {
  const id = uid('l');
  const full: Layer = { id, visible: true, opacity: 1, blend: 'normal', parentId: null, filters: [], ...l };
  const at = s.layers.findIndex((x) => x.id === s.activeLayerId);
  s.layers.splice(at < 0 ? s.layers.length : at + 1, 0, full);
  s.activeLayerId = id;
  return { id };
}

function document(s: State) {
  if (!s.open) return { open: false, documents: [] };
  return {
    open: true,
    name: s.name,
    width: s.width,
    height: s.height,
    resolution: 72,
    mode: 'rgb',
    depth: 8,
    profile: 'sRGB',
    activeLayerId: s.activeLayerId,
    selection: s.selection,
    history: { steps: s.history.steps, done: s.history.done, canUndo: s.history.done > 0, canRedo: s.history.done < s.history.steps, last: s.history.last },
    documents: [{ id: 'p1', name: s.name, active: true, width: s.width, height: s.height, layers: s.layers.length, modified: true }],
    layers: s.layers.map(pub),
  };
}

async function imageOf(s: State, p: Json) {
  if (!s.open) return null;
  const max = Math.min(4096, Math.max(16, Number(p.max_size) || 1024));
  const box = p.id ? { x: 0, y: 0, width: s.width, height: s.height } : { x: Number(p.x) || 0, y: Number(p.y) || 0, width: Number(p.width) || s.width, height: Number(p.height) || s.height };
  const scale = Math.min(1, max / Math.max(box.width, box.height));
  const c = window.document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.width * scale));
  c.height = Math.max(1, Math.round(box.height * scale));
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.scale(scale, scale);
  g.translate(-box.x, -box.y);
  for (const l of s.layers) {
    if (p.id ? l.id !== p.id : !l.visible) continue;
    g.save();
    g.globalAlpha = l.opacity;
    g.globalCompositeOperation = BLENDS[l.blend] ?? 'source-over';
    g.filter = l.filters.length ? l.filters.join(' ') : 'none';
    await paint(g, l, s);
    g.restore();
  }
  return { mimeType: 'image/png', data: canvasPng(c), width: c.width, height: c.height };
}

async function paint(g: CanvasRenderingContext2D, l: Layer, s: State) {
  const d = l.draw ?? {};
  if (d.type === 'scene') {
    const sky = g.createLinearGradient(0, 0, 0, s.height);
    sky.addColorStop(0, '#1d3b6e');
    sky.addColorStop(0.55, '#f2a65a');
    sky.addColorStop(1, '#3a2a1e');
    g.fillStyle = sky;
    g.fillRect(0, 0, s.width, s.height);
    const sun = g.createRadialGradient(s.width * 0.68, s.height * 0.56, 10, s.width * 0.68, s.height * 0.56, s.height * 0.32);
    sun.addColorStop(0, '#fff4d6');
    sun.addColorStop(0.25, '#ffc46b');
    sun.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, s.width, s.height);
    g.fillStyle = '#20160f';
    g.beginPath();
    g.moveTo(0, s.height * 0.78);
    for (let x = 0; x <= s.width; x += 40) g.lineTo(x, s.height * (0.74 + 0.05 * Math.sin(x / 90) + 0.03 * Math.sin(x / 31)));
    g.lineTo(s.width, s.height);
    g.lineTo(0, s.height);
    g.fill();
  } else if (d.type === 'fill') {
    g.fillStyle = d.color;
    const b = d.box ?? { x: 0, y: 0, width: s.width, height: s.height };
    g.fillRect(b.x, b.y, b.width, b.height);
  } else if (d.type === 'shape') {
    g.fillStyle = d.fill ?? '#ffffff';
    g.strokeStyle = d.stroke ?? 'transparent';
    g.lineWidth = d.stroke_width ?? 0;
    g.beginPath();
    if (d.kind === 'ellipse') g.ellipse(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, d.height / 2, 0, 0, Math.PI * 2);
    else if (d.kind === 'triangle') {
      g.moveTo(d.x + d.width / 2, d.y);
      g.lineTo(d.x + d.width, d.y + d.height);
      g.lineTo(d.x, d.y + d.height);
      g.closePath();
    } else if (d.kind === 'line' || d.kind === 'arrow') {
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + d.width, d.y + d.height);
      g.strokeStyle = d.stroke ?? d.fill ?? '#ffffff';
      g.lineWidth = d.stroke_width ?? 4;
    } else g.rect(d.x, d.y, d.width, d.height);
    if (d.kind !== 'line' && d.kind !== 'arrow') g.fill();
    if (g.lineWidth > 0) g.stroke();
  } else if (d.type === 'text') {
    g.fillStyle = d.color ?? '#ffffff';
    g.font = `${d.italic ? 'italic ' : ''}${d.bold ? 'bold ' : ''}${d.size ?? 48}px ${d.font ?? 'Inter, sans-serif'}`;
    g.textAlign = d.align ?? 'left';
    g.textBaseline = 'top';
    g.fillText(d.text, d.x ?? 0, d.y ?? 0);
  } else if (d.type === 'image' && d.data) {
    try {
      const bmp = await createImageBitmap(new Blob([b64ToBytes(d.data) as BlobPart]));
      let w = bmp.width * (d.scale ?? 1);
      let h = bmp.height * (d.scale ?? 1);
      if (d.fit === 'contain' || d.fit === 'cover') {
        const k = (d.fit === 'contain' ? Math.min : Math.max)(s.width / bmp.width, s.height / bmp.height);
        w = bmp.width * k;
        h = bmp.height * k;
      }
      const x = d.center || d.fit ? (s.width - w) / 2 : d.x ?? 0;
      const y = d.center || d.fit ? (s.height - h) / 2 : d.y ?? 0;
      g.drawImage(bmp, x, y, w, h);
    } catch {
      return;
    }
  }
}

const sim: AppSim<State> = {
  product: 'formvis',
  app: 'FormVis',
  appVersion: '2.1.0',
  docLabel: 'Picture',
  title: (s) => (s.open ? `${s.name} @ 100% (RGB/8)` : 'No document'),
  initial: () => ({
    open: true,
    name: 'Harbour at dusk',
    width: 1200,
    height: 800,
    activeLayerId: 'l3',
    selection: { x: 100, y: 80, width: 400, height: 300 },
    history: { steps: 3, done: 3, last: 'Rectangular Selection' },
    revision: 3,
    layers: [
      { id: 'l1', name: 'Background', kind: 'pixels', visible: true, opacity: 1, blend: 'normal', parentId: null, filters: [], draw: { type: 'scene' } },
      { id: 'l2', name: 'Moon', kind: 'shape', visible: true, opacity: 0.9, blend: 'screen', parentId: null, filters: [], draw: { type: 'shape', kind: 'ellipse', x: 180, y: 120, width: 120, height: 120, fill: '#f3ecd8' } },
      { id: 'l3', name: 'Title', kind: 'text', visible: true, opacity: 1, blend: 'normal', parentId: null, filters: [], draw: { type: 'text', text: 'Harbour at dusk', x: 80, y: 640, size: 72, color: '#ffffff', bold: true } },
    ],
  }),
  defaultRead: 'document',
  reads: {
    document,
    layers: (s) => (s.open ? { activeLayerId: s.activeLayerId, layers: s.layers.map(pub) } : null),
    selection: (s) => (s.open ? { selection: s.selection } : null),
    history: (s) => (s.open ? { current: s.history.done, count: s.history.steps, steps: Array.from({ length: s.history.steps }, (_, i) => ({ index: i, name: i === s.history.steps - 1 ? s.history.last : `Step ${i + 1}`, done: i < s.history.done })), snapshots: [] } : null),
    image: (s, p) => imageOf(s, p),
  },
  apply: 'atomic',
  undo: true,
  step: (s, label) => {
    s.history.steps = s.history.done + 1;
    s.history.done = s.history.steps;
    s.history.last = label;
    s.revision += 1;
  },
  cmds: {
    'tool:add_layer': { title: 'Add Layer', args: { name: 'string?' }, group: 'Layer', fn: (s, a) => addLayer(s, { name: a.name ?? `Layer ${s.layers.length + 1}`, kind: 'pixels', draw: {} }) },
    'new-layer': { title: 'New Layer', group: 'Layer', fn: (s) => addLayer(s, { name: `Layer ${s.layers.length + 1}`, kind: 'pixels', draw: {} }) },
    'tool:place_image': {
      title: 'Place Image',
      args: { data: 'base64', name: 'string?', x: 'number?', y: 'number?', scale: 'number?', fit: 'none|contain|cover', center: 'boolean?' },
      group: 'Layer',
      fn: (s, a) => {
        need(a, 'data');
        if (a.path) invalid('path is not accepted; send data');
        return addLayer(s, { name: a.name ?? 'Placed image', kind: 'smart object', draw: { type: 'image', data: a.data, x: a.x, y: a.y, scale: a.scale, fit: a.fit === 'none' ? undefined : a.fit, center: a.center } });
      },
    },
    'tool:add_text': { title: 'Add Text', args: { text: 'string', x: 'number?', y: 'number?', size: 'number?', color: '#rrggbb?', font: 'string?', bold: 'boolean?', italic: 'boolean?', align: 'string?' }, group: 'Layer', fn: (s, a) => (need(a, 'text'), addLayer(s, { name: String(a.text).slice(0, 30), kind: 'text', draw: { type: 'text', ...a } })) },
    'tool:draw_shape': {
      title: 'Draw Shape',
      args: { kind: 'rectangle|ellipse|triangle|star|polygon|line|arrow', x: 'number', y: 'number', width: 'number', height: 'number', fill: 'string?', stroke: 'string?', stroke_width: 'number?' },
      group: 'Layer',
      fn: (s, a) => {
        need(a, 'kind');
        ['x', 'y', 'width', 'height'].forEach((k) => num(a[k], k));
        return addLayer(s, { name: `${a.kind[0].toUpperCase()}${a.kind.slice(1)}`, kind: 'shape', draw: { type: 'shape', ...a } });
      },
    },
    'tool:fill': { title: 'Fill', args: { color: '#rrggbb' }, group: 'Edit', fn: (s, a) => { need(a, 'color'); const l = layer(s, null); if (l.kind !== 'pixels') refuse(`${l.name} is a ${l.kind} layer; fill needs a pixel layer`); l.draw = { type: 'fill', color: a.color, box: s.selection ?? undefined }; return {}; } },
    'tool:set_layer': { title: 'Set Layer', args: { id: 'string', name: 'string?', visible: 'boolean?', opacity: 'number?', blend: 'string?', active: 'boolean?' }, group: 'Layer', fn: (s, a) => (need(a, 'id'), setLayer(s, a)) },
    'layer.set': { title: 'Layer Properties', args: { id: 'string?', name: 'string?', visible: 'boolean?', opacity: 'number?', blend: 'string?', active: 'boolean?' }, group: 'Layer', fn: (s, a) => setLayer(s, a) },
    'tool:delete_layer': { title: 'Delete Layer', args: { id: 'string?' }, group: 'Layer', fn: (s, a) => { const l = layer(s, a.id); s.layers = s.layers.filter((x) => x !== l); s.activeLayerId = s.layers.at(-1)?.id ?? null; return {}; } },
    'tool:duplicate_layer': { title: 'Duplicate Layer', args: { id: 'string?' }, group: 'Layer', fn: (s, a) => { const l = layer(s, a.id); return addLayer(s, { ...JSON.parse(JSON.stringify(l)), name: `${l.name} copy` }); } },
    'tool:select': { title: 'Select', args: { x: 'number', y: 'number', width: 'number', height: 'number' }, group: 'Select', fn: (s, a) => ((s.selection = { x: num(a.x, 'x'), y: num(a.y, 'y'), width: num(a.width, 'width'), height: num(a.height, 'height') }), {}) },
    'select.rect': { title: 'Rectangular Selection', args: { x: 'number', y: 'number', width: 'number', height: 'number', mode: 'replace|add|subtract|intersect' }, group: 'Select', fn: (s, a) => ((s.selection = { x: num(a.x, 'x'), y: num(a.y, 'y'), width: num(a.width, 'width'), height: num(a.height, 'height') }), {}) },
    'select.ellipse': { title: 'Elliptical Selection', args: { x: 'number', y: 'number', width: 'number', height: 'number', mode: 'string?' }, group: 'Select', fn: (s, a) => ((s.selection = { x: num(a.x, 'x'), y: num(a.y, 'y'), width: num(a.width, 'width'), height: num(a.height, 'height') }), {}) },
    'select-all': { title: 'Select All', group: 'Select', fn: (s) => ((s.selection = { x: 0, y: 0, width: s.width, height: s.height }), {}) },
    deselect: { title: 'Deselect', group: 'Select', fn: (s) => ((s.selection = null), {}) },
    invert: { title: 'Invert', group: 'Image', fn: (s) => (layer(s, null).filters.push('invert(1)'), {}) },
    desaturate: { title: 'Desaturate', group: 'Image', fn: (s) => (layer(s, null).filters.push('grayscale(1)'), {}) },
    'filter.apply': { title: 'Apply Filter', args: { kind: 'gaussianBlur|...', radius: 'number?' }, group: 'Filter', fn: (s, a) => { need(a, 'kind'); if (a.kind !== 'gaussianBlur') refuse(`the preview knows only gaussianBlur, not ${a.kind}`); layer(s, null).filters.push(`blur(${Number(a.radius ?? a.settings?.radius ?? 4)}px)`); return {}; } },
    'adjust.apply': { title: 'Apply Adjustment', args: { kind: 'hsv|...', as: 'pixels|layer', hue: 'number?', saturation: 'number?', lightness: 'number?' }, group: 'Image', fn: (s, a) => { need(a, 'kind'); if (a.as === 'layer') return addLayer(s, { name: `${a.kind} adjustment`, kind: `adjustment:${a.kind}`, draw: {} }); layer(s, null).filters.push(`hue-rotate(${Number(a.hue ?? 0)}deg) saturate(${1 + Number(a.saturation ?? 0) / 100})`); return {}; } },
    'swatch-add': { title: 'Add Swatch', group: 'Window', fn: () => ({}) },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify(p.layers) !== JSON.stringify(n.layers) || p.revision !== n.revision) out.push({ name: 'document.changed', data: { name: n.name, width: n.width, height: n.height, layers: n.layers.length, revision: n.revision } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: { selection: n.selection } });
    if (p.activeLayerId !== n.activeLayerId) out.push({ name: 'layer.activated', data: { activeLayerId: n.activeLayerId } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'layers, pixels or history changed', sample: (s) => ({ name: s.name, width: s.width, height: s.height, layers: s.layers.length, revision: s.revision }) },
    { name: 'selection.changed', note: 'the selection box changed', sample: (s) => ({ selection: s.selection }) },
    { name: 'layer.activated', note: 'another layer became active', sample: (s) => ({ activeLayerId: s.activeLayerId }) },
    { name: 'document.switched', note: 'another document tab became active, or null', sample: (s) => ({ id: 'p1', name: s.name }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['files.open: the picker formvis uses for Open', 'files.save: the save dialog', 'net.fetch: -32003'] },
  tokens: { '--panel-2': '--panel', '--accent-text': '#ffffff', '--danger': '#e5484d' },
  view: (s) => `<ol class="sim-list">${[...s.layers].reverse().map((l) => `<li class="${l.id === s.activeLayerId ? 'on' : ''}"><span class="sim-k">${esc(l.kind)}</span>${esc(l.name)}<span class="sim-m">${l.visible ? '' : 'hidden '}${Math.round(l.opacity * 100)}% ${esc(l.blend)}</span></li>`).join('')}</ol><div class="sim-m">${s.width} x ${s.height}, selection ${s.selection ? `${s.selection.x},${s.selection.y} ${s.selection.width}x${s.selection.height}` : 'none'}, ${esc(s.history.last)}</div>`,
  samples: ['photo.png', 'logo.svg'],
};

function setLayer(s: State, a: Json) {
  const l = layer(s, a.id);
  if (a.name !== undefined) l.name = String(a.name);
  if (a.visible !== undefined) l.visible = Boolean(a.visible);
  if (a.opacity !== undefined) {
    const o = num(a.opacity, 'opacity');
    l.opacity = o > 1 ? o / 100 : o;
  }
  if (a.blend !== undefined) {
    if (!(a.blend in BLENDS)) refuse(`${a.blend} is not a blend mode`);
    l.blend = a.blend;
  }
  if (a.active) s.activeLayerId = l.id;
  return {};
}

export default sim;
