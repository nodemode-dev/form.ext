import { icon, esc, setText, storage } from '../../shell';

export interface FileInfo {
  path: string;
  size: number;
  modified: number;
  package: boolean;
}

export interface TreeOptions {
  open: (path: string) => void;
  newFile: (dir: string) => void;
  rename: (path: string) => void;
  remove: (path: string, folder: boolean) => void;
  refresh: () => void;
}

interface Node {
  key: string;
  path: string;
  name: string;
  depth: number;
  folder: boolean;
  info?: FileInfo;
}

const PACKED = new Set(['html', 'js', 'mjs', 'css', 'json', 'svg', 'png', 'webp', 'jpg', 'jpeg', 'gif', 'wasm', 'txt', 'md', 'wav', 'ogg', 'mp3', 'webm', 'mp4', 'cube', 'woff2']);

function fileIcon(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (['png', 'webp', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'image';
  if (['wav', 'ogg', 'mp3'].includes(ext)) return 'wave';
  if (['webm', 'mp4'].includes(ext)) return 'film';
  if (ext === 'md') return 'markdown';
  if (['js', 'mjs', 'ts', 'css', 'html', 'json'].includes(ext)) return 'code';
  return 'file';
}

const TYPES: Record<string, string> = { js: 'JavaScript', mjs: 'JavaScript', ts: 'TypeScript', css: 'CSS', html: 'HTML', htm: 'HTML', json: 'JSON', md: 'Markdown', svg: 'SVG', png: 'PNG', webp: 'WebP', jpg: 'JPEG', jpeg: 'JPEG', gif: 'GIF', txt: 'Text', wav: 'WAV', ogg: 'Ogg', mp3: 'MP3', webm: 'WebM', mp4: 'MP4', wasm: 'WASM', woff2: 'Font' };

function typeName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return TYPES[ext] ?? (name.includes('.') ? ext.toUpperCase() : '');
}

export function packable(path: string): boolean {
  return PACKED.has(path.toLowerCase().split('.').pop() ?? '');
}

export class FileTree {
  readonly el: HTMLElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private opts: TreeOptions;
  private rows = new Map<string, HTMLElement>();
  private nodes: Node[] = [];
  private files: FileInfo[] = [];
  private prefix = 'package';
  private collapsed = new Set<string>();
  private collapseKey = '';
  private active = '';
  private dirty = new Set<string>();
  private focusKey = '';
  private filter = '';

  constructor(opts: TreeOptions) {
    this.opts = opts;
    const el = document.createElement('nav');
    el.className = 'edit-tree';
    el.setAttribute('aria-label', 'Files');
    el.innerHTML = `
      <div class="edit-tree-head">
        <span class="section-title">Files</span>
        <span class="edit-tree-actions">
          <button class="btn ghost icon sm" type="button" data-act="new" title="New File" aria-label="New File">${icon('plus', 14)}</button>
          <button class="btn ghost icon sm" type="button" data-act="refresh" title="Refresh" aria-label="Refresh">${icon('refresh', 14)}</button>
        </span>
      </div>
      <div class="edit-tree-list" role="tree" tabindex="0"></div>
      <div class="edit-tree-empty hidden">No files.</div>`;
    this.el = el;
    this.list = el.querySelector('.edit-tree-list')!;
    this.empty = el.querySelector('.edit-tree-empty')!;
    el.querySelector('[data-act="new"]')!.addEventListener('click', () => opts.newFile(this.folderOf(this.active) || this.prefix));
    el.querySelector('[data-act="refresh"]')!.addEventListener('click', () => opts.refresh());
    this.list.addEventListener('keydown', (ev) => this.key(ev));
  }

  private folderOf(path: string): string {
    const node = this.nodes.find((n) => n.path === path);
    if (node?.folder) return path;
    const i = path.lastIndexOf('/');
    return i > 0 ? path.slice(0, i) : '';
  }

  setProject(id: string | null): void {
    this.collapseKey = id ? `formext.edit.collapsed.${id}` : '';
    this.collapsed = new Set(id ? storage.json<string[]>(this.collapseKey, []) : []);
    this.files = [];
    this.active = '';
    this.dirty.clear();
    this.render();
  }

  setFiles(files: FileInfo[], prefix: string): void {
    this.files = files;
    this.prefix = prefix;
    this.render();
  }

  setActive(path: string): void {
    if (this.active === path) return;
    const was = this.rows.get(`f:${this.active}`);
    was?.setAttribute('aria-selected', 'false');
    this.active = path;
    if (path) this.reveal(path);
    const now = this.rows.get(`f:${path}`);
    now?.setAttribute('aria-selected', 'true');
    now?.scrollIntoView({ block: 'nearest' });
  }

  setDirty(paths: Set<string>): void {
    const all = new Set([...this.dirty, ...paths]);
    this.dirty = new Set(paths);
    for (const p of all) this.rows.get(`f:${p}`)?.classList.toggle('dirty', this.dirty.has(p));
  }

  private reveal(path: string): void {
    const parts = path.split('/');
    let changed = false;
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (this.collapsed.delete(dir)) changed = true;
    }
    if (changed) {
      this.saveCollapsed();
      this.render();
    }
  }

  private saveCollapsed(): void {
    if (this.collapseKey) storage.set(this.collapseKey, JSON.stringify([...this.collapsed]));
  }

  private build(): Node[] {
    const folders = new Set<string>();
    for (const f of this.files) {
      const parts = f.path.split('/');
      for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join('/'));
    }
    const children = new Map<string, Node[]>();
    const push = (parent: string, n: Node) => {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(n);
    };
    for (const d of folders) {
      const i = d.lastIndexOf('/');
      push(i < 0 ? '' : d.slice(0, i), { key: `d:${d}`, path: d, name: d.slice(i + 1), depth: 0, folder: true });
    }
    for (const f of this.files) {
      const i = f.path.lastIndexOf('/');
      push(i < 0 ? '' : f.path.slice(0, i), { key: `f:${f.path}`, path: f.path, name: f.path.slice(i + 1), depth: 0, folder: false, info: f });
    }
    const out: Node[] = [];
    const walk = (parent: string, depth: number) => {
      const kids = (children.get(parent) ?? []).sort((a, b) => {
        if (a.folder !== b.folder) return a.folder ? -1 : 1;
        if (depth === 0 && a.folder && b.folder) {
          if (a.path === this.prefix) return -1;
          if (b.path === this.prefix) return 1;
        }
        if (a.name === 'manifest.json') return -1;
        if (b.name === 'manifest.json') return 1;
        return a.name.localeCompare(b.name);
      });
      for (const k of kids) {
        k.depth = depth;
        out.push(k);
        if (k.folder && !this.collapsed.has(k.path)) walk(k.path, depth + 1);
      }
    };
    walk('', 0);
    return out;
  }

  private rowFor(n: Node): HTMLElement {
    let row = this.rows.get(n.key);
    if (row) return row;
    row = document.createElement('div');
    row.className = `edit-node${n.folder ? ' folder' : ''}`;
    row.setAttribute('role', 'treeitem');
    row.dataset.key = n.key;
    row.innerHTML = `<span class="edit-node-caret">${n.folder ? icon('chevron-down', 12) : ''}</span><span class="edit-node-icon">${icon(n.folder ? 'folder' : fileIcon(n.name), 14)}</span><span class="edit-node-name ellipsis">${esc(n.name)}</span><span class="edit-node-type">${n.folder ? '' : esc(typeName(n.name))}</span><span class="edit-node-flag"></span><span class="edit-node-dot" aria-hidden="true"></span><span class="edit-node-acts"><button class="btn ghost icon sm" type="button" data-act="rename" title="Rename" aria-label="Rename" tabindex="-1">${icon('pen', 12)}</button><button class="btn ghost icon sm" type="button" data-act="delete" title="Delete" aria-label="Delete" tabindex="-1">${icon('trash', 12)}</button></span>`;
    const path = n.path;
    const folder = n.folder;
    row.addEventListener('click', (ev) => {
      const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      this.focusKey = row!.dataset.key!;
      if (act === 'rename') return this.opts.rename(path);
      if (act === 'delete') return this.opts.remove(path, folder);
      if (folder) this.toggle(path);
      else this.opts.open(path);
    });
    if (n.folder) row.querySelector('[data-act="rename"]')!.remove();
    this.rows.set(n.key, row);
    return row;
  }

  private toggle(path: string, open?: boolean): void {
    const isOpen = !this.collapsed.has(path);
    const want = open ?? !isOpen;
    if (want === isOpen) return;
    if (want) this.collapsed.delete(path);
    else this.collapsed.add(path);
    this.saveCollapsed();
    this.render();
  }

  setFilter(text: string): void {
    this.filter = text.trim().toLowerCase();
    this.render();
  }

  count(): number {
    return this.files.length;
  }

  private visible(nodes: Node[]): Node[] {
    if (!this.filter) return nodes;
    const hit = new Set<string>();
    for (const n of nodes) {
      if (n.folder || !n.path.toLowerCase().includes(this.filter)) continue;
      hit.add(n.path);
      const parts = n.path.split('/');
      for (let i = 1; i < parts.length; i++) hit.add(parts.slice(0, i).join('/'));
    }
    return nodes.filter((n) => hit.has(n.path));
  }

  private render(): void {
    this.nodes = this.visible(this.build());
    const keep = new Set(this.nodes.map((n) => n.key));
    for (const [k, row] of this.rows) {
      if (!keep.has(k)) {
        row.remove();
        this.rows.delete(k);
      }
    }
    let prev: Element | null = null;
    for (const n of this.nodes) {
      const row = this.rowFor(n);
      row.style.setProperty('--depth', String(n.depth));
      if (n.folder) {
        row.setAttribute('aria-expanded', String(!this.collapsed.has(n.path)));
        row.classList.toggle('outside', n.depth === 0 && n.path !== this.prefix && !!this.prefix);
      } else {
        const f = n.info!;
        row.setAttribute('aria-selected', String(n.path === this.active));
        row.classList.toggle('dirty', this.dirty.has(n.path));
        row.classList.toggle('outside', !f.package);
        const refused = f.package && !packable(n.path);
        row.classList.toggle('refused', refused);
        const flag = row.querySelector<HTMLElement>('.edit-node-flag')!;
        const flagHtml = refused ? icon('warning', 12) : '';
        if (flag.innerHTML !== flagHtml) flag.innerHTML = flagHtml;
        row.title = refused ? `${n.path}\nThis file type is refused in a .formpkg` : f.package ? n.path : `${n.path}\nOutside the package folder: not packed`;
      }
      const at: Element | null = prev ? prev.nextElementSibling : this.list.firstElementChild;
      if (at !== row) this.list.insertBefore(row, at);
      prev = row;
    }
    this.empty.classList.toggle('hidden', this.nodes.length > 0 || !this.collapseKey);
    setText(this.empty, this.collapseKey ? 'No files.' : '');
  }

  private key(ev: KeyboardEvent): void {
    if (!this.nodes.length) return;
    let i = this.nodes.findIndex((n) => n.key === this.focusKey);
    if (i < 0) i = Math.max(0, this.nodes.findIndex((n) => n.path === this.active && !n.folder));
    const n = this.nodes[i];
    const move = (j: number) => {
      const next = this.nodes[Math.max(0, Math.min(this.nodes.length - 1, j))];
      this.focusKey = next.key;
      for (const r of this.rows.values()) r.classList.remove('focus');
      const row = this.rows.get(next.key)!;
      row.classList.add('focus');
      row.scrollIntoView({ block: 'nearest' });
    };
    if (ev.key === 'ArrowDown') move(i + 1);
    else if (ev.key === 'ArrowUp') move(i - 1);
    else if (ev.key === 'ArrowRight' && n.folder) this.toggle(n.path, true);
    else if (ev.key === 'ArrowLeft') {
      if (n.folder && !this.collapsed.has(n.path)) this.toggle(n.path, false);
      else {
        const parent = n.path.slice(0, n.path.lastIndexOf('/'));
        const j = this.nodes.findIndex((x) => x.folder && x.path === parent);
        if (j >= 0) move(j);
      }
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      if (n.folder) this.toggle(n.path);
      else this.opts.open(n.path);
    } else if (ev.key === 'F2' && !n.folder) this.opts.rename(n.path);
    else if (ev.key === 'Delete') this.opts.remove(n.path, n.folder);
    else return;
    ev.preventDefault();
  }
}
