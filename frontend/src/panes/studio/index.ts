import './studio.css';
import { icon, appIcon, esc, setText, storage, productName, chooseProject, errorMessage, apiUrl, ApiError, activePane } from '../../shell';
import { mountZones } from './zones';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';
import { Text, makeState, createView, minimalChange, goTo, languageName, editorPrefs } from './editor';
import type { EditorState } from './editor';
import { Transaction } from '@codemirror/state';
import { FileTree } from './tree';
import type { FileInfo } from './tree';
import { ManifestForm, formatManifest } from './manifest';
import type { Manifest } from './manifest';

interface FileAnswer {
  path: string;
  size: number;
  modified: number;
  encoding: 'utf-8' | 'base64';
  text?: string;
}

interface Buffer {
  path: string;
  state: EditorState | null;
  base: Text;
  size: number;
  binary: boolean;
  conflict: null | { kind: 'changed'; text: string } | { kind: 'deleted' };
  scroll: number;
  savedAt: number;
}

interface Session {
  pid: string;
  buffers: Map<string, Buffer>;
  loading: Map<string, Promise<Buffer | null>>;
  tabs: string[];
  active: string;
  files: FileInfo[];
  prefix: string;
}

interface OpenArgs {
  path?: string;
  line?: number;
  column?: number;
}

const SAVE_KEYS = 'Mod+S';
const SAVE_ALL_KEYS = 'Mod+Alt+S';
const IMAGE = /\.(png|webp|jpe?g|gif|svg)$/i;
const TOOLS = [
  { id: 'check', label: 'Check', icon: 'checklist', hint: 'Check reads the manifest and the code against the Extension Contract, as a host would.' },
  { id: 'preview', label: 'Preview', icon: 'preview', hint: 'Preview runs the extension in a simulated app and logs every call it makes to the host.' },
  { id: 'run', label: 'Run in App', icon: 'rocket', hint: 'Run in App writes dev.json so the installed Form app loads this extension from its folder.' },
  { id: 'package', label: 'Package', icon: 'package', hint: 'Package builds the .formpkg after Check, the same bytes every time.' },
];
const BOTTOM = [
  { id: 'problems', label: 'Problems', count: true, hidden: false },
  { id: 'calls', label: 'Host calls', count: true, hidden: false },
  { id: 'output', label: 'Output', count: false, hidden: false },
  { id: 'events', label: 'Events', count: false, hidden: true },
  { id: 'document', label: 'Document', count: false, hidden: true },
];

function enc(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="st-pane edit-pane">
      <div class="st-tools">
        <button class="st-proj" type="button" title="Open a project">${icon('puzzle', 16)}<b class="st-proj-name ellipsis">No project open</b><span class="st-pf hidden"></span>${icon('chevron-down', 14)}</button>
        <span class="st-vsep"></span>
        ${TOOLS.map((t) => `<button class="st-tbtn" type="button" data-tool="${t.id}" aria-pressed="false">${icon(t.icon, 16)}<span>${t.label}</span></button>`).join('')}
        <span class="st-hint ellipsis">&nbsp;</span>
        <button class="btn primary st-publish" type="button">${icon('upload', 16)}<span>Publish</span></button>
      </div>
      <div class="st-stage">
        <div class="st-top">
          <section class="st-panel st-left" aria-label="Project">
            <div class="st-ph"><div class="st-ptabs" role="tablist">
              <button type="button" role="tab" data-ltab="files" aria-selected="true">Files</button>
              <button type="button" role="tab" data-ltab="library" aria-selected="false">Library<em class="st-lib-count">0</em></button>
            </div></div>
            <div class="st-lbody" data-lbody="files">
              <div class="st-projcard"><span class="st-projicon"></span><div><b class="st-projcard-name ellipsis">&nbsp;</b><small class="st-projcard-a ellipsis">&nbsp;</small><small class="st-projcard-b ellipsis">&nbsp;</small></div></div>
              <label class="st-search">${icon('search', 14)}<input type="search" placeholder="Search files" aria-label="Search files" autocomplete="off" spellcheck="false" /></label>
              <div class="st-colh"><span>Name</span><span>Type</span></div>
              <div class="edit-side"></div>
              <div class="st-pfoot"><span class="st-fa"><button type="button" data-fa="new" title="New File" aria-label="New File">${icon('new', 14)}</button><button type="button" data-fa="import" title="Import .formpkg" aria-label="Import .formpkg">${icon('download', 14)}</button><button type="button" data-fa="refresh" title="Refresh" aria-label="Refresh">${icon('refresh', 14)}</button><button type="button" data-fa="delete" title="Delete the open file" aria-label="Delete the open file">${icon('trash', 14)}</button></span><span class="st-count">0 items</span></div>
            </div>
            <div class="st-lbody hidden" data-lbody="library"></div>
          </section>
          <div class="st-ctr">
            <section class="st-panel st-code edit-main" aria-label="Editor">
              <div class="st-tabs-ed"><div class="edit-tabs" role="tablist" aria-label="Open files"></div><span class="st-te-r"><button class="st-tg" type="button" data-tool="split" aria-pressed="false">${icon('split', 12)}<span>Split</span></button></span></div>
              <div class="notice warning edit-conflict hidden" role="alert">${icon('warning')}<span class="edit-conflict-text">&nbsp;</span><span class="edit-conflict-acts"><button class="btn sm edit-conflict-load" type="button">Load Disk Version</button><button class="btn ghost sm edit-conflict-keep" type="button">Keep Mine</button></span></div>
              <div class="edit-stage">
                <div class="edit-host"></div>
                <div class="edit-binary hidden"><div class="edit-binary-view"></div><p class="edit-binary-text">&nbsp;</p></div>
                <div class="empty edit-none hidden">${icon('folder')}<h3>No project open</h3><p>Open a project to edit its files and its manifest.</p><div class="btn-group"><button class="btn edit-open" type="button">${icon('folder-open')}<span>Open Project</span></button><button class="btn ghost edit-new" type="button">${icon('new')}<span>New Extension</span></button></div></div>
                <div class="empty edit-nofile hidden">${icon('file')}<h3>No file open</h3><p>Choose a file in the tree, or edit the manifest in the inspector.</p></div>
              </div>
            </section>
            <section class="st-panel st-prev" aria-label="Preview" hidden>
              <div class="st-ph"><div class="st-ptabs"><button type="button" aria-selected="true">Preview</button></div><span class="st-prev-as"></span></div>
              <div class="st-prev-body"></div>
              <div class="st-prev-bar"></div>
            </section>
          </div>
          <section class="st-panel st-right" aria-label="Inspector">
            <div class="st-ph"><div class="st-ptabs" role="tablist">
              <button type="button" role="tab" data-rtab="manifest" aria-selected="true">Manifest</button>
              <button type="button" role="tab" data-rtab="permissions" aria-selected="false">Permissions<em class="st-perm-count"></em></button>
              <button type="button" role="tab" data-rtab="check" aria-selected="false">Check<em class="st-check-count"></em></button>
            </div></div>
            <div class="st-rbody" data-rbody="manifest"></div>
            <div class="st-rbody hidden" data-rbody="permissions"></div>
            <div class="st-rbody hidden" data-rbody="check"></div>
          </section>
        </div>
        <section class="st-panel st-bottom" aria-label="Problems, host calls and output">
          <div class="st-ph"><div class="st-ptabs" role="tablist">
            ${BOTTOM.map((t, i) => `<button type="button" role="tab" data-btab="${t.id}" aria-selected="${i === 0}" ${t.hidden ? 'hidden' : ''}>${t.label}${t.count ? '<em>0</em>' : ''}</button>`).join('')}
          </div><button class="st-fold" type="button" aria-label="Show or hide the panel" aria-expanded="false">${icon('chevron-down', 14)}</button></div>
          ${BOTTOM.map((t, i) => `<div class="st-bbody${i === 0 ? '' : ' hidden'}" data-bbody="${t.id}"></div>`).join('')}
        </section>
      </div>
    </div>`;

  const q = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const pane = q('.edit-pane');
  const tabsEl = q('.edit-tabs');
  const conflictEl = q('.edit-conflict');
  const conflictText = q('.edit-conflict-text');
  const host = q('.edit-host');
  const binaryEl = q('.edit-binary');
  const binaryView = q('.edit-binary-view');
  const binaryText = q('.edit-binary-text');
  const noneEl = q('.edit-none');
  const noFileEl = q('.edit-nofile');
  const sv = (key: string) => document.querySelector<HTMLElement>(`[data-status="${key}"]`)!;
  const stPath = sv('path');
  const stLang = sv('lang');
  const stPos = sv('pos');
  const stState = sv('state');

  const view = createView(host);
  const sessions = new Map<string, Session>();
  const tabEls = new Map<string, HTMLElement>();
  let s: Session | null = null;
  let shownPath = '';
  let formTimer = 0;
  let changeTimer = 0;
  const changed = new Set<string>();
  let loadSeq = 0;
  let ready: Promise<void> = Promise.resolve();
  let restoring = !ctx.project.current() && !!storage.get('formext.project');
  const restoreTimer = restoring ? window.setTimeout(() => { restoring = false; if (!s) renderHead(null); renderStage(); }, 4000) : 0;

  const tree = new FileTree({
    open: (p) => void show(p),
    newFile: (dir) => void newFile(dir),
    rename: (p) => void rename(p),
    remove: (p, folder) => void remove(p, folder),
    refresh: () => void refreshFiles(),
  });
  q('.edit-side').append(tree.el);

  const form = new ManifestForm({
    change: (fn) => mutateManifest(fn),
    openJson: () => void show(manifestPath()),
    entryFiles: () => (s ? s.files.filter((f) => f.package && /\.html?$/i.test(f.path)).map((f) => pkgRel(f.path)) : []),
    manifestPath: () => manifestPath(),
  });
  q('[data-rbody="manifest"]').append(form.el);
  const zones = mountZones(el, ctx);

  function setPanel(on: boolean): void {
    if (on) zones.setRight('manifest');
  }

  q<HTMLInputElement>('.st-search input').addEventListener('input', (ev) => tree.setFilter((ev.target as HTMLInputElement).value));
  q('.st-fa').addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-fa]')?.dataset.fa;
    if (act === 'new') void newFile(s?.prefix ?? '');
    else if (act === 'import') ctx.openPane('library', { action: 'import', from: 'studio' });
    else if (act === 'refresh') void refreshFiles();
    else if (act === 'delete' && shownPath) void remove(shownPath, false);
  });

  function manifestPath(): string {
    if (!s) return 'package/manifest.json';
    return s.prefix ? `${s.prefix}/manifest.json` : 'manifest.json';
  }

  function pkgRel(path: string): string {
    if (!s || !s.prefix) return path;
    return path.startsWith(`${s.prefix}/`) ? path.slice(s.prefix.length + 1) : path;
  }

  function stateOf(b: Buffer): EditorState | null {
    if (s && b.path === shownPath && b.state && s.buffers.get(shownPath) === b) return view.state;
    return b.state;
  }

  function isDirty(b: Buffer): boolean {
    const st = stateOf(b);
    if (b.conflict?.kind === 'deleted') return true;
    return !!st && !st.doc.eq(b.base);
  }

  function dirtyIn(sess: Session): Buffer[] {
    return [...sess.buffers.values()].filter((b) => (sess === s ? isDirty(b) : !!b.state && (b.conflict?.kind === 'deleted' || !b.state.doc.eq(b.base))));
  }

  function allDirty(): number {
    let n = 0;
    for (const sess of sessions.values()) n += dirtyIn(sess).length;
    return n;
  }

  function hooks(path: string) {
    return {
      onSave: () => void save(path),
      onUpdate: (u: import('@codemirror/view').ViewUpdate) => {
        if (u.docChanged) afterChange(path, u.transactions.some((t) => t.isUserEvent('input.form')));
        renderStatus();
      },
    };
  }

  function afterChange(path: string, fromForm: boolean): void {
    if (!s) return;
    if (path === manifestPath()) {
      clearTimeout(formTimer);
      if (fromForm) syncForm();
      else formTimer = window.setTimeout(syncForm, 150);
    }
    renderDirty();
  }

  function syncForm(): void {
    if (!s) return;
    const b = s.buffers.get(manifestPath());
    const st = b ? stateOf(b) : null;
    if (!b || !st) return;
    form.setText(st.doc.toString());
  }

  function renderDirty(): void {
    if (s) {
      const dirty = new Set(dirtyIn(s).map((b) => b.path));
      tree.setDirty(dirty);
      for (const [p, t] of tabEls) t.classList.toggle('dirty', dirty.has(p));
    }
    document.querySelector('.fx-tb-doc .dotf')?.classList.toggle('dirty', allDirty() > 0);
    renderStatus();
  }

  function renderStatus(): void {
    const b = s?.buffers.get(shownPath);
    if (!s || !b) {
      setText(stPath, s ? (s.files.length ? `${plural(s.files.length, 'file')} in ${s.pid}` : s.pid) : ' ');
      setText(stLang, ' ');
      setText(stPos, ' ');
      setText(stState, ' ');
      return;
    }
    setText(stPath, b.path);
    if (b.binary) {
      setText(stLang, 'Binary');
      setText(stPos, sizeText(b.size));
      setText(stState, 'Read only');
      return;
    }
    const st = view.state;
    const head = st.selection.main.head;
    const line = st.doc.lineAt(head);
    const sel = st.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0);
    setText(stLang, languageName(b.path));
    setText(stPos, `Ln ${line.number}, Col ${head - line.from + 1}${sel ? ` (${sel} selected)` : ''}`);
    setText(stState, b.conflict ? (b.conflict.kind === 'deleted' ? 'Deleted on disk' : 'Changed on disk') : isDirty(b) ? 'Unsaved' : 'Saved');
  }

  function renderConflict(): void {
    const b = s?.buffers.get(shownPath);
    const c = b?.conflict;
    conflictEl.classList.toggle('hidden', !c);
    if (!b || !c) return;
    setText(conflictText, c.kind === 'deleted' ? `${baseName(b.path)} was deleted outside the editor. Save to write it again, or close it.` : `${baseName(b.path)} changed outside the editor while you had changes here.`);
    q('.edit-conflict-load').classList.toggle('hidden', c.kind === 'deleted');
    setText(q('.edit-conflict-keep'), c.kind === 'deleted' ? 'Close File' : 'Keep Mine');
  }

  function renderTabs(): void {
    const want = s ? s.tabs : [];
    for (const [p, t] of tabEls) {
      if (!want.includes(p)) {
        t.remove();
        tabEls.delete(p);
      }
    }
    let prev: Element | null = null;
    for (const p of want) {
      let t = tabEls.get(p);
      if (!t) {
        t = document.createElement('div');
        t.className = 'edit-tab';
        t.setAttribute('role', 'tab');
        t.title = p;
        t.innerHTML = `<span class="edit-tab-name">${esc(baseName(p))}</span><span class="edit-tab-dot" aria-hidden="true"></span><button class="edit-tab-close" type="button" title="Close" aria-label="Close ${esc(baseName(p))}">${icon('close', 12)}</button>`;
        t.addEventListener('mousedown', (ev) => {
          if (ev.button === 1) {
            ev.preventDefault();
            void closeTab(p);
          }
        });
        t.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).closest('.edit-tab-close')) void closeTab(p);
          else void show(p);
        });
        tabEls.set(p, t);
      }
      t.setAttribute('aria-selected', String(p === shownPath));
      const at: Element | null = prev ? prev.nextElementSibling : tabsEl.firstElementChild;
      if (at !== t) tabsEl.insertBefore(t, at);
      prev = t;
    }
    tabEls.get(shownPath)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function renderStage(): void {
    const b = s?.buffers.get(shownPath);
    noneEl.classList.toggle('hidden', !!s || restoring);
    noFileEl.classList.toggle('hidden', !s || !!b);
    host.classList.toggle('hidden', !b || b.binary);
    binaryEl.classList.toggle('hidden', !b || !b.binary);
    if (b?.binary && s) {
      const url = `${apiUrl(`/api/projects/${encodeURIComponent(s.pid)}/files/${enc(b.path)}`)}?raw=1&v=${b.savedAt}`;
      const html = IMAGE.test(b.path) ? `<img alt="${esc(baseName(b.path))}" src="${esc(url)}" />` : icon('file', 40);
      if (binaryView.dataset.src !== url) {
        binaryView.innerHTML = html;
        binaryView.dataset.src = url;
      }
      setText(binaryText, `${baseName(b.path)}, ${sizeText(b.size)}. Binary files are packed as they are.`);
    }
  }

  function persistTabs(): void {
    if (!s) return;
    storage.set(`formext.edit.tabs.${s.pid}`, JSON.stringify({ tabs: s.tabs, active: s.active }));
  }

  function renderAll(): void {
    renderTabs();
    renderStage();
    renderConflict();
    renderDirty();
  }

  function park(): void {
    if (!s) return;
    const b = s.buffers.get(shownPath);
    if (b && b.state) {
      b.state = view.state;
      b.scroll = view.scrollDOM.scrollTop;
    }
  }

  async function fetchFile(sess: Session, path: string): Promise<FileAnswer | null> {
    try {
      return await ctx.api.get<FileAnswer>(`/api/projects/${encodeURIComponent(sess.pid)}/files/${enc(path)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  function ensure(sess: Session, path: string): Promise<Buffer | null> {
    const have = sess.buffers.get(path);
    if (have) return Promise.resolve(have);
    const pending = sess.loading.get(path);
    if (pending) return pending;
    const job = (async () => {
      const f = await fetchFile(sess, path);
      if (!f) return null;
      const b: Buffer = { path, state: null, base: Text.empty, size: f.size, binary: f.encoding !== 'utf-8', conflict: null, scroll: 0, savedAt: Date.now() };
      if (!b.binary) {
        b.state = makeState(path, f.text ?? '', hooks(path));
        b.base = b.state.doc;
      }
      sess.buffers.set(path, b);
      return b;
    })().finally(() => sess.loading.delete(path));
    sess.loading.set(path, job);
    return job;
  }

  function resolvePath(path: string): string {
    if (!s) return path;
    const clean = path.replace(/^\.?\//, '');
    if (s.files.some((f) => f.path === clean)) return clean;
    const withPrefix = s.prefix ? `${s.prefix}/${clean}` : clean;
    if (s.files.some((f) => f.path === withPrefix)) return withPrefix;
    return clean;
  }

  async function show(path: string, at?: { line: number; column: number }): Promise<void> {
    if (!s) return;
    const sess = s;
    const target = resolvePath(path);
    let b: Buffer | null;
    try {
      b = await ensure(sess, target);
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
      return;
    }
    if (s !== sess) return;
    if (!b) {
      ctx.notify(`There is no ${target} in this project.`, 'warning');
      return;
    }
    if (!sess.tabs.includes(target)) {
      const i = sess.tabs.indexOf(shownPath);
      sess.tabs.splice(i < 0 ? sess.tabs.length : i + 1, 0, target);
    }
    if (shownPath !== target) {
      park();
      shownPath = target;
      sess.active = target;
      if (b.state) {
        view.setState(b.state);
        view.scrollDOM.scrollTop = b.scroll;
      }
    }
    tree.setActive(target);
    persistTabs();
    renderAll();
    if (b.state) {
      if (at) goTo(view, at.line, at.column);
      else if (activePane() === 'studio') view.focus();
    }
  }

  async function closeTab(path: string, force = false): Promise<void> {
    if (!s) return;
    const sess = s;
    const b = sess.buffers.get(path);
    if (b && !force && isDirty(b)) {
      const data = await ctx.dialog.form(`Close ${baseName(path)}?`, `<p class="edit-dialog-text">${esc(path)} has changes that are not saved.</p><div class="edit-dialog-choices"><label class="check"><input type="radio" name="choice" value="save" checked /><span>Save the changes, then close</span></label><label class="check"><input type="radio" name="choice" value="discard" /><span>Discard the changes</span></label></div><span data-ok="Close File" hidden></span>`);
      if (!data || s !== sess) return;
      if (data.get('choice') === 'save') {
        const ok = await save(path);
        if (!ok) return;
      }
    }
    const i = sess.tabs.indexOf(path);
    if (i < 0) return;
    sess.tabs.splice(i, 1);
    if (path === manifestPath()) {
      if (b && b.state) {
        if (path === shownPath) park();
        b.state = makeState(path, b.base.toString(), hooks(path));
        b.conflict = null;
        syncForm();
      }
    } else sess.buffers.delete(path);
    if (path === shownPath) {
      const next = sess.tabs[Math.min(i, sess.tabs.length - 1)];
      shownPath = '';
      sess.active = '';
      if (next) {
        await show(next);
        return;
      }
      tree.setActive('');
    }
    persistTabs();
    renderAll();
  }

  async function save(path: string): Promise<boolean> {
    if (!s) return false;
    const sess = s;
    const b = sess.buffers.get(path);
    if (!b || b.binary) return false;
    const st = stateOf(b);
    if (!st) return false;
    const doc = st.doc;
    try {
      b.savedAt = Date.now();
      await ctx.api.put(`/api/projects/${encodeURIComponent(sess.pid)}/files/${enc(path)}`, { text: doc.toString() });
      b.base = doc;
      b.conflict = null;
      b.size = doc.length;
      b.savedAt = Date.now();
    } catch (err) {
      ctx.notify(`${baseName(path)} was not saved: ${errorMessage(err)}`, 'error');
      return false;
    }
    if (s === sess) {
      renderConflict();
      renderDirty();
    }
    return true;
  }

  async function saveAll(): Promise<void> {
    if (!s) return;
    const list = dirtyIn(s);
    let ok = 0;
    for (const b of list) if (await save(b.path)) ok++;
    if (list.length > 1) ctx.notify(`Saved ${plural(ok, 'file')}.`, ok === list.length ? 'success' : 'warning');
  }

  function mutateManifest(fn: (m: Manifest) => Manifest): void {
    if (!s) return;
    const b = s.buffers.get(manifestPath());
    const st = b ? stateOf(b) : null;
    if (!b || !st) return;
    const text = st.doc.toString();
    let m: Manifest;
    try {
      m = JSON.parse(text) as Manifest;
    } catch {
      return;
    }
    const indentMatch = /^([ \t]+)"/m.exec(text);
    const indent = indentMatch ? indentMatch[1] : '  ';
    const next = fn(m);
    const out = formatManifest(next, indent) + (text.endsWith('\n') || !text ? '\n' : '');
    const change = minimalChange(st.doc, out);
    if (!change) return;
    if (b.path === shownPath) {
      view.dispatch({ changes: change, userEvent: 'input.form', scrollIntoView: false });
    } else {
      b.state = st.update({ changes: change, userEvent: 'input.form' }).state;
      afterChange(b.path, true);
    }
  }

  function replaceFromDisk(b: Buffer, text: string): void {
    const st = stateOf(b);
    if (!st) return;
    const change = minimalChange(st.doc, text);
    if (change) {
      if (b.path === shownPath) view.dispatch({ changes: change, annotations: Transaction.addToHistory.of(false) });
      else b.state = st.update({ changes: change, annotations: Transaction.addToHistory.of(false) }).state;
    }
    b.base = (stateOf(b) ?? st).doc;
    b.conflict = null;
    if (b.path === manifestPath()) syncForm();
  }

  async function refreshFiles(): Promise<void> {
    if (!s) return;
    const sess = s;
    try {
      const r = await ctx.api.get<{ files: FileInfo[]; package_prefix: string }>(`/api/projects/${encodeURIComponent(sess.pid)}/files`);
      if (s !== sess) return;
      sess.files = r.files;
      sess.prefix = r.package_prefix ?? 'package';
      tree.setFiles(sess.files, sess.prefix);
      tree.setActive(shownPath);
      setText(q('.st-count'), plural(tree.count(), 'item'));
      renderDirty();
      syncForm();
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    }
  }

  async function reconcile(paths: string[]): Promise<void> {
    if (!s) return;
    const sess = s;
    await refreshFiles();
    for (const p of paths) {
      const b = sess.buffers.get(p);
      if (!b) continue;
      if (b.binary) {
        b.savedAt = Date.now();
        continue;
      }
      let f: FileAnswer | null;
      try {
        f = await fetchFile(sess, p);
      } catch {
        continue;
      }
      if (s !== sess) return;
      const st = stateOf(b);
      if (!st) continue;
      if (!f) {
        if (!isDirty(b) && p !== manifestPath()) {
          const i = sess.tabs.indexOf(p);
          if (i >= 0) sess.tabs.splice(i, 1);
          sess.buffers.delete(p);
          if (p === shownPath) {
            shownPath = '';
            sess.active = '';
            const next = sess.tabs[Math.min(i, sess.tabs.length - 1)];
            if (next) await show(next);
          }
        } else b.conflict = { kind: 'deleted' };
        continue;
      }
      const text = f.text ?? '';
      if (text === st.doc.toString()) {
        b.base = st.doc;
        b.conflict = null;
      } else if (text === b.base.toString()) {
        continue;
      } else if (!isDirty(b)) {
        replaceFromDisk(b, text);
      } else {
        b.conflict = { kind: 'changed', text };
      }
    }
    if (s === sess) {
      persistTabs();
      renderAll();
    }
  }

  async function newFile(dir: string): Promise<void> {
    if (!s) return;
    const sess = s;
    const start = dir ? `${dir.replace(/\/$/, '')}/` : '';
    const data = await ctx.dialog.form('New File', `<div class="field"><label for="edit-new-path">Path in the project</label><input class="input code" id="edit-new-path" name="path" required autocomplete="off" spellcheck="false" value="${esc(start)}" pattern="[A-Za-z0-9._\\/\\-]+" /><span class="hint">Files inside ${esc(sess.prefix || 'the project folder')} are packed; folders are made as needed.</span></div><span data-ok="Create" hidden></span>`);
    if (!data || s !== sess) return;
    const path = String(data.get('path') ?? '').trim().replace(/^\/+/, '');
    if (!path || path.endsWith('/')) return;
    if (sess.files.some((f) => f.path === path)) {
      await show(path);
      return;
    }
    try {
      await ctx.api.put(`/api/projects/${encodeURIComponent(sess.pid)}/files/${enc(path)}`, { text: '' });
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
      return;
    }
    await refreshFiles();
    await show(path);
  }

  async function rename(path: string): Promise<void> {
    if (!s) return;
    const sess = s;
    if (path === manifestPath()) {
      ctx.notify('manifest.json keeps its name: hosts read it at the package root.', 'info');
      return;
    }
    const data = await ctx.dialog.form(`Rename ${baseName(path)}`, `<div class="field"><label for="edit-rename-path">New path</label><input class="input code" id="edit-rename-path" name="path" required autocomplete="off" spellcheck="false" value="${esc(path)}" pattern="[A-Za-z0-9._\\/\\-]+" /></div><span data-ok="Rename" hidden></span>`);
    if (!data || s !== sess) return;
    const to = String(data.get('path') ?? '').trim().replace(/^\/+/, '');
    if (!to || to === path) return;
    try {
      await ctx.api.post(`/api/projects/${encodeURIComponent(sess.pid)}/move`, { from: path, to });
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
      return;
    }
    const b = sess.buffers.get(path);
    if (b) {
      if (path === shownPath) park();
      sess.buffers.delete(path);
      b.path = to;
      if (b.state) {
        const keepDirty = !b.state.doc.eq(b.base);
        const text = b.state.doc.toString();
        b.state = makeState(to, text, hooks(to));
        if (!keepDirty) b.base = b.state.doc;
      }
      sess.buffers.set(to, b);
    }
    const ti = sess.tabs.indexOf(path);
    if (ti >= 0) sess.tabs[ti] = to;
    tabEls.get(path)?.remove();
    tabEls.delete(path);
    if (shownPath === path) {
      shownPath = '';
      await refreshFiles();
      await show(to);
    } else {
      await refreshFiles();
      persistTabs();
      renderAll();
    }
  }

  async function remove(path: string, folder: boolean): Promise<void> {
    if (!s) return;
    const sess = s;
    if (path === manifestPath() || (folder && path === sess.prefix)) {
      ctx.notify(folder ? 'The package folder holds the manifest and cannot be deleted here.' : 'Every package needs its manifest.json.', 'warning');
      return;
    }
    const ok = await ctx.dialog.confirm(`Delete ${baseName(path)}?`, folder ? `The folder ${path} and every file in it are deleted from the project.` : `${path} is deleted from the project.`, 'Delete');
    if (!ok || s !== sess) return;
    try {
      await ctx.api.del(`/api/projects/${encodeURIComponent(sess.pid)}/files/${enc(path)}`);
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
      return;
    }
    const gone = (p: string) => p === path || (folder && p.startsWith(`${path}/`));
    for (const p of [...sess.buffers.keys()]) if (gone(p)) sess.buffers.delete(p);
    const wasShown = gone(shownPath);
    sess.tabs = sess.tabs.filter((p) => !gone(p));
    if (wasShown) {
      shownPath = '';
      sess.active = '';
    }
    await refreshFiles();
    if (wasShown && sess.tabs.length) await show(sess.tabs[sess.tabs.length - 1]);
    else {
      persistTabs();
      renderAll();
    }
  }

  function projectBar(p: ProjectRef | null): void {
    const app = p ? productName(p.product) || 'no app chosen' : '';
    const chip = q('.st-pf');
    chip.classList.toggle('hidden', !p || !p.product);
    chip.dataset.product = p?.product ?? '';
    setText(chip, app);
    const mf = (p?.manifest ?? {}) as { version?: unknown; kind?: unknown; permissions?: unknown };
    const perms = Array.isArray(mf.permissions) ? mf.permissions.length : 0;
    setText(q('.st-projcard-name'), p ? p.name : ' ');
    setText(q('.st-projcard-a'), p ? `${app} · ${p.id}${mf.version ? ` · ${String(mf.version)}` : ''}` : ' ');
    setText(q('.st-projcard-b'), p ? `${mf.kind ? `${String(mf.kind)} · ` : ''}${plural(perms, 'permission')}` : ' ');
    setText(q('.st-perm-count'), perms ? String(perms) : '');
    const mark = q('.st-projicon');
    const html = p ? appIcon(p.product) : '';
    if (mark.innerHTML !== html) mark.innerHTML = html;
    setText(sv('project'), p ? p.name : 'No project');
    q<HTMLButtonElement>('.st-publish').disabled = !p;
    for (const b of el.querySelectorAll<HTMLButtonElement>('.st-tbtn')) b.disabled = !p;
  }

  function renderHead(p: ProjectRef | null): void {
    projectBar(p);
    setText(q('.st-proj-name'), p ? p.name : restoring ? ' ' : 'No project open');
    pane.classList.toggle('no-project', !p);
  }

  async function load(p: ProjectRef | null): Promise<void> {
    const seq = ++loadSeq;
    park();
    const leaving = s;
    if (leaving && (!p || p.id !== leaving.pid)) {
      const n = dirtyIn(leaving).length;
      if (n) ctx.notify(`${plural(n, 'unsaved file')} in ${leaving.pid} stay here until you save them; open that project again to save.`, 'warning');
    }
    renderHead(p);
    if (!p) {
      s = null;
      shownPath = '';
      tree.setProject(null);
      form.setState('none');
      renderAll();
      return;
    }
    if (s && s.pid === p.id) return;
    let sess = sessions.get(p.id);
    if (!sess) {
      const saved = storage.json<{ tabs?: string[]; active?: string }>(`formext.edit.tabs.${p.id}`, {});
      sess = { pid: p.id, buffers: new Map(), loading: new Map(), tabs: Array.isArray(saved.tabs) ? saved.tabs.filter((x) => typeof x === 'string') : [], active: typeof saved.active === 'string' ? saved.active : '', files: [], prefix: 'package' };
      sessions.set(p.id, sess);
    }
    s = sess;
    shownPath = '';
    tree.setProject(p.id);
    form.setState('loading');
    renderAll();
    await refreshFiles();
    if (seq !== loadSeq || s !== sess) return;
    const known = new Set(sess.files.map((f) => f.path));
    sess.tabs = sess.tabs.filter((t) => known.has(t) || sess!.buffers.has(t));
    const mb = await ensure(sess, manifestPath()).catch(() => null);
    if (seq !== loadSeq || s !== sess) return;
    if (mb && mb.state) syncForm();
    else form.setState('missing');
    const first = sess.tabs.includes(sess.active) ? sess.active : sess.tabs[0] ?? (mb ? manifestPath() : '');
    if (first) await show(first);
    else renderAll();
  }

  function guard(ev: BeforeUnloadEvent): void {
    if (allDirty() === 0) return;
    ev.preventDefault();
    ev.returnValue = '';
  }
  window.addEventListener('beforeunload', guard);

  q('.edit-open').addEventListener('click', () => void chooseProject());
  q('.edit-new').addEventListener('click', () => ctx.openPane('new'));
  q('.edit-conflict-load').addEventListener('click', () => {
    const b = s?.buffers.get(shownPath);
    if (b?.conflict?.kind === 'changed') replaceFromDisk(b, b.conflict.text);
    renderAll();
  });
  q('.edit-conflict-keep').addEventListener('click', () => {
    const b = s?.buffers.get(shownPath);
    if (!b?.conflict) return;
    if (b.conflict.kind === 'deleted') {
      void closeTab(b.path, true);
      return;
    }
    b.base = Text.of(b.conflict.text.split('\n'));
    b.conflict = null;
    renderAll();
  });

  ctx.commands.register({ id: 'edit.save', title: 'Save File', keys: SAVE_KEYS, run: () => { if (activePane() === 'studio' && shownPath) return save(shownPath); } });
  ctx.commands.register({ id: 'edit.save-all', title: 'Save All Files', keys: SAVE_ALL_KEYS, run: () => saveAll() });
  ctx.commands.register({ id: 'edit.manifest', title: 'Edit Manifest', run: () => { ctx.openPane('studio'); setPanel(true); } });
  ctx.commands.register({ id: 'edit.new-file', title: 'New File in Project', run: () => { ctx.openPane('studio'); return newFile(s?.prefix ?? ''); } });
  ctx.commands.register({ id: 'edit.close-file', title: 'Close File', run: () => (shownPath ? closeTab(shownPath) : undefined) });

  const offs = [
    ctx.project.onChange((p) => {
      restoring = false;
      clearTimeout(restoreTimer);
      ready = load(p);
    }),
    ctx.events.on('settings.changed', (d: { editor?: { tab_size?: number; wrap?: boolean } }) => {
      editorPrefs.tab = Number(d?.editor?.tab_size) || 2;
      editorPrefs.wrap = !!d?.editor?.wrap;
    }),
    ctx.events.on('pane.open', (d: { id: string; args?: OpenArgs }) => {
      if (d?.id !== 'studio') return;
      view.requestMeasure();
      const a = d.args;
      if (!a || typeof a.path !== 'string' || !a.path) return;
      void ready.then(() => show(a.path!, a.line ? { line: Number(a.line) || 1, column: Number(a.column) || 1 } : undefined));
    }),
    ctx.events.on('project.changed', (d: { id?: string; paths?: string[] }) => {
      if (!s || d?.id !== s.pid) return;
      for (const p of d.paths ?? []) changed.add(p);
      clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => {
        const list = [...changed];
        changed.clear();
        void reconcile(list);
      }, 150);
    }),
    ctx.events.on('project.deleted', (d: { id?: string }) => {
      if (d?.id) sessions.delete(d.id);
    }),
  ];

  ready = load(ctx.project.current());

  return () => {
    for (const off of offs) off();
    zones.dispose();
    window.removeEventListener('beforeunload', guard);
    clearTimeout(formTimer);
    clearTimeout(changeTimer);
    view.destroy();
  };
}

export const pane: PaneDef = {
  id: 'studio',
  title: 'Studio',
  icon: 'edit',
  order: 20,
  group: 'make',
  view: 'studio',
  mount,
};
