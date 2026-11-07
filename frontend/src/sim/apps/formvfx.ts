import type { AppSim, Json } from '../types';
import { refuse, num, esc } from '../util';

interface Layer { id: number; name: string; type: string; in: number; out: number; start: number; stretch: number; parent: number | null; is3d: boolean; blendMode: string; effects: string[]; masks: number; markers: Json[]; props: Record<string, Json>; text?: string }
interface State { path: string | null; dirty: boolean; undo: string | null; redo: string | null; comp: Json; time: number; layers: Layer[]; selection: { layers: number[]; props: string[] }; revision: number; nextId: number }

function find(s: State, ref: unknown): Layer {
  if (ref === undefined || ref === null) {
    const l = s.layers.find((x) => s.selection.layers.includes(x.id));
    if (!l) refuse('select a layer first');
    return l;
  }
  if (typeof ref === 'string' && ref.startsWith('#')) return s.layers[Number(ref.slice(1)) - 1] ?? refuse(`there is no layer ${ref}`);
  return s.layers.find((x) => x.id === ref || x.name === ref) ?? refuse(`there is no layer ${String(ref)}`);
}

function many(s: State, refs: unknown): Layer[] {
  return refs === undefined ? s.layers.filter((x) => s.selection.layers.includes(x.id)) : (refs as unknown[]).map((r) => find(s, r));
}

function add(s: State, l: Partial<Layer> & { name: string; type: string }) {
  const id = s.nextId++;
  s.layers.unshift({ id, in: 0, out: s.comp.duration, start: 0, stretch: 100, parent: null, is3d: false, blendMode: 'Normal', effects: [], masks: 0, markers: [], props: { 'transform/position': [s.comp.width / 2, s.comp.height / 2], 'transform/scale': [100, 100], 'transform/rotation': 0, 'transform/opacity': 100 }, ...l });
  s.selection = { layers: [id], props: [] };
  return { layer: id };
}

function row(s: State, l: Layer) {
  return { id: l.id, index: s.layers.indexOf(l) + 1, name: l.name, type: l.type, in: l.in, out: l.out, start: l.start, stretch: l.stretch, parent: l.parent, selected: s.selection.layers.includes(l.id), is3d: l.is3d, blendMode: l.blendMode, effects: l.effects, masks: l.masks };
}

const sim: AppSim<State> = {
  product: 'formvfx',
  app: 'FormVFX',
  appVersion: '0.54.0',
  docLabel: 'Project',
  title: (s) => `${s.comp.name} - FormVFX`,
  initial: () => ({
    path: '/home/me/Projects/title-card.fvfx', dirty: true, undo: 'New Text Layer', redo: null,
    comp: { id: 1, name: 'Title', width: 1920, height: 1080, pixelAspect: 1, frameRate: 30, duration: 5, workArea: [0, 5], background: [0, 0, 0] },
    time: 0,
    layers: [
      { id: 3, name: 'Hello', type: 'Text', text: 'Hello', in: 0, out: 5, start: 0, stretch: 100, parent: null, is3d: false, blendMode: 'Normal', effects: [], masks: 0, markers: [], props: { 'transform/position': [960, 540], 'transform/scale': [100, 100], 'transform/rotation': 0, 'transform/opacity': 100, 'text/sourceText': 'Hello' } },
      { id: 2, name: 'Backdrop', type: 'Solid', in: 0, out: 5, start: 0, stretch: 100, parent: null, is3d: false, blendMode: 'Normal', effects: ['Gaussian Blur'], masks: 0, markers: [], props: { 'transform/position': [960, 540], 'transform/scale': [100, 100], 'transform/rotation': 0, 'transform/opacity': 100, 'effects/#1/blurriness': 12 } },
    ],
    selection: { layers: [2], props: [] },
    revision: 6,
    nextId: 4,
  }),
  defaultRead: 'summary',
  reads: {
    summary: (s) => ({ product: 'formvfx', revision: s.revision, project: { path: s.path, dirty: s.dirty, undo: s.undo, redo: s.redo, items: 2, compositions: [{ id: s.comp.id, name: s.comp.name }] }, comp: s.comp, time: s.time, layers: s.layers.map((l) => row(s, l)), selection: s.selection }),
    project: (s) => ({ path: s.path, dirty: s.dirty, items: [{ id: 1, kind: 'composition', name: s.comp.name }, { id: 5, kind: 'footage', name: 'harbour.mov' }], active: s.comp.id, time: s.time, selected: s.selection.layers }),
    comp: (s) => ({ ...s.comp, layers: s.layers.map((l) => ({ ...row(s, l), solo: false, shy: false, locked: false, enabled: true })) }),
    layers: (s) => ({ layers: s.layers.filter((l) => s.selection.layers.includes(l.id)).slice(0, 20).map((l) => ({ id: l.id, name: l.name, props: Object.entries(l.props).map(([path, value]) => ({ path, value, keyframes: [], expression: null })) })) }),
    selection: (s) => ({ layers: s.selection.layers, props: s.selection.props, vertices: [], rows: s.layers.filter((l) => s.selection.layers.includes(l.id)).map((l) => row(s, l)) }),
  },
  apply: 'atomic',
  undo: true,
  opRefs: true,
  step: (s, label) => {
    s.undo = label;
    s.dirty = true;
    s.revision += 1;
  },
  cmds: {
    'layer.newSolid': { title: 'New Solid', args: { name: 'string?', color: '#hex?', width: 'number?', height: 'number?' }, fn: (s, a) => add(s, { name: a.name ?? 'Solid', type: 'Solid' }) },
    'layer.newText': { title: 'New Text Layer', args: { text: 'string?', name: 'string?', position: '[x, y]?', font: 'string?', size: 'number?', fill: 'string?' }, fn: (s, a) => add(s, { name: a.name ?? String(a.text ?? 'Text').slice(0, 30), type: 'Text', text: a.text ?? 'Text' }) },
    'layer.newShape': { title: 'New Shape Layer', args: { kind: 'rect|rounded|ellipse|star|polygon', name: 'string?', size: '[w, h]?' }, fn: (s, a) => add(s, { name: a.name ?? 'Shape Layer', type: 'Shape' }) },
    'layer.newNull': { title: 'New Null Object', args: { name: 'string?' }, fn: (s, a) => add(s, { name: a.name ?? 'Null', type: 'Null' }) },
    'layer.select': { title: 'Select Layers', args: { layers: 'layer[]', add: 'boolean?' }, fn: (s, a) => { const ids = (a.layers ?? []).map((r: unknown) => find(s, r).id); s.selection = { layers: a.add ? [...new Set([...s.selection.layers, ...ids])] : ids, props: [] }; return { layers: s.selection.layers }; } },
    'layer.rename': { title: 'Rename Layer', args: { layer: 'layer?', name: 'string' }, fn: (s, a) => ((find(s, a.layer).name = String(a.name)), {}) },
    'layer.setText': { title: 'Set Text', args: { layer: 'layer?', text: 'string?' }, fn: (s, a) => { const l = find(s, a.layer); if (l.type !== 'Text') refuse(`${l.name} is not a text layer`); l.text = String(a.text ?? l.text); l.props['text/sourceText'] = l.text; return {}; } },
    'layer.timing': { title: 'Layer Timing', args: { layers: 'layer[]?', start: 's?', in: 's?', out: 's?', delta: 's?' }, fn: (s, a) => { for (const l of many(s, a.layers)) { if (a.delta !== undefined) { l.in += Number(a.delta); l.out += Number(a.delta); } for (const k of ['start', 'in', 'out', 'stretch'] as const) if (a[k] !== undefined) l[k] = num(a[k], k); } return {}; } },
    'layer.setParent': { title: 'Set Parent', args: { layers: 'layer[]?', parent: 'layer|null' }, fn: (s, a) => { const p = a.parent === null ? null : find(s, a.parent).id; for (const l of many(s, a.layers)) l.parent = p; return {}; } },
    'layer.setBlendMode': { title: 'Blend Mode', args: { layers: 'layer[]?', mode: 'Normal|Add|Multiply|Screen|Overlay' }, fn: (s, a) => { for (const l of many(s, a.layers)) l.blendMode = String(a.mode); return {}; } },
    'layer.addMask': { title: 'Add Mask', args: { layer: 'layer?', shape: 'rect|ellipse', rect: '[x, y, w, h]?' }, fn: (s, a) => ((find(s, a.layer).masks += 1), { mask: find(s, a.layer).masks }) },
    'layer.addMarker': { title: 'Add Layer Marker', args: { layer: 'layer?', time: 's?', comment: 'string?' }, fn: (s, a) => (find(s, a.layer).markers.push({ time: Number(a.time ?? s.time), comment: a.comment ?? '' }), {}) },
    'layer.setTransform': { title: 'Set Transform', args: { layers: 'layer[]?', prop: 'anchor|position|scale|rotation|opacity', value: 'any' }, fn: (s, a) => { for (const l of many(s, a.layers)) l.props[`transform/${a.prop}`] = a.value; return {}; } },
    'prop.set': { title: 'Set Property', args: { layer: 'layer?', path: 'string', value: 'any', time: 's?' }, fn: (s, a) => { const l = find(s, a.layer); if (!(a.path in l.props)) refuse(`${l.name} has no property ${a.path}`); l.props[a.path] = a.value; return {}; } },
    'prop.addKey': { title: 'Add Keyframe', args: { layer: 'layer?', path: 'string', time: 's?', value: 'any?' }, fn: (s, a) => { const l = find(s, a.layer); if (!(a.path in l.props)) refuse(`${l.name} has no property ${a.path}`); return { key: 1 }; } },
    'effect.apply': { title: 'Apply Effect', args: { effect: 'id or name', layers: 'layer[]?' }, fn: (s, a) => { for (const l of many(s, a.layers)) { l.effects.push(String(a.effect)); l.props[`effects/#${l.effects.length}/amount`] = 0; } return {}; } },
    'edit.duplicate': { title: 'Duplicate', args: { layers: 'layer[]?' }, fn: (s, a) => { for (const l of many(s, a.layers)) add(s, { ...JSON.parse(JSON.stringify(l)), name: `${l.name} 2` }); return {}; } },
    'edit.clear': { title: 'Clear', args: { layers: 'layer[]?' }, fn: (s, a) => { const ids = many(s, a.layers).map((l) => l.id); s.layers = s.layers.filter((l) => !ids.includes(l.id)); s.selection = { layers: [], props: [] }; return {}; } },
    'time.set': { title: 'Set Time', args: { time: 's?', frame: 'number?' }, fn: (s, a) => ((s.time = a.frame !== undefined ? Number(a.frame) / s.comp.frameRate : num(a.time, 'time')), { time: s.time }) },
    'markers.list': { title: 'List Markers', fn: (s) => s.layers.flatMap((l) => l.markers.map((m) => ({ layer: l.id, ...m }))) },
    'file.save': { title: 'Save', fn: () => refuse('file. commands are not open to extensions; use files.save') },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify(p.layers) !== JSON.stringify(n.layers)) out.push({ name: 'document.changed', data: { revision: n.revision, undo: n.undo, dirty: n.dirty } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: n.selection });
    if (p.time !== n.time) out.push({ name: 'time.changed', data: { time: n.time } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'any change to the project', sample: (s) => ({ revision: s.revision, undo: s.undo, dirty: s.dirty }) },
    { name: 'selection.changed', note: 'selected layers or properties changed', sample: (s) => s.selection },
    { name: 'time.changed', note: 'the current time moved', sample: () => ({ time: 2.5 }) },
    { name: 'comp.changed', note: 'another composition became active', sample: () => ({ comp: 1 }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['file., script., render., export. and other namespaces answer -32004', 'net.fetch: -32003'] },
  tokens: {},
  view: (s) => `<ol class="sim-list">${s.layers.map((l, i) => `<li class="${s.selection.layers.includes(l.id) ? 'on' : ''}"><span class="sim-k">${i + 1} ${esc(l.type)}</span>${esc(l.name)}<span class="sim-m">${l.in}-${l.out}s ${esc(l.blendMode)}${l.effects.length ? `, ${esc(l.effects.join(', '))}` : ''}</span></li>`).join('')}</ol><div class="sim-m">${esc(s.comp.name)} ${s.comp.width}x${s.comp.height} ${s.comp.frameRate} fps, time ${s.time}s, undo: ${esc(s.undo)}</div>`,
  samples: ['photo.png', 'tracking.json'],
};

export default sim;
