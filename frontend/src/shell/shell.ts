import { api, errorMessage } from './api';
import { emit, on, connect, isLive, reconnect, events } from './events';
import { project, restore as restoreProject, close as closeProject, toProjectRef } from './project';
import { notify, mountToasts } from './toast';
import { dialog, mountDialogs, isDialogOpen } from './dialog';
import { commands, bindKeys, register, run as commandRun } from './commands';
import { mountPalette, openPalette, pick, isPaletteOpen } from './palette';
import { toggleTheme, themeMode } from './theme';
import { icon } from './icons';
import { esc, qs, setText, keyLabel, isMac } from './dom';
import { productName, appArt } from './products';
import { storage } from './storage';
import { VERSION } from './version';
import { openSettings, settingsOpen, loadSettings } from './settings';
import { mountMenubar } from './menubar';
import { buildNativeMenus, wantsNativeMenus } from './native-menu';
import type { PaneDef, ShellContext, ProjectRef } from './types';

interface NavItem {
  key: string;
  icon: string;
  label: string;
  pane: string;
  args?: unknown;
  count?: boolean;
  group?: string;
}

const START_NAV: NavItem[] = [
  { key: 'home', icon: 'home', label: 'Home', pane: 'home' },
  { key: 'recent', icon: 'folder-open', label: 'Recent', pane: 'home', args: { section: 'recent' }, count: true },
  { key: 'registry', icon: 'library', label: 'Registry', pane: 'library', args: { action: 'examples', from: 'start' }, count: true },
  { key: 'docs', icon: 'docs', label: 'Docs', pane: 'docs', group: 'Learn' },
];
const LAST_PANE = 'formext.pane';
const RAIL_KEY = 'formext.rail';

interface Slot {
  def: PaneDef;
  el: HTMLElement;
  mounted: boolean;
  cleanup?: () => void;
}

const slots = new Map<string, Slot>();
const args = new Map<string, unknown>();
const navs = new Map<string, HTMLButtonElement>();
let activeId = '';

export function setNavCount(key: string, n: number): void {
  setText(navs.get(key)?.querySelector('.cnt') ?? null, String(n));
}

export function setStatus(key: string, text: string): void {
  setText(document.querySelector(`[data-status="${key}"]`), text);
}

export function partRoot(id: string): HTMLElement | null {
  const slot = slots.get(id);
  if (!slot) return null;
  mount(slot);
  return slot.el;
}

export function layoutOf(id: string): 'start' | 'studio' {
  return slots.get(id)?.def.view === 'start' ? 'start' : 'studio';
}

export const ctx: ShellContext = {
  api,
  events,
  project,
  notify,
  openPane,
  commands,
  dialog,
};

export function lastArgs(id: string): unknown {
  return args.get(id);
}

export function activePane(): string {
  return activeId;
}

export function panes(): PaneDef[] {
  return [...slots.values()].map((s) => s.def);
}

function discover(): PaneDef[] {
  const mods = import.meta.glob<{ pane?: PaneDef }>('../panes/*/index.ts', { eager: true });
  const found: PaneDef[] = [];
  for (const [path, mod] of Object.entries(mods)) {
    const def = mod.pane;
    if (!def || typeof def.mount !== 'function' || !def.id) {
      console.warn(`form.ext: ${path} exports no pane`);
      continue;
    }
    if (found.some((p) => p.id === def.id)) {
      console.warn(`form.ext: duplicate pane id ${def.id} in ${path}`);
      continue;
    }
    found.push(def);
  }
  return found.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function navButton(item: NavItem): HTMLButtonElement {
  const nav = document.createElement('button');
  nav.type = 'button';
  nav.className = 'fx-nav';
  nav.dataset.nav = item.key;
  nav.title = item.label;
  nav.innerHTML = `${icon(item.icon)}<span class="label">${esc(item.label)}</span>${item.count ? '<span class="cnt">0</span>' : ''}`;
  if (item.pane) nav.addEventListener('click', () => openPane(item.pane, item.args));
  navs.set(item.key, nav);
  return nav;
}

function buildLayout(defs: PaneDef[]): void {
  const main = qs(document, '.fx-main');
  for (const def of defs) {
    const el = document.createElement('section');
    el.className = def.view === 'part' ? 'fx-pane part' : 'fx-pane';
    el.dataset.pane = def.id;
    el.setAttribute('aria-label', def.title);
    main.append(el);
    slots.set(def.id, { def, el, mounted: false });
  }
  if (!defs.length) {
    main.innerHTML = `<div class="empty" style="height:100%">${icon('puzzle')}<h3>No panes yet</h3><p>Panes live in frontend/src/panes/&lt;name&gt;/index.ts and export a pane.</p></div>`;
  }
  qs(document, '.fx-side-brand').innerHTML = `<span class="fx-brandart">${appArt('formext')}</span><div><b>form.ext</b><small>by nodemode.ai</small></div>`;
  const nav = qs(document, '.fx-side-nav');
  let group = '';
  for (const item of START_NAV) {
    if (item.group && item.group !== group) {
      group = item.group;
      nav.insertAdjacentHTML('beforeend', `<div class="fx-group-title">${esc(group)}</div>`);
    }
    nav.append(navButton(item));
  }
  const foot = qs(document, '.fx-side-foot');
  foot.append(
    navButton({ key: 'prefs', icon: 'settings', label: 'Preferences', pane: '' }),
    navButton({ key: 'help', icon: 'help', label: 'Help', pane: '' }),
  );
  navs.get('prefs')!.onclick = () => void commandRun('settings');
  navs.get('help')!.onclick = () => openPane('docs', { doc: 'manual' });
  const edge = qs(document, '.fx-edge');
  edge.addEventListener('click', () => {
    const rail = document.documentElement.dataset.rail !== '1';
    if (rail) document.documentElement.dataset.rail = '1';
    else document.documentElement.removeAttribute('data-rail');
    storage.set(RAIL_KEY, rail ? '1' : '0');
  });
}

function mount(slot: Slot): void {
  if (slot.mounted) return;
  slot.mounted = true;
  try {
    const out = slot.def.mount(slot.el, ctx);
    if (typeof out === 'function') slot.cleanup = out;
  } catch (err) {
    console.error(err);
    slot.el.innerHTML = `<div class="empty" style="height:100%">${icon('error')}<h3>${esc(slot.def.title)} could not start</h3><p>${esc(errorMessage(err))}</p></div>`;
  }
}

export function openPane(id: string, a?: unknown): void {
  const slot = slots.get(id);
  if (!slot) {
    notify(`There is no ${id} pane.`, 'warning');
    return;
  }
  if (a !== undefined) args.set(id, a);
  if (slot.def.view === 'part') {
    openPane('studio');
    mount(slot);
    emit('pane.open', { id, args: a });
    emit('studio.part', { id, args: a });
    return;
  }
  if (activeId !== id) {
    const prev = slots.get(activeId);
    if (prev) prev.el.classList.remove('active');
    mount(slot);
    slot.el.classList.add('active');
    activeId = id;
    document.documentElement.dataset.layout = layoutOf(id);
    storage.set(LAST_PANE, id);
    const hash = `#/${id}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    document.title = `${slot.def.title} - form.ext`;
    const key = id === 'new' ? 'home' : id;
    for (const [k, nav] of navs) {
      if (k === key && !(k === 'recent')) nav.setAttribute('aria-current', 'page');
      else nav.removeAttribute('aria-current');
    }
  }
  emit('pane.open', { id, args: a });
}

function initialPane(defs: PaneDef[]): string {
  const usable = (id: string | null): id is string => !!id && slots.has(id) && slots.get(id)!.def.view !== 'part';
  const fromHash = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  if (usable(fromHash)) return fromHash;
  const last = storage.get(LAST_PANE);
  if (usable(last)) return last;
  if (slots.has('home')) return 'home';
  return defs[0]?.id ?? '';
}

function renderProject(p: ProjectRef | null): void {
  const doc = qs(document, '.fx-tb-doc');
  doc.classList.toggle('on', !!p);
  const html = p ? `<i class="dotf"></i>${esc(p.name)}${p.product ? `<em>${esc(productName(p.product))}</em>` : ''}` : '';
  if (doc.innerHTML !== html) doc.innerHTML = html;
  setText(document.querySelector('[data-status="project"] span'), p ? p.name : 'No project');
  const title = p ? `${p.name} - form.ext` : 'form.ext';
  document.title = title;
  if ('__TAURI_INTERNALS__' in window) {
    void import('@tauri-apps/api/core').then((m) => m.invoke('set_window_title', { title })).catch(() => undefined);
  }
}

function renderEngine(state: 'up' | 'down' | 'wait', label: string): void {
  const el = qs(document, '[data-status="engine"]');
  el.dataset.state = state;
  setText(el.querySelector('span:last-child'), label);
}

function renderTheme(): void {
  const btn = qs(document, '[data-action="theme"]');
  const dark = themeMode() === 'dark';
  btn.innerHTML = icon(dark ? 'sun' : 'moon');
  btn.title = dark ? 'Light theme' : 'Dark theme';
  btn.setAttribute('aria-label', btn.title);
}

function paintTitleButtons(): void {
  qs(document, '[data-action="palette"]').innerHTML = icon('search');
  qs(document, '[data-action="settings"]').innerHTML = icon('settings');
}

export async function chooseProject(): Promise<void> {
  let list: unknown[] = [];
  try {
    const raw = await api.get<unknown>('/api/projects');
    list = Array.isArray(raw) ? raw : Array.isArray((raw as { projects?: unknown[] })?.projects) ? (raw as { projects: unknown[] }).projects : [];
  } catch (err) {
    notify(errorMessage(err), 'error');
  }
  const refs = list.map((r) => toProjectRef(r));
  const extra = [];
  if (slots.has('new')) extra.push({ id: '__new', title: 'New Extension', icon: 'plus' });
  if (slots.has('home')) extra.push({ id: '__home', title: 'Open Folder or Import', icon: 'folder-open' });
  if (project.current()) extra.push({ id: '__close', title: 'Close Project', icon: 'close' });
  const picked = await pick(
    [...refs.map((r) => ({ id: r.id, title: r.name, detail: r.product ? productName(r.product) : r.dir, icon: 'puzzle' })), ...extra],
    refs.length ? 'Open a project' : 'No projects yet',
  );
  if (!picked) return;
  if (picked === '__new') return openPane('new');
  if (picked === '__home') return openPane('home');
  if (picked === '__close') return closeProject();
  try {
    await project.open(picked);
  } catch (err) {
    notify(errorMessage(err), 'error');
  }
}

async function checkEngine(): Promise<void> {
  try {
    const h = await api.get<{ version?: string }>('/api/health');
    renderEngine('up', h && typeof h === 'object' && h.version ? `Engine ${h.version}` : 'Engine ready');
  } catch {
    renderEngine('down', 'Engine offline');
  }
}

function registerBuiltins(defs: PaneDef[]): void {
  register({ id: 'shell.palette', title: 'Command Palette', keys: 'Mod+K', icon: 'command', run: openPalette });
  register({ id: 'shell.palette-alt', title: 'Command Palette', keys: 'Mod+Shift+P', icon: 'command', run: openPalette });
  register({ id: 'shell.project', title: 'Open Project', keys: 'Mod+O', icon: 'folder-open', run: chooseProject });
  register({ id: 'shell.close-project', title: 'Close Project', icon: 'close', run: () => { closeProject(); openPane('home'); } });
  register({ id: 'shell.theme', title: 'Toggle Light and Dark Theme', keys: 'Mod+Shift+L', icon: 'sun', run: toggleTheme });
  register({ id: 'shell.reconnect', title: 'Reconnect to the Engine', icon: 'refresh', run: () => { reconnect(); void checkEngine(); } });
  register({ id: 'settings', title: 'Preferences...', keys: 'Mod+,', icon: 'settings', run: () => openSettings() });
  register({
    id: 'shell.about',
    title: 'About form.ext',
    icon: 'info',
    run: () => void dialog.form('About form.ext', `<p>form.ext ${esc(VERSION)} makes, previews, checks, packages, signs and publishes extensions for every Form app.</p><p class="hint">Apache-2.0. nodemode.ai</p><span data-ok="Done" hidden></span>`),
  });
  defs.forEach((d, i) => {
    register({ id: `pane.${d.id}`, title: `Go to ${d.title}`, keys: i < 9 ? `Mod+${i + 1}` : undefined, icon: d.icon, run: () => openPane(d.id) });
  });
}

function revealed(): void {
  document.body.classList.add('app-ready');
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI_INTERNALS__) {
    requestAnimationFrame(() => {
      import('@tauri-apps/api/core').then((m) => m.invoke('app_ready')).catch(() => undefined);
    });
  }
}

export function boot(): void {
  setText(document.querySelector('[data-status="version"]'), `v${VERSION}`);
  document.querySelectorAll<HTMLElement>('[data-keys]').forEach((el) => setText(el, keyLabel(el.dataset.keys!).join(isMac ? '' : ' ')));
  paintTitleButtons();
  mountToasts(qs(document, '.fx-toasts'));
  mountDialogs(qs(document, '.fx-scrim'), qs<HTMLFormElement>(document, '.fx-dialog'));
  mountPalette(qs(document, '.fx-palette'));

  const defs = discover();
  buildLayout(defs);
  registerBuiltins(defs);
  bindKeys(() => isDialogOpen() || isPaletteOpen() || settingsOpen());
  mountMenubar(qs(document, '.fx-menubar'));
  void loadSettings();

  renderTheme();
  renderProject(null);
  renderEngine('wait', 'Engine starting');
  on('shell.theme', renderTheme);
  project.onChange(renderProject);
  on('live.status', (s: { connected: boolean }) => {
    if (s.connected) void checkEngine();
    else renderEngine('down', 'Engine offline');
  });

  qs(document, '[data-action="settings"]').addEventListener('click', () => void commandRun('settings'));
  qs(document, '[data-action="palette"]').addEventListener('click', () => void openPalette());
  qs(document, '[data-action="theme"]').addEventListener('click', toggleTheme);
  qs(document, '[data-status="engine"]').addEventListener('click', () => {
    if (!isLive()) {
      reconnect();
      void checkEngine();
    }
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
    if (id && slots.has(id) && id !== activeId) openPane(id);
  });

  for (const slot of slots.values()) mount(slot);
  const first = initialPane(defs);
  if (first) openPane(first);
  if (wantsNativeMenus()) void buildNativeMenus().catch(() => document.documentElement.classList.remove('has-native-menus'));

  connect();
  void checkEngine();
  const restoring = restoreProject().catch(() => undefined);
  void Promise.race([restoring, new Promise((done) => window.setTimeout(done, 1500))]).then(() => requestAnimationFrame(revealed));

  (window as unknown as { formextShell: unknown }).formextShell = { ctx, openPane, panes, activePane, chooseProject, pick, toggleTheme };
}
