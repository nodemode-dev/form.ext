import { api, errorMessage } from './api';
import { emit, on, connect, isLive, reconnect, events } from './events';
import { project, restore as restoreProject, close as closeProject, toProjectRef } from './project';
import { notify, mountToasts } from './toast';
import { dialog, mountDialogs, isDialogOpen } from './dialog';
import { commands, bindKeys, register } from './commands';
import { mountPalette, openPalette, pick, isPaletteOpen } from './palette';
import { toggleTheme, themeMode } from './theme';
import { icon, brandMark } from './icons';
import { esc, qs, setText, keyLabel, isMac } from './dom';
import { productName } from './products';
import { storage } from './storage';
import { VERSION } from './version';
import type { PaneDef, ShellContext, ProjectRef } from './types';

const GROUPS: { id: NonNullable<PaneDef['group']>; title: string }[] = [
  { id: 'make', title: 'Make' },
  { id: 'ship', title: 'Ship' },
  { id: 'learn', title: 'Learn' },
];
const LAST_PANE = 'formext.pane';

interface Slot {
  def: PaneDef;
  el: HTMLElement;
  nav: HTMLButtonElement;
  mounted: boolean;
  cleanup?: () => void;
}

const slots = new Map<string, Slot>();
const args = new Map<string, unknown>();
let activeId = '';

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
  const rank = (g: PaneDef['group']) => GROUPS.findIndex((x) => x.id === (g ?? 'make'));
  return found.sort((a, b) => rank(a.group) - rank(b.group) || a.order - b.order || a.title.localeCompare(b.title));
}

function buildLayout(defs: PaneDef[]): void {
  const side = qs(document, '.fx-sidebar');
  const main = qs(document, '.fx-main');
  for (const g of GROUPS) {
    const inGroup = defs.filter((d) => (d.group ?? 'make') === g.id);
    if (!inGroup.length) continue;
    const group = document.createElement('nav');
    group.className = 'fx-group';
    group.setAttribute('aria-label', g.title);
    group.innerHTML = `<div class="fx-group-title">${g.title}</div>`;
    for (const def of inGroup) {
      const nav = document.createElement('button');
      nav.type = 'button';
      nav.className = 'fx-nav';
      nav.dataset.pane = def.id;
      nav.innerHTML = `${icon(def.icon)}<span class="ellipsis">${esc(def.title)}</span>`;
      nav.addEventListener('click', () => openPane(def.id));
      group.append(nav);
      const el = document.createElement('section');
      el.className = 'fx-pane';
      el.dataset.pane = def.id;
      el.setAttribute('aria-label', def.title);
      main.append(el);
      slots.set(def.id, { def, el, nav, mounted: false });
    }
    side.append(group);
  }
  if (!defs.length) {
    main.innerHTML = `<div class="empty" style="height:100%">${icon('puzzle')}<h3>No panes yet</h3><p>Panes live in frontend/src/panes/&lt;name&gt;/index.ts and export a pane.</p></div>`;
  }
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
  if (activeId !== id) {
    const prev = slots.get(activeId);
    if (prev) {
      prev.el.classList.remove('active');
      prev.nav.removeAttribute('aria-current');
    }
    mount(slot);
    slot.el.classList.add('active');
    slot.nav.setAttribute('aria-current', 'page');
    activeId = id;
    storage.set(LAST_PANE, id);
    const hash = `#/${id}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
    document.title = `${slot.def.title} - form.ext`;
  }
  emit('pane.open', { id, args: a });
}

function initialPane(defs: PaneDef[]): string {
  const fromHash = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  if (fromHash && slots.has(fromHash)) return fromHash;
  const last = storage.get(LAST_PANE);
  if (last && slots.has(last)) return last;
  if (slots.has('home')) return 'home';
  return defs[0]?.id ?? '';
}

function renderProject(p: ProjectRef | null): void {
  const chip = qs(document, '.fx-project');
  chip.dataset.empty = String(!p);
  setText(chip.querySelector('.name'), p ? p.name : 'No project open');
  const prod = chip.querySelector<HTMLElement>('.chip')!;
  prod.classList.toggle('hidden', !p || !p.product);
  if (p && p.product) {
    prod.dataset.product = p.product;
    setText(prod, productName(p.product));
  }
  chip.title = p ? `${p.name}${p.dir ? `\n${p.dir}` : ''}` : 'Open a project';
  setText(document.querySelector('[data-status="project"] span'), p ? p.dir || p.id : 'No project');
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
  register({ id: 'shell.close-project', title: 'Close Project', icon: 'close', run: closeProject });
  register({ id: 'shell.theme', title: 'Toggle Light and Dark Theme', keys: 'Mod+Shift+L', icon: 'sun', run: toggleTheme });
  register({ id: 'shell.reconnect', title: 'Reconnect to the Engine', icon: 'refresh', run: () => { reconnect(); void checkEngine(); } });
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
  qs(document, '.fx-brand').insertAdjacentHTML('afterbegin', brandMark);
  setText(document.querySelector('[data-status="version"]'), `form.ext ${VERSION}`);
  document.querySelectorAll<HTMLElement>('[data-keys]').forEach((el) => setText(el, keyLabel(el.dataset.keys!).join(isMac ? '' : ' ')));
  mountToasts(qs(document, '.fx-toasts'));
  mountDialogs(qs(document, '.fx-scrim'), qs<HTMLFormElement>(document, '.fx-dialog'));
  mountPalette(qs(document, '.fx-palette'));

  const defs = discover();
  buildLayout(defs);
  registerBuiltins(defs);
  bindKeys(() => isDialogOpen() || isPaletteOpen());

  renderTheme();
  renderProject(null);
  renderEngine('wait', 'Engine starting');
  on('shell.theme', renderTheme);
  project.onChange(renderProject);
  on('live.status', (s: { connected: boolean }) => {
    if (s.connected) void checkEngine();
    else renderEngine('down', 'Engine offline');
  });

  qs(document, '.fx-project').addEventListener('click', () => void chooseProject());
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

  const first = initialPane(defs);
  if (first) openPane(first);

  connect();
  void checkEngine();
  const restoring = restoreProject().catch(() => undefined);
  void Promise.race([restoring, new Promise((done) => window.setTimeout(done, 1500))]).then(() => requestAnimationFrame(revealed));

  (window as unknown as { formextShell: unknown }).formextShell = { ctx, openPane, panes, activePane, chooseProject, pick, toggleTheme };
}
