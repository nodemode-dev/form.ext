import { PERMISSION_WORDS } from '../../../../contract/host/host-bridge';
import type { Permission } from '../../../../contract/host/host-bridge';
import { icon, esc, setText, PRODUCTS } from '../../shell';

export type Manifest = Record<string, unknown>;
type Row = Record<string, unknown>;

const KEY_ORDER = ['format', 'format_version', 'id', 'name', 'product', 'kind', 'version', 'author', 'licence', 'native', 'permissions', 'minimum_app', 'api', 'description', 'entry', 'contributes', 'homepage', 'support', 'payload'];
const KINDS = ['script-plugin', 'effect-stack', 'wgsl-kernel', 'audio-chain', 'caption-look', 'lut', 'timeline-template', 'action-set', 'preset', 'theme', 'native-plugin'];
const PERMISSIONS: Permission[] = ['document', 'files-read', 'files-write', 'network', 'models', 'native-code'];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const LOCAL_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const RELPATH_RE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]{1,200}$/;
const MAX_PANELS = 8;
const MAX_COMMANDS = 32;

export function setKey(obj: Manifest, key: string, value: unknown): Manifest {
  if (value === undefined) {
    if (!(key in obj)) return obj;
    const out: Manifest = {};
    for (const [k, v] of Object.entries(obj)) if (k !== key) out[k] = v;
    return out;
  }
  if (key in obj) {
    obj[key] = value;
    return obj;
  }
  const rank = KEY_ORDER.indexOf(key);
  const keys = Object.keys(obj);
  let at = keys.length;
  if (rank >= 0) {
    const after = keys.findIndex((k) => {
      const r = KEY_ORDER.indexOf(k);
      return r > rank;
    });
    if (after >= 0) at = after;
  }
  const out: Manifest = {};
  keys.forEach((k, i) => {
    if (i === at) out[key] = value;
    out[k] = obj[k];
  });
  if (at === keys.length) out[key] = value;
  return out;
}

function inline(v: unknown): string {
  if (Array.isArray(v)) return v.length ? `[${v.map(inline).join(', ')}]` : '[]';
  if (v && typeof v === 'object') {
    const e = Object.entries(v as Row);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(v) ?? 'null';
}

export function formatManifest(m: Manifest, indent = '  ', width = 100): string {
  const walk = (v: unknown, level: number, lead: number): string => {
    if (!v || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    const flat = inline(v);
    if (level > 0 && lead + flat.length <= width) return flat;
    const pad = indent.repeat(level + 1);
    const end = indent.repeat(level);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return `[\n${v.map((x) => pad + walk(x, level + 1, pad.length)).join(',\n')}\n${end}]`;
    }
    const e = Object.entries(v as Row);
    if (!e.length) return '{}';
    return `{\n${e.map(([k, x]) => {
      const key = `${JSON.stringify(k)}: `;
      return pad + key + walk(x, level + 1, pad.length + key.length);
    }).join(',\n')}\n${end}}`;
  };
  return walk(m, 0, 0);
}

function obj(v: unknown): Row {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {};
}

function rows(v: unknown): Row[] {
  return Array.isArray(v) ? v.map((x) => obj(x)) : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

interface FieldDef {
  key: string;
  label: string;
  hint: string;
  kind: 'text' | 'select' | 'textarea' | 'entry';
  required?: boolean;
  optional?: boolean;
  check?: (v: string, m: Manifest) => string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  wide?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', hint: 'Shown in the app’s Extensions menu and panel.', kind: 'text', required: true, check: (v) => (v.trim() ? '' : 'A name is required.') },
  { key: 'id', label: 'Id', hint: 'Lower case letters, digits and hyphens; 2 to 64 characters.', kind: 'text', required: true, check: (v) => (ID_RE.test(v) ? '' : 'Use 2 to 64 lower case letters, digits or hyphens, starting with a letter or digit.') },
  { key: 'product', label: 'App', hint: 'The Form app that loads this extension.', kind: 'select', required: true, options: PRODUCTS.map((p) => ({ value: p.id, label: p.name })) },
  { key: 'kind', label: 'Kind', hint: 'Extensions with panels or commands are script plugins.', kind: 'select', required: true, options: KINDS.map((k) => ({ value: k, label: k })) },
  { key: 'version', label: 'Version', hint: 'Three numbers, for example 0.1.0.', kind: 'text', required: true, placeholder: '0.1.0', check: (v) => (VERSION_RE.test(v) ? '' : 'Use three numbers, for example 0.1.0.') },
  { key: 'minimum_app', label: 'Minimum app', hint: 'Leave empty to load in any version of the app.', kind: 'text', optional: true, placeholder: 'any', check: (v) => (!v || VERSION_RE.test(v) ? '' : 'Use three numbers, for example 2.14.0.') },
  { key: 'author', label: 'Author', hint: 'You or your organisation.', kind: 'text', required: true, check: (v) => (v.trim() ? '' : 'An author is required.') },
  { key: 'licence', label: 'Licence', hint: 'An SPDX id such as Apache-2.0 or MIT.', kind: 'text', required: true, placeholder: 'Apache-2.0', check: (v) => (v.trim() ? '' : 'A licence is required.') },
  { key: 'description', label: 'Description', hint: 'One or two sentences, at most 400 characters.', kind: 'textarea', optional: true, wide: true, check: (v) => (v.length > 400 ? `${v.length - 400} characters too long.` : '') },
  { key: 'entry.ui', label: 'Entry page', hint: 'The page the app loads in the sandbox, inside the package folder.', kind: 'entry', optional: true, wide: true, placeholder: 'ui/index.html', check: (v, m) => {
    const c = obj(m.contributes);
    const needs = rows(c.panels).length > 0 || rows(c.commands).length > 0;
    if (!v) return needs ? 'Panels and commands need an entry page.' : '';
    return RELPATH_RE.test(v) ? '' : 'Use a relative path without .. such as ui/index.html.';
  } },
  { key: 'homepage', label: 'Homepage', hint: 'An https:// address.', kind: 'text', optional: true, wide: true, placeholder: 'https://', check: (v) => (!v || v.startsWith('https://') ? '' : 'Use an https:// address.') },
  { key: 'support', label: 'Support', hint: 'An https:// address where people get help.', kind: 'text', optional: true, wide: true, placeholder: 'https://', check: (v) => (!v || v.startsWith('https://') ? '' : 'Use an https:// address.') },
];

function getField(m: Manifest, key: string): string {
  if (key === 'entry.ui') return str(obj(m.entry).ui);
  return str(m[key]);
}

export interface ManifestFormOptions {
  change: (mutate: (m: Manifest) => Manifest) => void;
  openJson: () => void;
  entryFiles: () => string[];
  manifestPath: () => string;
}

export class ManifestForm {
  readonly el: HTMLElement;
  private opts: ManifestFormOptions;
  private body: HTMLElement;
  private fieldset: HTMLFieldSetElement;
  private notice: HTMLElement;
  private noticeText: HTMLElement;
  private inputs = new Map<string, { input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; hint: HTMLElement; def: FieldDef }>();
  private perms = new Map<Permission, HTMLInputElement>();
  private apiRow: HTMLElement;
  private nativeInput: HTMLInputElement;
  private panelList: HTMLElement;
  private commandList: HTMLElement;
  private panelRows: HTMLElement[] = [];
  private commandRows: HTMLElement[] = [];
  private panelOptions = '';
  private addPanel: HTMLButtonElement;
  private addCommand: HTMLButtonElement;
  private entryList: HTMLDataListElement;
  private tabs: HTMLButtonElement[];
  private sections: HTMLElement[];
  private current: Manifest | null = null;
  private counts: Record<string, HTMLElement> = {};

  constructor(opts: ManifestFormOptions) {
    this.opts = opts;
    const el = document.createElement('aside');
    el.className = 'edit-manifest';
    el.setAttribute('aria-label', 'Manifest');
    el.innerHTML = `
      <div class="edit-manifest-head">
        <span class="edit-manifest-title">${icon('settings', 14)}<span>Manifest</span></span>
        <button class="btn ghost sm edit-manifest-json" type="button" title="Open manifest.json in the editor">${icon('code', 14)}<span>JSON</span></button>
      </div>
      <div class="tabs edit-manifest-tabs" role="tablist">
        <button class="tab" type="button" role="tab" data-tab="details" aria-selected="true">Details</button>
        <button class="tab" type="button" role="tab" data-tab="permissions" aria-selected="false">Permissions<span class="edit-count" data-count="permissions">0</span></button>
        <button class="tab" type="button" role="tab" data-tab="contributes" aria-selected="false">Panels and Commands<span class="edit-count" data-count="contributes">0</span></button>
      </div>
      <div class="edit-manifest-body">
        <div class="notice warning edit-manifest-notice hidden" role="status">${icon('warning')}<span class="edit-manifest-notice-text">&nbsp;</span></div>
        <fieldset class="edit-manifest-form">
          <section class="edit-msec" data-sec="details" role="tabpanel">
            <div class="edit-fields"></div>
            <div class="edit-flags">
              <div class="edit-flag edit-api"><span class="edit-flag-text"><span class="label">Extension API</span><span class="hint">&nbsp;</span></span><button class="btn sm edit-api-fix hidden" type="button">Set to 1</button></div>
              <label class="switch edit-flag edit-native"><input type="checkbox" /><span class="edit-flag-text"><span class="label">Native code</span><span class="hint">API 1 hosts refuse native extensions. Keep it off.</span></span></label>
            </div>
            <datalist class="edit-entry-files"></datalist>
          </section>
          <section class="edit-msec hidden" data-sec="permissions" role="tabpanel">
            <p class="edit-msec-lead">The app asks the person for these, in these words, the first time the extension runs. Ask only for what the code uses: every call that needs a permission it was not given fails.</p>
            <div class="edit-perms"></div>
          </section>
          <section class="edit-msec hidden" data-sec="contributes" role="tabpanel">
            <div class="edit-group">
              <div class="edit-group-head"><span class="section-title">Panels</span><button class="btn ghost sm edit-add-panel" type="button">${icon('plus', 14)}<span>Add Panel</span></button></div>
              <p class="edit-msec-lead">A dock panel opens where the app keeps its panels; a dialog panel opens as one of the app’s dialogs.</p>
              <div class="edit-rows edit-panels"></div>
              <div class="edit-rows-empty edit-panels-empty">No panels.</div>
            </div>
            <div class="edit-group">
              <div class="edit-group-head"><span class="section-title">Commands</span><button class="btn ghost sm edit-add-command" type="button">${icon('plus', 14)}<span>Add Command</span></button></div>
              <p class="edit-msec-lead">Listed in the app’s Extensions menu as Name: Title. A command with a panel opens it; one without runs headless and calls ext.done when it is finished.</p>
              <div class="edit-rows edit-commands"></div>
              <div class="edit-rows-empty edit-commands-empty">No commands.</div>
            </div>
          </section>
        </fieldset>
      </div>`;
    this.el = el;
    this.body = el.querySelector('.edit-manifest-body')!;
    this.fieldset = el.querySelector('.edit-manifest-form')!;
    this.notice = el.querySelector('.edit-manifest-notice')!;
    this.noticeText = el.querySelector('.edit-manifest-notice-text')!;
    this.apiRow = el.querySelector('.edit-api')!;
    this.nativeInput = el.querySelector('.edit-native input')!;
    this.panelList = el.querySelector('.edit-panels')!;
    this.commandList = el.querySelector('.edit-commands')!;
    this.addPanel = el.querySelector('.edit-add-panel')!;
    this.addCommand = el.querySelector('.edit-add-command')!;
    this.entryList = el.querySelector('.edit-entry-files')!;
    this.entryList.id = `edit-entry-files-${Math.random().toString(36).slice(2, 8)}`;
    this.tabs = [...el.querySelectorAll<HTMLButtonElement>('.edit-manifest-tabs .tab')];
    this.sections = [...el.querySelectorAll<HTMLElement>('.edit-msec')];
    el.querySelectorAll<HTMLElement>('[data-count]').forEach((c) => (this.counts[c.dataset.count!] = c));

    el.querySelector('.edit-manifest-json')!.addEventListener('click', () => opts.openJson());
    for (const t of this.tabs) t.addEventListener('click', () => this.showTab(t.dataset.tab!));
    this.buildFields(el.querySelector('.edit-fields')!);
    this.buildPerms(el.querySelector('.edit-perms')!);

    el.querySelector('.edit-api-fix')!.addEventListener('click', () => opts.change((m) => setKey(m, 'api', '1')));
    this.nativeInput.addEventListener('change', () => {
      const on = this.nativeInput.checked;
      opts.change((m) => setKey(m, 'native', on));
    });
    this.addPanel.addEventListener('click', () => this.add('panels'));
    this.addCommand.addEventListener('click', () => this.add('commands'));
    this.setState('none');
  }

  showTab(id: string): void {
    for (const t of this.tabs) t.setAttribute('aria-selected', String(t.dataset.tab === id));
    for (const s of this.sections) s.classList.toggle('hidden', s.dataset.sec !== id);
    this.body.scrollTop = 0;
  }

  private buildFields(host: HTMLElement): void {
    for (const def of FIELDS) {
      const wrap = document.createElement('div');
      wrap.className = `field edit-field${def.wide ? ' wide' : ''}`;
      const fid = `edit-f-${def.key.replace('.', '-')}`;
      let control = '';
      if (def.kind === 'select') control = `<select class="select" id="${fid}">${def.options!.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
      else if (def.kind === 'textarea') control = `<textarea class="textarea" id="${fid}" rows="3" maxlength="600"></textarea>`;
      else control = `<input class="input${def.kind === 'entry' || def.key === 'id' || def.key === 'version' || def.key === 'minimum_app' ? ' code' : ''}" id="${fid}" type="text" spellcheck="false" autocomplete="off"${def.placeholder ? ` placeholder="${esc(def.placeholder)}"` : ''} />`;
      wrap.innerHTML = `<label for="${fid}">${esc(def.label)}${def.required ? '' : ' <span class="edit-opt">optional</span>'}</label>${control}<span class="hint">${esc(def.hint)}</span>`;
      host.append(wrap);
      const input = wrap.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')!;
      if (def.kind === 'entry') input.setAttribute('list', this.entryList.id);
      const hint = wrap.querySelector<HTMLElement>('.hint')!;
      this.inputs.set(def.key, { input, hint, def });
      const commit = () => {
        const raw = input.value;
        const v = def.kind === 'textarea' ? raw : raw.trim();
        this.opts.change((m) => {
          if (def.key === 'entry.ui') {
            const entry = { ...obj(m.entry) };
            if (v) entry.ui = v;
            else delete entry.ui;
            return setKey(m, 'entry', Object.keys(entry).length ? entry : undefined);
          }
          if (def.optional && !v) return setKey(m, def.key, undefined);
          return setKey(m, def.key, v);
        });
      };
      input.addEventListener(def.kind === 'select' ? 'change' : 'input', commit);
    }
  }

  private buildPerms(host: HTMLElement): void {
    for (const p of PERMISSIONS) {
      const row = document.createElement('label');
      row.className = 'check edit-perm';
      const native = p === 'native-code';
      row.innerHTML = `<input type="checkbox" value="${p}"${native ? ' disabled' : ''} /><span class="edit-perm-text"><span class="edit-perm-words">${esc(PERMISSION_WORDS[p])}</span><code class="edit-perm-id">${p}</code>${native ? '<span class="edit-perm-note">Not available to API 1 extensions.</span>' : ''}</span>`;
      host.append(row);
      const input = row.querySelector('input')!;
      this.perms.set(p, input);
      input.addEventListener('change', () => {
        const want = new Set(PERMISSIONS.filter((x) => this.perms.get(x)!.checked));
        this.opts.change((m) => {
          const before = Array.isArray(m.permissions) ? (m.permissions as unknown[]).map(String) : [];
          const kept = before.filter((x) => want.has(x as Permission) || !PERMISSIONS.includes(x as Permission));
          for (const x of PERMISSIONS) if (want.has(x) && !kept.includes(x)) kept.push(x);
          const ordered = [...PERMISSIONS.filter((x) => kept.includes(x)), ...kept.filter((x) => !PERMISSIONS.includes(x as Permission))];
          return setKey(m, 'permissions', ordered);
        });
      });
    }
  }

  private add(list: 'panels' | 'commands'): void {
    this.opts.change((m) => {
      const c = { ...obj(m.contributes) };
      const items = rows(c[list]);
      const taken = new Set(items.map((r) => str(r.id)));
      const base = list === 'panels' ? 'panel' : 'command';
      let id = items.length ? `${base}-${items.length + 1}` : list === 'panels' ? 'main' : 'run';
      let n = items.length + 1;
      while (taken.has(id)) id = `${base}-${++n}`;
      const name = str(m.name) || 'Extension';
      const item: Row = list === 'panels' ? { id, title: name, location: 'dock' } : { id, title: items.length ? `Command ${items.length + 1}` : `Run ${name}` };
      c[list] = [...(Array.isArray(c[list]) ? (c[list] as unknown[]) : []), item];
      let out = setKey(m, 'contributes', c);
      if (!str(obj(out.entry).ui)) {
        const files = this.opts.entryFiles();
        out = setKey(out, 'entry', { ...obj(out.entry), ui: files.includes('ui/index.html') ? 'ui/index.html' : files[0] ?? 'ui/index.html' });
      }
      return out;
    });
    this.showTab('contributes');
    window.requestAnimationFrame(() => {
      const listEl = list === 'panels' ? this.panelList : this.commandList;
      const last = listEl.lastElementChild?.querySelector<HTMLInputElement>('input[data-k="title"]');
      last?.focus();
      last?.select();
    });
  }

  private rowEl(list: 'panels' | 'commands'): HTMLElement {
    const row = document.createElement('div');
    row.className = 'edit-row';
    const third = list === 'panels'
      ? `<select class="select" data-k="location" aria-label="Where it opens"><option value="dock">Dock</option><option value="dialog">Dialog</option></select>`
      : `<select class="select" data-k="panel" aria-label="Panel it opens"><option value="">Headless</option></select>`;
    row.innerHTML = `<input class="input code" data-k="id" type="text" spellcheck="false" autocomplete="off" aria-label="Id" placeholder="id" /><input class="input" data-k="title" type="text" autocomplete="off" aria-label="Title" placeholder="Title" />${third}<button class="btn ghost icon sm edit-row-remove" type="button" title="Remove" aria-label="Remove">${icon('trash', 14)}</button><span class="edit-row-error">&nbsp;</span>`;
    const index = () => [...row.parentElement!.children].indexOf(row);
    const update = (k: string, value: string) => {
      const i = index();
      this.opts.change((m) => {
        const c = { ...obj(m.contributes) };
        const items = Array.isArray(c[list]) ? [...(c[list] as unknown[])] : [];
        const item = { ...obj(items[i]) };
        const old = str(item.id);
        if (value || k === 'id' || k === 'title') item[k] = value;
        else delete item[k];
        items[i] = item;
        c[list] = items;
        if (list === 'panels' && k === 'id' && old && Array.isArray(c.commands)) {
          c.commands = (c.commands as unknown[]).map((x) => {
            const cmd = obj(x);
            return str(cmd.panel) === old ? { ...cmd, panel: value } : x;
          });
        }
        return setKey(m, 'contributes', c);
      });
    };
    row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((input) => {
      input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => update(input.dataset.k!, input.tagName === 'SELECT' ? input.value : input.value.trim()));
    });
    row.querySelector('.edit-row-remove')!.addEventListener('click', () => {
      const i = index();
      this.opts.change((m) => {
        const c = { ...obj(m.contributes) };
        const items = Array.isArray(c[list]) ? [...(c[list] as unknown[])] : [];
        const gone = str(obj(items[i]).id);
        items.splice(i, 1);
        if (items.length) c[list] = items;
        else delete c[list];
        if (list === 'panels' && gone && Array.isArray(c.commands)) {
          c.commands = (c.commands as unknown[]).map((x) => {
            const cmd = { ...obj(x) };
            if (str(cmd.panel) === gone) delete cmd.panel;
            return cmd;
          });
        }
        return setKey(m, 'contributes', Object.keys(c).length ? c : undefined);
      });
    });
    return row;
  }

  private syncRows(list: 'panels' | 'commands', items: Row[], m: Manifest): void {
    const host = list === 'panels' ? this.panelList : this.commandList;
    const store = list === 'panels' ? this.panelRows : this.commandRows;
    while (store.length < items.length) {
      const r = this.rowEl(list);
      store.push(r);
      host.append(r);
    }
    while (store.length > items.length) store.pop()!.remove();
    const panelIds = rows(obj(m.contributes).panels).map((p) => str(p.id)).filter(Boolean);
    const optionsKey = panelIds.join('\n');
    const ids = items.map((r) => str(r.id));
    items.forEach((item, i) => {
      const row = store[i];
      if (list === 'commands' && this.panelOptions !== optionsKey) {
        const sel = row.querySelector<HTMLSelectElement>('[data-k="panel"]')!;
        sel.innerHTML = `<option value="">Headless</option>${panelIds.map((p) => `<option value="${esc(p)}">Opens ${esc(p)}</option>`).join('')}`;
      }
      for (const input of row.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]')) {
        const k = input.dataset.k!;
        let v = str(item[k]);
        if (k === 'location' && !v) v = 'dock';
        if (input.tagName === 'SELECT' && k === 'panel' && v && !panelIds.includes(v)) {
          const sel = input as HTMLSelectElement;
          if (![...sel.options].some((o) => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">Missing panel ${esc(v)}</option>`);
        }
        if (document.activeElement !== input && input.value !== v) input.value = v;
      }
      const id = str(item.id);
      const title = str(item.title);
      let err = '';
      if (!LOCAL_RE.test(id)) err = 'Id: 1 to 32 lower case letters, digits or hyphens.';
      else if (ids.indexOf(id) !== i) err = `Another ${list === 'panels' ? 'panel' : 'command'} has the id ${id}.`;
      else if (!title.trim()) err = 'A title is required.';
      else if (title.length > (list === 'panels' ? 60 : 80)) err = `The title is longer than ${list === 'panels' ? 60 : 80} characters.`;
      else if (list === 'commands' && str(item.panel) && !panelIds.includes(str(item.panel))) err = `There is no panel ${str(item.panel)}.`;
      row.querySelector<HTMLInputElement>('[data-k="id"]')!.setAttribute('aria-invalid', String(err.startsWith('Id') || err.startsWith('Another')));
      row.querySelector<HTMLInputElement>('[data-k="title"]')!.setAttribute('aria-invalid', String(err.startsWith('A title') || err.startsWith('The title')));
      row.classList.toggle('invalid', !!err);
      setText(row.querySelector('.edit-row-error'), err || ' ');
    });
    if (list === 'commands') this.panelOptions = optionsKey;
    const empty = this.el.querySelector<HTMLElement>(list === 'panels' ? '.edit-panels-empty' : '.edit-commands-empty')!;
    empty.classList.toggle('hidden', items.length > 0);
    (list === 'panels' ? this.addPanel : this.addCommand).disabled = items.length >= (list === 'panels' ? MAX_PANELS : MAX_COMMANDS);
  }

  setState(state: 'none' | 'loading' | 'missing' | 'invalid', message = ''): void {
    this.current = null;
    const text = state === 'missing' ? 'This project has no manifest.json in its package folder.' : message;
    this.notice.className = `notice warning edit-manifest-notice${state === 'invalid' || state === 'missing' ? '' : ' hidden'}`;
    setText(this.noticeText, text || ' ');
    this.fieldset.disabled = true;
    this.el.classList.add('is-off');
  }

  setText(text: string): void {
    let m: unknown;
    try {
      m = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setState('invalid', `manifest.json is not valid JSON (${msg}). Fix it in the editor; the form follows once it parses.`);
      return;
    }
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      this.setState('invalid', 'manifest.json must hold one JSON object.');
      return;
    }
    this.fill(m as Manifest);
  }

  private fill(m: Manifest): void {
    this.current = m;
    this.fieldset.disabled = false;
    this.el.classList.remove('is-off');
    this.notice.classList.add('hidden');
    const files = this.opts.entryFiles();
    const opts = files.map((f) => `<option value="${esc(f)}"></option>`).join('');
    if (this.entryList.innerHTML !== opts) this.entryList.innerHTML = opts;
    for (const { input, hint, def } of this.inputs.values()) {
      const v = getField(m, def.key);
      if (input.tagName === 'SELECT') {
        const sel = input as HTMLSelectElement;
        sel.querySelector('option[data-extra]')?.remove();
        if (v && !def.options!.some((o) => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option data-extra value="${esc(v)}">${esc(v)} (not valid)</option>`);
        if (!v) sel.insertAdjacentHTML('afterbegin', '<option data-extra value="" disabled>Choose…</option>');
      }
      if (document.activeElement !== input && input.value !== v) input.value = v;
      let err = def.check ? def.check(v, m) : '';
      if (!err && def.kind === 'select' && !def.options!.some((o) => o.value === v)) err = v ? `${v} is not one of the choices.` : 'Choose one.';
      if (!err && def.key === 'entry.ui' && v && files.length && !files.includes(v)) err = `There is no ${v} in the package folder yet.`;
      if (!err && def.key === 'kind' && v !== 'script-plugin' && obj(m.contributes) && (rows(obj(m.contributes).panels).length || rows(obj(m.contributes).commands).length)) err = 'Panels and commands are run by script plugins.';
      input.setAttribute('aria-invalid', String(!!err));
      hint.classList.toggle('error', !!err);
      setText(hint, err || def.hint);
    }
    const api = m.api;
    const apiOk = api === '1';
    this.apiRow.classList.toggle('bad', !apiOk);
    setText(this.apiRow.querySelector('.hint'), apiOk ? 'API 1, the version every Form host loads.' : api === undefined ? 'Missing: every API 1 host refuses this extension.' : `${JSON.stringify(api)}: every API 1 host refuses this extension.`);
    this.apiRow.querySelector('.edit-api-fix')!.classList.toggle('hidden', apiOk);
    this.nativeInput.checked = m.native === true;
    this.nativeInput.closest('.edit-native')!.classList.toggle('bad', m.native !== false);
    setText(this.nativeInput.closest('.edit-native')!.querySelector('.hint'), m.native === true ? 'On: API 1 hosts refuse native extensions.' : m.native === false ? 'API 1 hosts refuse native extensions. Keep it off.' : 'Missing: the manifest needs native: false.');
    const granted = Array.isArray(m.permissions) ? (m.permissions as unknown[]).map(String) : [];
    for (const [p, input] of this.perms) {
      input.checked = granted.includes(p);
      input.closest('.edit-perm')!.classList.toggle('bad', p === 'native-code' && input.checked);
    }
    setText(this.counts.permissions, String(granted.length));
    const c = obj(m.contributes);
    const panels = rows(c.panels);
    const commands = rows(c.commands);
    this.syncRows('panels', panels, m);
    this.syncRows('commands', commands, m);
    setText(this.counts.contributes, String(panels.length + commands.length));
  }

  manifest(): Manifest | null {
    return this.current;
  }
}
