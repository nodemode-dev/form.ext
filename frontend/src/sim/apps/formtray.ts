import type { AppSim, Json } from '../types';
import { refuse, invalid, uid, esc } from '../util';

interface App { id: string; name: string; category: string; installed: boolean; running: boolean }
interface Tile { tile: string; kind: string; app?: string; name?: string; apps?: string[]; extension?: string; panel?: string; size: string }
interface State { view: string; apps: App[]; board: Tile[]; pinned: string[]; hidden: string[]; portal: boolean; updates: Json[] }

const SIZES = ['s', 'm', 'l'];

function appOf(s: State, id: unknown): App {
  return s.apps.find((a) => a.id === id) ?? refuse(`formtray does not know the app ${String(id)}`);
}

function tileOf(s: State, id: unknown): Tile {
  return s.board.find((t) => t.tile === id) ?? refuse(`there is no tile ${String(id)} on the board`);
}

function size(v: unknown, d = 'm'): string {
  const x = v === undefined ? d : String(v);
  if (!SIZES.includes(x)) refuse(`${x} is not a tile size (s, m or l)`);
  return x;
}

function apps(s: State) {
  return s.apps.map((a) => ({ ...a, hidden: s.hidden.includes(a.id), pinned: s.pinned.includes(a.id), onBoard: s.board.some((t) => t.app === a.id || t.apps?.includes(a.id)) }));
}

const board = 'board';
const sim: AppSim<State> = {
  product: 'formtray',
  app: 'formtray',
  appVersion: '0.15.0',
  docLabel: 'Board',
  title: (s) => `formtray - ${s.view}`,
  initial: () => ({
    view: 'widgets',
    apps: [
      { id: 'formvis', name: 'FormVis', category: 'image', installed: true, running: true },
      { id: 'formcut', name: 'FormCut', category: 'motion', installed: true, running: true },
      { id: 'formwav', name: 'FormWav', category: 'sound', installed: true, running: false },
      { id: 'formencoder', name: 'FormEncoder', category: 'sound', installed: true, running: false },
      { id: 'formpdf', name: 'FormPDF', category: 'document', installed: true, running: false },
      { id: 'formportal', name: 'FormPortal', category: 'family', installed: true, running: false },
    ],
    board: [
      { tile: 'formvis', kind: 'app', app: 'formvis', size: 'l' },
      { tile: 'formcut', kind: 'app', app: 'formcut', size: 'l' },
      { tile: 'group-mh2k1x', kind: 'group', name: 'Sound', apps: ['formwav', 'formencoder'], size: 'm' },
      { tile: 'updates', kind: 'updates', size: 's' },
    ],
    pinned: ['formvis', 'formcut'],
    hidden: [],
    portal: true,
    updates: [{ app: 'formvis', from: '2.0.3', to: '2.1.0' }],
  }),
  defaultRead: 'all',
  reads: {
    all: (s) => ({ product: 'formtray', view: s.view, apps: apps(s), board: s.board, pinned: s.pinned, hidden: s.hidden, portal: s.portal, updates: s.updates }),
    apps: (s) => ({ apps: apps(s) }),
    board: (s) => ({ board: s.board }),
    pinned: (s) => ({ pinned: s.pinned }),
    hidden: (s) => ({ hidden: s.hidden }),
    updates: (s) => ({ portal: s.portal, updates: s.updates }),
    view: (s) => ({ view: s.view }),
  },
  apply: 'atomic',
  undo: false,
  applyKinds: [board],
  cmds: {
    'board.add': { title: 'Add to Board', kind: board, args: { app: 'app id', size: 's|m|l' }, fn: (s, a) => { const ap = appOf(s, a.app); if (s.board.some((t) => t.tile === ap.id)) refuse(`${ap.name} is already on the board`); s.board.push({ tile: ap.id, kind: 'app', app: ap.id, size: size(a.size) }); return { tile: ap.id }; } },
    'board.remove': { title: 'Remove from Board', kind: board, args: { tile: 'tile id' }, fn: (s, a) => { tileOf(s, a.tile); s.board = s.board.filter((t) => t.tile !== a.tile); return {}; } },
    'board.resize': { title: 'Resize Tile', kind: board, args: { tile: 'tile id', size: 's|m|l' }, fn: (s, a) => ((tileOf(s, a.tile).size = size(a.size)), {}) },
    'board.move': { title: 'Move Tile', kind: board, args: { tile: 'tile id', index: 'number' }, fn: (s, a) => { const t = tileOf(s, a.tile); s.board = s.board.filter((x) => x !== t); s.board.splice(Math.max(0, Math.min(s.board.length, Number(a.index))), 0, t); return {}; } },
    'group.create': { title: 'New Group', kind: board, args: { name: 'string', apps: 'app ids?', size: 's|m|l' }, fn: (s, a) => { if (!a.name) invalid('name is required'); (a.apps ?? []).forEach((x: string) => appOf(s, x)); const tile = uid('group-'); s.board.push({ tile, kind: 'group', name: String(a.name), apps: a.apps ?? [], size: size(a.size) }); return { tile }; } },
    'group.rename': { title: 'Rename Group', kind: board, args: { tile: 'group tile', name: 'string' }, fn: (s, a) => ((tileOf(s, a.tile).name = String(a.name)), {}) },
    'group.add': { title: 'Add to Group', kind: board, args: { tile: 'group tile', app: 'app id' }, fn: (s, a) => { const t = tileOf(s, a.tile); appOf(s, a.app); t.apps = [...new Set([...(t.apps ?? []), a.app])]; return {}; } },
    'group.remove': { title: 'Remove from Group', kind: board, args: { tile: 'group tile', app: 'app id' }, fn: (s, a) => { const t = tileOf(s, a.tile); t.apps = (t.apps ?? []).filter((x) => x !== a.app); return {}; } },
    'stack.pin': { title: 'Pin to Stack', kind: board, args: { app: 'app id' }, fn: (s, a) => ((s.pinned = [...new Set([...s.pinned, appOf(s, a.app).id])]), {}) },
    'stack.unpin': { title: 'Unpin', kind: board, args: { app: 'app id' }, fn: (s, a) => ((s.pinned = s.pinned.filter((x) => x !== appOf(s, a.app).id)), {}) },
    'app.hide': { title: 'Hide App', kind: board, args: { app: 'app id' }, fn: (s, a) => ((s.hidden = [...new Set([...s.hidden, appOf(s, a.app).id])]), {}) },
    'app.unhide': { title: 'Show App', kind: board, args: { app: 'app id' }, fn: (s, a) => ((s.hidden = s.hidden.filter((x) => x !== appOf(s, a.app).id)), {}) },
    'app.open': { title: 'Open App', kind: 'action', args: { app: 'app id' }, fn: (s, a) => ((appOf(s, a.app).running = true), {}) },
    'app.quit': { title: 'Quit App', kind: 'action', args: { app: 'app id' }, fn: (s, a) => ((appOf(s, a.app).running = false), {}) },
    'view.show': { title: 'Show View', kind: 'action', args: { view: 'switcher|stack|apps|windows|widgets' }, fn: (s, a) => { if (!['switcher', 'stack', 'apps', 'windows', 'widgets'].includes(a.view)) refuse(`${a.view} is not a view`); s.view = a.view; return {}; } },
    'apps.rescan': { title: 'Find Apps Again', kind: 'action', fn: () => ({}) },
    'updates.open': { title: 'Open Updates', kind: 'action', fn: () => ({}) },
  },
  changed: (p, n) => {
    const out = [];
    const what = (['board', 'pinned', 'hidden'] as const).filter((k) => JSON.stringify(p[k]) !== JSON.stringify(n[k]));
    if (what.length) out.push({ name: 'document.changed', data: { what } });
    if (p.view !== n.view) out.push({ name: 'selection.changed', data: { view: n.view } });
    if (JSON.stringify(p.apps) !== JSON.stringify(n.apps)) out.push({ name: 'apps.changed', data: { running: n.apps.filter((a) => a.running).map((a) => a.id) } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'the board, pins or hidden list changed', sample: () => ({ what: ['board'] }) },
    { name: 'selection.changed', note: 'formtray switched to another view', sample: (s) => ({ view: s.view }) },
    { name: 'apps.changed', note: 'an app was opened or quit', sample: (s) => ({ running: s.apps.filter((a) => a.running).map((a) => a.id) }) },
  ],
  offers: { filesOpen: true, filesSave: false, fetch: false, notes: ['files.save: -32003, formtray has no save dialog', 'no undo: document.apply saves once, all or nothing, and shows the label as a toast'] },
  tokens: {},
  view: (s) => `<div class="sim-board">${s.board.map((t) => `<span class="sim-tile" data-size="${t.size}">${esc(t.kind === 'group' ? `${t.name}: ${t.apps?.join(', ')}` : t.kind === 'updates' ? 'Updates' : t.app ?? t.tile)}</span>`).join('')}</div><div class="sim-m">view ${esc(s.view)}, pinned ${esc(s.pinned.join(', '))}${s.hidden.length ? `, hidden ${esc(s.hidden.join(', '))}` : ''}</div>`,
  samples: ['notes.txt'],
};

export default sim;
