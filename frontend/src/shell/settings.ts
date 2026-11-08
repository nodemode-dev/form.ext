import { api, errorMessage } from './api';
import { esc } from './dom';
import { emit } from './events';
import { icon } from './icons';
import { HOSTS } from './products';
import { storage } from './storage';
import { theme } from './theme';
import { notify } from './toast';

type Json = Record<string, any>;

interface KeyRow {
  id: string;
  name: string;
}

type Row =
  | { kind: 'text'; label: string; path: string; ph?: string; ro?: boolean; stack?: boolean }
  | { kind: 'select'; label: string; path: string; options: () => [string, string][] }
  | { kind: 'toggle'; label: string; path: string }
  | { kind: 'slider'; label: string; path: string; min: number; max: number }
  | { kind: 'themes' }
  | { kind: 'note'; html: string };

interface Group {
  label: string;
  rows: Row[];
}

interface Section {
  id: string;
  icon: string;
  groups: Group[];
}

const RAIL_KEY = 'formext.prefs.rail';
const FOLD_KEY = 'formext.prefs.folded';

let keyRows: KeyRow[] = [];

const SECTIONS: Section[] = [
  {
    id: 'General',
    icon: 'sliders',
    groups: [
      {
        label: 'New extensions',
        rows: [
          { kind: 'text', label: 'Author', path: 'author' },
          { kind: 'text', label: 'Licence', path: 'licence' },
          { kind: 'select', label: 'App for New', path: 'default_product', options: () => HOSTS.map((h) => [h.id, h.name]) },
          { kind: 'note', html: 'Author and Licence are written into the manifest of every new project and every starter copy. Licence is an SPDX id such as Apache-2.0 or MIT. App for New is the host the New flow starts on.' },
        ],
      },
      {
        label: 'Settings storage',
        rows: [
          { kind: 'text', label: 'Data folder', path: 'home', ro: true, stack: true },
          { kind: 'note', html: 'Projects, builds and publisher keys live in this folder, with settings.json. <code>FORMEXT_HOME</code> sets another folder. The window&#39;s own choices (theme, open tabs, the manifest inspector) stay in the web view&#39;s storage.' },
        ],
      },
    ],
  },
  {
    id: 'Interface',
    icon: 'window',
    groups: [
      {
        label: 'Theme',
        rows: [
          { kind: 'themes' },
          { kind: 'note', html: 'Studio Dark or warm light paper, for the whole window. The command Toggle Light and Dark Theme has the shortcut <code>Mod+Shift+L</code>. The simulated app in Preview has its own theme.' },
        ],
      },
    ],
  },
  {
    id: 'Editor',
    icon: 'code',
    groups: [
      {
        label: 'Code editor',
        rows: [
          { kind: 'slider', label: 'Font size', path: 'editor.font_size', min: 10, max: 24 },
          { kind: 'slider', label: 'Tab size', path: 'editor.tab_size', min: 1, max: 8 },
          { kind: 'toggle', label: 'Wrap long lines', path: 'editor.wrap' },
          { kind: 'note', html: 'Used by the code editor for every file in the project: manifest.json, the entry page, scripts and styles. Tab size and wrapping apply to files opened afterwards.' },
        ],
      },
    ],
  },
  {
    id: 'Preview',
    icon: 'preview',
    groups: [
      {
        label: 'Simulated app',
        rows: [
          { kind: 'select', label: 'Theme', path: 'preview.theme', options: () => [['dark', 'Dark'], ['light', 'Light']] },
          { kind: 'select', label: 'Consent', path: 'preview.consent', options: () => [['ask', 'Ask'], ['grant', 'Grant'], ['deny', 'Deny']] },
          { kind: 'note', html: 'Theme is what the simulated host app tells the extension through <code>ext.theme</code>. Consent decides how the simulated host handles permissions: with Ask it shows its consent dialog once per version, before the extension&#39;s frame is created.' },
        ],
      },
    ],
  },
  {
    id: 'Publishing',
    icon: 'upload',
    groups: [
      {
        label: 'Signing',
        rows: [
          { kind: 'select', label: 'Publisher key', path: 'publisher', options: () => [['', 'None chosen'], ...keyRows.map((k): [string, string] => [k.id, `${k.name} (${k.id})`])] },
          { kind: 'note', html: 'The key that signs builds and submissions unless the Package pane is given another. New keys are made in the Package pane; this only picks the default.' },
        ],
      },
    ],
  },
  {
    id: 'Registry',
    icon: 'library',
    groups: [
      {
        label: 'Registry',
        rows: [
          { kind: 'text', label: 'Index address', path: 'registry.url', stack: true },
          { kind: 'text', label: 'Registry checkout', path: 'registry.checkout', ph: '/path/to/form.ext-registry', stack: true },
          { kind: 'note', html: 'The index address is the signed list form.ext downloads for the Library shelf; its signature is checked with the key compiled into this build. The checkout is a local clone of form.ext-registry so Submit to Registry can run the registry&#39;s own checks before a pull request.' },
        ],
      },
    ],
  },
  {
    id: 'FormPortal',
    icon: 'rocket',
    groups: [
      {
        label: 'Run in App',
        rows: [
          { kind: 'text', label: 'FormPortal folder', path: 'formportal_root', ph: 'default', stack: true },
          { kind: 'text', label: 'FormPortal command line', path: 'formportal_cli', ph: 'default', stack: true },
          { kind: 'note', html: 'The folder is where dev.json is written. Empty uses FormPortal&#39;s own folder; <code>FORMPORTAL_ROOT</code> overrides this setting. The command line is used by Install with FormPortal; empty finds <code>formportal-cli</code> on PATH or in an installed FormPortal, and <code>FORMPORTAL_CLI</code> overrides it.' },
        ],
      },
    ],
  },
  {
    id: 'Developer',
    icon: 'terminal',
    groups: [
      {
        label: 'Developer',
        rows: [
          { kind: 'toggle', label: 'Developer mode', path: 'registry.developer' },
          { kind: 'note', html: 'Off unless you ask for it. When on and this build trusts no registry key yet, form.ext reads the registry index without checking its signature.' },
        ],
      },
      {
        label: 'Outside agents',
        rows: [
          { kind: 'text', label: 'MCP server', path: '__mcp', ro: true, stack: true },
          { kind: 'note', html: 'Claude Code, Codex and Cursor use the same engine through the command line and the MCP server, so a change an agent makes appears in the open window at once. There is no switch here: the server is started by the agent.' },
        ],
      },
    ],
  },
];

let state: Json = { editor: {}, preview: {}, registry: {} };
let loaded = false;

function getPath(path: string): any {
  if (path === '__mcp') return './formext mcp';
  return path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), state);
}

function patchOf(path: string, value: unknown): Json {
  const keys = path.split('.');
  const out: Json = {};
  let cur = out;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) cur[k] = value;
    else cur = cur[k] = {};
  });
  return out;
}

function merge(into: Json, from: Json): Json {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object') merge(into[k], v);
    else into[k] = v;
  }
  return into;
}

function apply(s: Json): void {
  document.documentElement.style.setProperty('--edit-font', `${Number(s.editor?.font_size) || 13}px`);
  emit('settings.changed', s);
}

export async function loadSettings(): Promise<void> {
  try {
    state = await api.get<Json>('/api/settings');
    loaded = true;
    apply(state);
  } catch {
    loaded = false;
  }
}

let pending: Json = {};
let timer = 0;

function queue(patch: Json): void {
  merge(pending, patch);
  merge(state, patch);
  window.clearTimeout(timer);
  timer = window.setTimeout(async () => {
    const body = pending;
    pending = {};
    try {
      state = await api.put<Json>('/api/settings', body);
      apply(state);
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }, 300);
}

let built = false;
let scrim: HTMLElement;
let dlg: HTMLElement;
let pages: HTMLElement;
let rail: HTMLElement;
let wire: SVGSVGElement;
let port: HTMLElement;
let current = 'General';
let wireD = '';
let portY = NaN;
let spyQueued = false;
let returnFocus: Element | null = null;
const folded = new Set<string>(((): string[] => {
  try {
    return JSON.parse(storage.get(FOLD_KEY) || '[]');
  } catch {
    return [];
  }
})());

function rowHtml(row: Row, idx: string): string {
  if (row.kind === 'note') return `<p class="pf-note">${row.html}</p>`;
  if (row.kind === 'themes') {
    return `<div class="pf-row pf-themes"><span>Theme</span><div class="pf-grid"><button type="button" class="pf-swatch dk" data-theme="dark" title="Studio Dark" aria-label="Studio Dark"><i></i></button><button type="button" class="pf-swatch lt" data-theme="light" title="Warm light paper" aria-label="Warm light paper"><i></i></button></div></div>`;
  }
  const id = `pf-${idx}`;
  if (row.kind === 'text') {
    return `<div class="pf-row${row.stack ? ' stack' : ''}"><label for="${id}">${esc(row.label)}</label><input class="pf-in${row.ro ? ' ro' : ''}" id="${id}" type="text" data-path="${esc(row.path)}" ${row.ro ? 'readonly' : ''} placeholder="${esc(row.ph ?? '')}" autocomplete="off" spellcheck="false" /></div>`;
  }
  if (row.kind === 'select') {
    return `<div class="pf-row"><label for="${id}">${esc(row.label)}</label><span class="pf-selwrap"><select class="pf-in" id="${id}" data-path="${esc(row.path)}"></select>${icon('chevron-down', 12)}</span></div>`;
  }
  if (row.kind === 'toggle') {
    return `<label class="pf-row pf-tg"><span>${esc(row.label)}</span><input type="checkbox" data-path="${esc(row.path)}" /><span class="pf-sw"><i></i></span></label>`;
  }
  return `<div class="pf-row pf-slider"><label for="${id}">${esc(row.label)}</label><div class="pf-sctl"><input type="range" id="${id}" data-path="${esc(row.path)}" min="${row.min}" max="${row.max}" step="1" /><output class="pf-in pf-num"></output></div></div>`;
}

function build(): void {
  built = true;
  scrim = document.createElement('div');
  scrim.className = 'pf-scrim';
  scrim.hidden = true;
  let n = 0;
  const sections = SECTIONS.map(
    (s) =>
      `<section class="pf-sec" data-section="${s.id}" role="tabpanel"><button class="pf-sechead" type="button" aria-expanded="true"><span class="pf-secicon">${icon(s.icon, 16)}</span><span class="pf-seclabel">${s.id}</span><span class="pf-chev">${icon('chevron-down', 16)}</span></button><div class="pf-secbody">${s.groups
        .map((g) => `<section class="pf-group"><h3 class="pf-label">${esc(g.label)}</h3>${g.rows.map((r) => rowHtml(r, String(n++))).join('')}</section>`)
        .join('')}</div></section>`,
  ).join('');
  const tabs = SECTIONS.map((s) => `<button class="pf-tab" type="button" role="tab" data-section="${s.id}" title="${s.id}"><span class="pf-tabicon">${icon(s.icon, 18)}</span><span class="pf-tablabel">${s.id}</span></button>`).join('');
  scrim.innerHTML = `<div class="pf-dlg" role="dialog" aria-modal="true" aria-label="Preferences">
    <div class="pf-head"><span class="pf-headicon">${icon('settings', 16)}</span><span class="pf-title">Preferences</span><button class="pf-x" type="button" aria-label="Close">${icon('close', 16)}</button></div>
    <div class="pf-body"><div class="pf-pages">${sections}</div></div>
    <div class="pf-foot"><button class="btn primary pf-done" type="button">Done</button></div>
    <div class="pf-rail"><div class="pf-nav" role="tablist">${tabs}</div><button class="pf-fold" type="button" aria-label="Collapse tabs" aria-expanded="true">${icon('chevron-left', 16)}</button></div>
    <svg class="pf-wire" aria-hidden="true"><path class="pf-shade"></path><path class="pf-line"></path></svg><span class="pf-port"></span>
  </div>`;
  document.body.append(scrim);
  dlg = scrim.querySelector('.pf-dlg')!;
  pages = scrim.querySelector('.pf-pages')!;
  rail = scrim.querySelector('.pf-rail')!;
  wire = scrim.querySelector('.pf-wire')!;
  port = scrim.querySelector('.pf-port')!;
  dlg.classList.toggle('is-rail-collapsed', storage.get(RAIL_KEY) === '1');
  for (const name of folded) foldSection(name, true);

  scrim.querySelector('.pf-x')!.addEventListener('click', close);
  scrim.querySelector('.pf-done')!.addEventListener('click', close);
  scrim.addEventListener('pointerdown', (ev) => {
    if (ev.target === scrim) close();
  });
  scrim.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close();
    }
  });
  rail.querySelector('.pf-nav')!.addEventListener('click', (ev) => {
    const tab = (ev.target as HTMLElement).closest<HTMLElement>('.pf-tab');
    if (tab) showSection(tab.dataset.section!, 'smooth');
  });
  const fold = rail.querySelector<HTMLElement>('.pf-fold')!;
  fold.addEventListener('click', () => {
    const on = !dlg.classList.contains('is-rail-collapsed');
    dlg.classList.toggle('is-rail-collapsed', on);
    fold.setAttribute('aria-expanded', String(!on));
    fold.setAttribute('aria-label', on ? 'Expand tabs' : 'Collapse tabs');
    storage.set(RAIL_KEY, on ? '1' : '0');
    queueWire();
  });
  pages.addEventListener('click', (ev) => {
    const head = (ev.target as HTMLElement).closest<HTMLElement>('.pf-sechead');
    if (head) foldSection(head.parentElement!.dataset.section!);
  });
  pages.addEventListener('scroll', queueSpy, { passive: true });
  window.addEventListener('resize', queueWire);

  pages.addEventListener('input', (ev) => onInput(ev.target as HTMLInputElement));
  pages.addEventListener('change', (ev) => onInput(ev.target as HTMLInputElement));
  pages.addEventListener('click', (ev) => {
    const sw = (ev.target as HTMLElement).closest<HTMLElement>('.pf-swatch');
    if (sw) {
      theme.set(sw.dataset.theme === 'light' ? 'light' : 'dark');
      queue({ theme: theme.mode() });
      paintThemes();
    }
  });
}

function onInput(t: HTMLInputElement): void {
  const path = t.dataset?.path;
  if (!path) return;
  let value: unknown = t.value;
  if (t.type === 'checkbox') value = t.checked;
  else if (t.type === 'range') {
    value = Number(t.value);
    paintRange(t);
  } else if (t.tagName === 'INPUT') value = t.value.trim();
  queue(patchOf(path, value));
}

function paintRange(t: HTMLInputElement): void {
  const min = Number(t.min);
  const max = Number(t.max);
  t.style.setProperty('--pct', `${((Number(t.value) - min) / (max - min)) * 100}%`);
  const out = t.parentElement!.querySelector('output');
  if (out) out.textContent = t.value;
}

function paintThemes(): void {
  for (const b of scrim.querySelectorAll<HTMLElement>('.pf-swatch')) b.classList.toggle('on', b.dataset.theme === theme.mode());
}

function sync(): void {
  for (const sel of scrim.querySelectorAll<HTMLSelectElement>('select[data-path]')) {
    const row = SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.rows)).find((r) => r.kind === 'select' && r.path === sel.dataset.path);
    if (row && row.kind === 'select') sel.innerHTML = row.options().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  }
  for (const el of scrim.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-path]')) {
    const v = getPath(el.dataset.path!);
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = !!v;
    else if (el instanceof HTMLInputElement && el.type === 'range') {
      el.value = String(v ?? el.min);
      paintRange(el);
    } else el.value = v == null ? '' : String(v);
  }
  paintThemes();
}

function foldSection(name: string, silent = false): void {
  const sec = pages.querySelector<HTMLElement>(`.pf-sec[data-section="${name}"]`);
  if (!sec) return;
  const on = silent ? true : !sec.classList.contains('is-folded');
  sec.classList.toggle('is-folded', on);
  sec.querySelector('.pf-sechead')!.setAttribute('aria-expanded', String(!on));
  if (!silent) {
    if (on) folded.add(name);
    else folded.delete(name);
    storage.set(FOLD_KEY, JSON.stringify([...folded]));
    queueWire();
  }
}

function markSection(name: string): void {
  current = name;
  for (const s of pages.querySelectorAll<HTMLElement>('.pf-sec')) s.classList.toggle('is-current', s.dataset.section === name);
  for (const t of rail.querySelectorAll<HTMLElement>('.pf-tab')) {
    const on = t.dataset.section === name;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  }
  queueWire();
}

function showSection(name: string, behavior: ScrollBehavior): void {
  const sec = pages.querySelector<HTMLElement>(`.pf-sec[data-section="${name}"]`);
  if (!sec) return;
  if (sec.classList.contains('is-folded')) foldSection(name);
  markSection(name);
  pages.scrollTo({ top: sec.offsetTop - pages.offsetTop - 12, behavior });
}

function queueSpy(): void {
  if (spyQueued) return;
  spyQueued = true;
  requestAnimationFrame(() => {
    spyQueued = false;
    const top = pages.getBoundingClientRect().top + 24;
    let best = current;
    for (const s of pages.querySelectorAll<HTMLElement>('.pf-sec')) {
      if (s.getBoundingClientRect().top <= top) best = s.dataset.section!;
    }
    if (best !== current) markSection(best);
  });
}

function queueWire(): void {
  requestAnimationFrame(drawWire);
}

function drawWire(): void {
  if (scrim.hidden) return;
  const tab = rail.querySelector<HTMLElement>('.pf-tab.is-active');
  if (!tab) return;
  const f = dlg.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  const h = dlg.querySelector('.pf-head')!.getBoundingClientRect();
  const r = rail.getBoundingClientRect();
  const sx = t.right - f.left;
  const ty = t.top + t.height / 2 - f.top;
  const trunk = (r.right - f.left) / 2;
  const py = h.bottom - f.top;
  const dir = py >= ty ? 1 : -1;
  const rad = Math.min(10, Math.abs(py - ty) / 2);
  const d = `M ${sx} ${ty} H ${trunk - rad} a ${rad} ${rad} 0 0 ${dir === 1 ? 1 : 0} ${rad} ${dir * rad} V ${py - dir * rad} a ${rad} ${rad} 0 0 ${dir === 1 ? 0 : 1} ${rad} ${dir * rad} H -7`;
  if (d !== wireD) {
    wireD = d;
    for (const p of wire.querySelectorAll('path')) p.setAttribute('d', d);
  }
  if (py !== portY) {
    portY = py;
    port.style.transform = `translateY(${py}px)`;
  }
}

async function refresh(): Promise<void> {
  try {
    const r = await api.get<{ keys: KeyRow[] }>('/api/keys');
    keyRows = r.keys;
  } catch {
    keyRows = [];
  }
  if (!scrim.hidden) sync();
}

export function openSettings(section?: string): void {
  if (!built) build();
  returnFocus = document.activeElement;
  sync();
  scrim.hidden = false;
  scrim.classList.add('open');
  showSection(section || current, 'auto');
  scrim.querySelector<HTMLElement>('.pf-done')!.focus();
  void refresh();
  if (!loaded) void loadSettings().then(sync);
}

export function closeSettings(): void {
  close();
}

function close(): void {
  if (!built || scrim.hidden) return;
  scrim.hidden = true;
  scrim.classList.remove('open');
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
}

export function settingsOpen(): boolean {
  return built && !scrim.hidden;
}
