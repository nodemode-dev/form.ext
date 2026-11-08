import './preview.css';
import { icon, esc, appIcon, HOSTS, productName, storage, theme, chooseProject, errorMessage, ApiError } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';
import { SimHost, simFor, sampleFile, accepts } from '../../sim';
import type { AppSim, SimFile } from '../../sim';
import { HostError, ERR, PERMISSION_WORDS } from '../../../../contract/host/host-bridge';
import type { ExtensionRecord, Permission } from '../../../../contract/host/host-bridge';
import { sizeText, b64ToBytes } from '../../sim/util';
import { MessageLog, pretty, short } from './log';

interface Answer {
  project: string;
  product: string;
  record: ExtensionRecord & { kind?: string };
  manifest: Record<string, unknown>;
}

type Tab = 'log' | 'events' | 'document' | 'permissions';

const AUTO_KEY = 'formext.preview.auto';
const MODE_KEY = 'formext.preview.mode';
const OFF_KEY = 'formext.preview.off';
const FILE_CAP = 200 * 1024 * 1024;
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Log', icon: 'list' },
  { id: 'events', label: 'Events', icon: 'bolt' },
  { id: 'document', label: 'Document', icon: 'file' },
  { id: 'permissions', label: 'Permissions', icon: 'shield' },
];
const METHODS: Record<string, string> = { document: 'document.read, document.apply, app.commands, app.run', 'files-read': 'files.open', 'files-write': 'files.save', network: 'net.fetch', models: 'nothing extra in API 1', 'native-code': 'refused by API 1 hosts' };

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill pv-pane">
      <header class="pane-head">
        <span class="pv-mark">${icon('preview', 18)}</span>
        <div class="pv-title"><h1>Preview</h1><div class="sub pv-sub">&nbsp;</div></div>
        <div class="actions">
          <label class="pv-as" title="The app the simulated host plays. The manifest's product is the default; another app shows how it refuses the extension.">
            <span>Simulate in</span>
            <select class="select pv-as-select">${HOSTS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
          </label>
          <label class="switch pv-auto" title="Reload the extension whenever a file of the project is saved"><input type="checkbox" /><span>Reload on save</span></label>
          <label class="switch pv-mode" title="The simulated app's theme; sends ext.theme to open frames"><input type="checkbox" /><span>Light</span></label>
          <button class="btn ghost pv-docs" type="button" title="The simulated app's extension API page in Docs">${icon('docs')}<span>API</span></button>
          <button class="btn pv-reload" type="button">${icon('refresh')}<span>Reload</span></button>
        </div>
      </header>
      <div class="pv-empty empty" hidden>
        <div class="pv-empty-icon">${icon('preview', 28)}</div>
        <h2 class="pv-empty-title">No project open</h2>
        <p class="pv-empty-text">Open a project to run its extension in a simulated host.</p>
        <button class="btn primary pv-open" type="button">${icon('folder-open')}<span>Open a Project</span></button>
      </div>
      <div class="pv-main">
        <section class="pv-stage" aria-label="Simulated app">
          <div class="pv-appbar">
            <span class="pv-appicon"></span>
            <div class="pv-appname"><b class="pv-app">&nbsp;</b><span class="pv-doctitle">&nbsp;</span></div>
            <span class="chip pv-state">&nbsp;</span>
          </div>
          <div class="pv-strip" role="toolbar" aria-label="Extensions menu"><span class="pv-strip-label">Extensions</span><span class="pv-strip-items"></span></div>
          <div class="pv-refused notice error" hidden>${icon('error')}<div><b>Refused.</b> <span class="pv-refused-text"></span></div></div>
          <div class="pv-work">
            <div class="pv-doc">
              <div class="pv-doc-head"><span class="pv-doc-label">Document</span><button class="btn sm ghost pv-undo" type="button" disabled>${icon('chevron-left', 14)}<span>Undo</span></button></div>
              <div class="pv-doc-view"></div>
            </div>
            <div class="pv-dock">
              <div class="pv-dock-tabs" role="tablist"></div>
              <div class="pv-dock-body"><div class="pv-dock-empty"><p>No panel open.</p><p class="pv-dock-hint">Use the buttons in the Extensions row above, as the app's Extensions menu would.</p></div></div>
            </div>
          </div>
          <div class="pv-poverlay" hidden><div class="pv-pdialog card" role="dialog" aria-modal="true"><div class="pv-dialog-head"><b class="pv-dialog-title">&nbsp;</b><button class="btn sm ghost icon pv-dialog-close" type="button" aria-label="Close">${icon('close', 14)}</button></div><div class="pv-dialog-body"></div></div></div>
          <div class="pv-overlay" hidden><div class="pv-dialog card" role="dialog" aria-modal="true"></div></div>
          <div class="pv-headless" aria-hidden="true"></div>
        </section>
        <aside class="pv-side">
          <div class="tabs pv-tabs" role="tablist">${TABS.map((t) => `<button class="tab" type="button" role="tab" data-tab="${t.id}" aria-selected="false">${icon(t.icon)}<span>${t.label}</span></button>`).join('')}</div>
          <div class="pv-tabbody" data-tab="log">
            <div class="toolbar pv-log-bar">
              <input class="input pv-log-filter" type="search" placeholder="Filter messages" aria-label="Filter messages" />
              <button class="chip pv-dir" type="button" data-dir="in" aria-pressed="true" title="Extension to host">&rarr; requests</button>
              <button class="chip pv-dir" type="button" data-dir="out" aria-pressed="true" title="Host to extension">&larr; host</button>
              <button class="chip pv-errs" type="button" aria-pressed="false">${icon('error', 12)}<span>Errors</span></button>
              <span class="pv-log-count">0 messages</span>
              <button class="btn sm ghost pv-log-copy" type="button" title="Copy the log as JSON">${icon('copy', 14)}</button>
              <button class="btn sm ghost pv-log-clear" type="button" title="Clear the log">${icon('trash', 14)}</button>
            </div>
            <div class="pv-log"></div>
          </div>
          <div class="pv-tabbody" data-tab="events" hidden>
            <div class="pv-section">
              <div class="section-title">Send an event</div>
              <div class="pv-row"><select class="select pv-ev-name" aria-label="Event"></select><input class="input pv-ev-custom" placeholder="custom.event" aria-label="Custom event name" hidden /></div>
              <textarea class="textarea code pv-ev-data" rows="7" spellcheck="false" aria-label="Event data (JSON)"></textarea>
              <div class="pv-row"><span class="pv-ev-note"></span><button class="btn primary sm pv-ev-send" type="button">${icon('bolt', 14)}<span>Send ext.event</span></button></div>
            </div>
            <div class="pv-section">
              <div class="section-title">Host messages</div>
              <div class="pv-row pv-wrap">
                <button class="btn sm pv-send-theme" type="button">${icon('sun', 14)}<span>Send ext.theme</span></button>
                <button class="btn sm pv-send-activate" type="button">${icon('play', 14)}<span>Send ext.activate again</span></button>
                <button class="btn sm pv-close-all" type="button">${icon('close', 14)}<span>Close panels (ext.deactivate)</span></button>
              </div>
            </div>
            <div class="pv-section"><div class="section-title">This app's events</div><div class="pv-ev-list list"></div></div>
          </div>
          <div class="pv-tabbody" data-tab="document" hidden>
            <div class="toolbar pv-doc-bar">
              <label class="pv-row"><span>document.read</span><select class="select pv-what" aria-label="what"></select></label>
              <span class="pv-doc-steps"></span>
              <button class="btn sm pv-doc-edit" type="button">${icon('edit', 14)}<span>Edit</span></button>
              <button class="btn sm pv-doc-reset" type="button">${icon('refresh', 14)}<span>Reset</span></button>
            </div>
            <pre class="code-block pv-doc-json"></pre>
            <div class="pv-doc-editor" hidden>
              <p class="pv-note">The whole simulated document as the preview holds it. Apply sends the app's change events, like an edit in the app.</p>
              <textarea class="textarea code pv-doc-text" rows="18" spellcheck="false" aria-label="Simulated document"></textarea>
              <div class="pv-row"><span class="pv-doc-err"></span><button class="btn sm pv-doc-cancel" type="button">Cancel</button><button class="btn primary sm pv-doc-apply" type="button">Apply</button></div>
            </div>
          </div>
          <div class="pv-tabbody" data-tab="permissions" hidden>
            <div class="pv-section">
              <div class="section-title">Consent</div>
              <div class="pv-row"><span class="chip pv-consent">&nbsp;</span><span class="pv-consent-text"></span></div>
              <div class="pv-row pv-wrap"><button class="btn sm pv-allow" type="button">${icon('check', 14)}<span>Allow now</span></button><button class="btn sm pv-revoke" type="button">${icon('lock', 14)}<span>Forget consent</span></button></div>
              <p class="pv-note">The host asks before it creates the frame, the first time a version with this permission set opens. Allow is kept per id, version and permissions; Not Now is not.</p>
            </div>
            <div class="pv-section"><div class="section-title">Declared permissions</div><div class="pv-perms list"></div><p class="pv-note">Turn one off to run the extension as if its manifest did not ask for it: calls that need it fail with -32001, and the smaller permission set asks for consent again.</p></div>
            <div class="pv-section"><div class="section-title">What this app offers</div><div class="pv-offers list"></div></div>
            <div class="pv-section"><div class="section-title">Storage</div><div class="pv-row"><span class="pv-storage"></span><button class="btn sm pv-storage-clear" type="button">${icon('trash', 14)}<span>Clear</span></button></div></div>
          </div>
        </aside>
      </div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string) => (el.querySelector(sel) ?? document.querySelector(sel)) as T;
  const ui = {
    sub: q('.pv-sub'),
    as: q<HTMLSelectElement>('.pv-as-select'),
    auto: q<HTMLInputElement>('.pv-auto input'),
    mode: q<HTMLInputElement>('.pv-mode input'),
    reload: q<HTMLButtonElement>('.pv-reload'),
    empty: q('.pv-empty'),
    emptyTitle: q('.pv-empty-title'),
    emptyText: q('.pv-empty-text'),
    main: q('.pv-main'),
    stage: q('.pv-stage'),
    appicon: q('.pv-appicon'),
    app: q('.pv-app'),
    doctitle: q('.pv-doctitle'),
    state: q('.pv-state'),
    strip: q('.pv-strip-items'),
    refused: q('.pv-refused'),
    refusedText: q('.pv-refused-text'),
    docLabel: q('.pv-doc-label'),
    docView: q('.pv-doc-view'),
    undo: q<HTMLButtonElement>('.pv-undo'),
    dockTabs: q('.pv-dock-tabs'),
    dockBody: q('.pv-dock-body'),
    dockEmpty: q('.pv-dock-empty'),
    poverlay: q('.pv-poverlay'),
    ptitle: q('.pv-pdialog .pv-dialog-title'),
    pbody: q('.pv-pdialog .pv-dialog-body'),
    overlay: q('.pv-overlay'),
    dialog: q('.pv-dialog'),
    headless: q('.pv-headless'),
    evName: q<HTMLSelectElement>('.pv-ev-name'),
    evCustom: q<HTMLInputElement>('.pv-ev-custom'),
    evData: q<HTMLTextAreaElement>('.pv-ev-data'),
    evNote: q('.pv-ev-note'),
    evList: q('.pv-ev-list'),
    what: q<HTMLSelectElement>('.pv-what'),
    docJson: q('.pv-doc-json'),
    docSteps: q('.pv-doc-steps'),
    docEditor: q('.pv-doc-editor'),
    docText: q<HTMLTextAreaElement>('.pv-doc-text'),
    docErr: q('.pv-doc-err'),
    consent: q('.pv-consent'),
    consentText: q('.pv-consent-text'),
    perms: q('.pv-perms'),
    offers: q('.pv-offers'),
    storage: q('.pv-storage'),
  };
  const log = new MessageLog(q('.pv-log'), q('.pv-log-count'));

  let project: ProjectRef | null = null;
  let answer: Answer | null = null;
  let sim: AppSim | null = null;
  let host: SimHost | null = null;
  let generation = 0;
  let activePanel = '';
  let lastActivation: { panel: string } | null = null;
  const docks = new Map<string, { tab: HTMLElement; body: HTMLElement; title: string }>();
  let dialogPanel = '';
  let dialogBusy = false;
  const dialogQueue: (() => void)[] = [];

  ui.auto.checked = storage.get(AUTO_KEY) !== '0';
  ui.mode.checked = (storage.get(MODE_KEY) ?? theme.mode()) === 'light';

  const offPerms = (): string[] => storage.json<Record<string, string[]>>(OFF_KEY, {})[answer?.record.id ?? ''] ?? [];
  const setOffPerms = (list: string[]) => {
    const all = storage.json<Record<string, string[]>>(OFF_KEY, {});
    if (!answer) return;
    all[answer.record.id] = list;
    storage.set(OFF_KEY, JSON.stringify(all));
  };

  const effective = (): ExtensionRecord | null => {
    if (!answer) return null;
    const off = offPerms();
    return { ...answer.record, permissions: answer.record.permissions.filter((p) => !off.includes(p)) };
  };

  renderDocument();
  renderPermissions();

  function dialog<T>(build: (box: HTMLElement, done: (v: T) => void) => void): Promise<T> {
    return new Promise((resolve) => {
      const show = () => {
        dialogBusy = true;
        const box = document.createElement('div');
        box.className = 'pv-dialog-box';
        ui.dialog.replaceChildren(box);
        ui.overlay.hidden = false;
        let finished = false;
        build(box, (v) => {
          if (finished) return;
          finished = true;
          ui.overlay.hidden = true;
          ui.dialog.replaceChildren();
          dialogBusy = false;
          resolve(v);
          dialogQueue.shift()?.();
        });
      };
      if (dialogBusy) dialogQueue.push(show);
      else show();
    });
  }

  function consent(rec: ExtensionRecord): Promise<boolean> {
    return dialog<boolean>((box, done) => {
      box.innerHTML = `<h3>${esc(rec.name)} would like to</h3><ul class="pv-consent-list">${rec.permissions.map((p) => `<li>${icon('check', 14)}<span>${esc(PERMISSION_WORDS[p as Permission] ?? p)}</span></li>`).join('')}</ul><p class="pv-note">${esc(sim?.app ?? '')} asks once for version ${esc(rec.version)}. This is the simulated host's consent dialog; the extension's frame is not created until you choose.</p><div class="pv-row pv-end"><button class="btn" type="button" data-v="no">Not Now</button><button class="btn primary" type="button" data-v="yes">Allow</button></div>`;
      box.querySelector<HTMLButtonElement>('[data-v="yes"]')?.focus();
      box.addEventListener('click', (ev) => {
        const v = (ev.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
        if (v) {
          done(v === 'yes');
          renderPermissions();
          renderState();
        }
      });
    });
  }

  function readLocal(file: File): Promise<SimFile> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(r.result).split(',')[1] ?? '' });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  function openFiles(_rec: ExtensionRecord, accept: string[], multiple: boolean): Promise<SimFile[]> {
    const names = [...new Set([...(sim?.samples ?? []), 'photo.png', 'song.wav', 'members.csv', 'library.bib', 'notes.txt', 'membership-form.pdf', 'chapters.json', 'logo.svg', 'SKILL.md'])];
    const samples = names.map((n) => ({ n, f: sampleFile(n) })).filter((x): x is { n: string; f: SimFile } => !!x.f && accepts(x.f.name, x.f.type, accept));
    return dialog<SimFile[] | null>((box, done) => {
      box.innerHTML = `<h3>Open</h3><p class="pv-note">${accept.length ? `Files of type ${esc(accept.join(', '))}` : 'Any file'}${multiple ? ', one or more' : ''}. The real app shows its own file dialog here.</p><div class="list pv-files">${samples.length ? samples.map(({ f }, i) => `<label class="list-row pv-file"><input type="${multiple ? 'checkbox' : 'radio'}" name="pvf" value="${i}" ${i === 0 ? 'checked' : ''} /><span>${esc(f.name)}</span><span class="pv-m">${esc(f.type)}, ${sizeText(f.size)}</span></label>`).join('') : '<div class="pv-note">No sample file matches. Choose one from this computer.</div>'}</div><input type="file" class="pv-local" hidden ${multiple ? 'multiple' : ''} accept="${esc(accept.join(','))}" /><div class="pv-row pv-end"><button class="btn ghost pv-pick" type="button">${icon('folder-open', 14)}<span>From this computer</span></button><span class="pv-grow"></span><button class="btn" type="button" data-v="cancel">Cancel</button><button class="btn primary" type="button" data-v="open" ${samples.length ? '' : 'disabled'}>Open</button></div>`;
      const local = box.querySelector<HTMLInputElement>('.pv-local') as HTMLInputElement;
      box.querySelector('.pv-pick')?.addEventListener('click', () => local.click());
      local.addEventListener('change', async () => {
        const files = [...(local.files ?? [])];
        if (!files.length) return;
        const total = files.reduce((n, f) => n + f.size, 0);
        if (total > FILE_CAP) {
          ctx.notify('Those files are over 200 MB together.', 'error');
          return;
        }
        done(await Promise.all(files.map(readLocal)));
      });
      box.addEventListener('click', (ev) => {
        const v = (ev.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
        if (v === 'cancel') done(null);
        if (v === 'open') done([...box.querySelectorAll<HTMLInputElement>('input[name="pvf"]:checked')].map((i) => samples[Number(i.value)].f));
      });
    }).then((files) => {
      if (!files) throw new HostError(ERR.CANCELLED, 'the person cancelled');
      return files;
    });
  }

  function saveFile(_rec: ExtensionRecord, name: string, type: string, data: string): Promise<{ saved: boolean; name: string }> {
    let bytes: Uint8Array;
    try {
      bytes = b64ToBytes(data);
    } catch {
      return Promise.reject(new HostError(ERR.INVALID, 'data is not base64'));
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
    const textual = /^(text\/|application\/(json|xml|csv))/.test(type);
    const preview = type.startsWith('image/') ? `<img class="pv-save-img" src="${url}" alt="" />` : textual ? `<pre class="code-block pv-save-text">${esc(new TextDecoder().decode(bytes.subarray(0, 4000)))}</pre>` : '';
    return dialog<string | null>((box, done) => {
      box.innerHTML = `<h3>Save</h3><label class="field"><span>Name</span><input class="input pv-save-name" value="${esc(name)}" /></label><p class="pv-note">${esc(type)}, ${sizeText(bytes.length)}. Save downloads it from the preview; the real app shows its own save dialog.</p>${preview}<div class="pv-row pv-end"><button class="btn" type="button" data-v="cancel">Cancel</button><button class="btn primary" type="button" data-v="save">Save</button></div>`;
      box.addEventListener('click', (ev) => {
        const v = (ev.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
        if (v === 'cancel') done(null);
        if (v === 'save') {
          const chosen = (box.querySelector<HTMLInputElement>('.pv-save-name')?.value || name).trim();
          const a = document.createElement('a');
          a.href = url;
          a.download = chosen;
          a.click();
          done(chosen);
        }
      });
    }).then((chosen) => {
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      if (!chosen) throw new HostError(ERR.CANCELLED, 'the person cancelled');
      return { saved: true, name: chosen };
    });
  }

  async function fetchVia(req: { url: string; method?: string; headers?: Record<string, string>; body?: string }) {
    try {
      return await ctx.api.post<{ status: number; headers: Record<string, string>; body: string }>('/api/preview/fetch', req);
    } catch (err) {
      throw new HostError(err instanceof ApiError && err.status === 400 ? ERR.INVALID : ERR.REFUSED, errorMessage(err));
    }
  }

  function renderStrip() {
    const rec = answer?.record;
    if (!rec || rec.state !== 'ready') {
      ui.strip.innerHTML = '<span class="pv-m">nothing to run</span>';
      return;
    }
    const items = [
      ...rec.commands.map((c) => `<button class="btn sm pv-cmd" type="button" data-command="${esc(c.id)}" title="${c.panel ? `opens panel ${esc(c.panel)}` : 'runs headless'}">${icon(c.panel ? 'panel' : 'command', 14)}<span>${esc(rec.name)}: ${esc(c.title)}</span></button>`),
      ...rec.panels.map((p) => `<button class="btn sm ghost pv-panel" type="button" data-panel="${esc(p.id)}" title="${p.location === 'dialog' ? 'opens as a dialog' : 'opens in the dock'}">${icon('panel', 14)}<span>Open ${esc(p.title)}</span></button>`),
    ];
    ui.strip.innerHTML = items.join('') || '<span class="pv-m">this extension contributes no panels or commands</span>';
  }

  ui.strip.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.panel) void openPanel(t.dataset.panel);
    if (t.dataset.command) void runContributed(t.dataset.command);
  });

  function renderState() {
    const rec = effective();
    if (!rec || !host) return;
    const granted = host.isGranted(rec);
    const refused = rec.state !== 'ready';
    ui.state.className = `chip pv-state ${refused ? 'error' : granted ? 'success' : 'warning'}`;
    ui.state.textContent = refused ? 'Refused' : granted ? 'Ready' : 'Needs Permission';
    ui.refused.hidden = !refused;
    ui.refusedText.textContent = refused ? `${sim?.app} refuses ${rec.name}: ${rec.reason}.` : '';
  }

  function renderDoc() {
    if (!host || !sim) return;
    ui.doctitle.textContent = sim.title(host.state);
    ui.docView.innerHTML = sim.view(host.state);
    const last = host.steps.at(-1);
    ui.undo.disabled = !last;
    ui.undo.title = last ? `Undo ${last.label}` : 'Nothing to undo';
    (ui.undo.querySelector('span') as HTMLElement).textContent = last ? `Undo ${last.label}` : 'Undo';
    ui.docSteps.textContent = `${host.steps.length} ${host.steps.length === 1 ? 'step' : 'steps'}`;
    if (q('.pv-tabbody[data-tab="document"]').offsetParent) renderDocument();
  }

  let readSeq = 0;
  async function renderDocument() {
    if (!host) return;
    const mine = ++readSeq;
    try {
      const value = await host.read({ what: ui.what.value || undefined });
      if (mine === readSeq) ui.docJson.textContent = pretty(value);
    } catch (err) {
      if (mine === readSeq) ui.docJson.textContent = `Error ${(err as HostError).code}: ${(err as Error).message}`;
    }
  }

  function renderEvents() {
    if (!sim || !host) return;
    ui.evName.innerHTML = `${sim.events.map((e) => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('')}<option value="">custom...</option>`;
    ui.evList.innerHTML = sim.events.map((e) => `<button class="list-row interactive pv-ev" type="button" data-name="${esc(e.name)}"><b>${esc(e.name)}</b><span class="pv-m">${esc(e.note)}</span></button>`).join('');
    fillEvent();
  }

  function fillEvent() {
    if (!sim || !host) return;
    const ev = sim.events.find((e) => e.name === ui.evName.value);
    ui.evCustom.hidden = ui.evName.value !== '';
    ui.evNote.textContent = ev ? ev.note : 'any name; hosts send only the names their page lists';
    ui.evData.value = pretty(ev ? ev.sample(host.state) : {});
  }

  function renderPermissions() {
    const rec = effective();
    if (!rec || !host || !answer || !sim) return;
    const granted = host.isGranted(rec);
    ui.consent.className = `chip pv-consent ${granted ? 'success' : 'warning'}`;
    ui.consent.textContent = rec.permissions.length === 0 ? 'Not needed' : granted ? 'Allowed' : 'Not allowed yet';
    ui.consentText.textContent = rec.permissions.length ? `${rec.name} ${rec.version} with ${rec.permissions.join(', ')}` : 'it asks for no permission, so no dialog is shown';
    const off = offPerms();
    ui.perms.innerHTML = answer.record.permissions.length ? answer.record.permissions.map((p) => `<label class="list-row pv-perm"><span class="switch"><input type="checkbox" data-perm="${esc(p)}" ${off.includes(p) ? '' : 'checked'} /></span><span><b>${esc(p)}</b> <span class="pv-m">${esc(PERMISSION_WORDS[p as Permission] ?? '')}</span><br /><span class="pv-m">${esc(METHODS[p] ?? '')}</span></span></label>`).join('') : '<div class="pv-note">The manifest asks for no permissions.</div>';
    const o = sim.offers;
    const row = (name: string, yes: boolean, text: string) => `<div class="list-row"><span class="chip ${yes ? 'success' : ''}">${yes ? 'yes' : '-32003'}</span><span><b>${name}</b> <span class="pv-m">${esc(text)}</span></span></div>`;
    ui.offers.innerHTML = [row('document.*', true, `${Object.keys(sim.reads).length} reads: ${Object.keys(sim.reads).join(', ')}`), row('app.commands', true, `${Object.keys(sim.cmds).length} commands`), row('files.open', o.filesOpen, 'the host file dialog'), row('files.save', o.filesSave, 'the host save dialog'), row('net.fetch', o.fetch, 'through the engine, https only'), ...o.notes.map((n) => `<div class="list-row pv-m">${esc(n)}</div>`)].join('');
    let bytes = 0;
    try {
      bytes = (localStorage.getItem(`formext.store.${rec.id}`) ?? '').length;
    } catch {
      bytes = 0;
    }
    ui.storage.textContent = `${sizeText(bytes)} of 256 KB used by ${rec.id}`;
  }

  ui.perms.addEventListener('change', (ev) => {
    const box = ev.target as HTMLInputElement;
    const p = box.dataset.perm;
    if (!p) return;
    const off = new Set(offPerms());
    if (box.checked) off.delete(p);
    else off.add(p);
    setOffPerms([...off]);
    void reload('permissions changed');
  });

  function dockShow(id: string) {
    activePanel = id;
    for (const [pid, d] of docks) {
      d.tab.setAttribute('aria-selected', String(pid === id));
      d.body.hidden = pid !== id;
    }
    ui.dockEmpty.hidden = docks.size > 0;
  }

  function closeDock(id: string) {
    const d = docks.get(id);
    host?.closePanel(id);
    d?.tab.remove();
    d?.body.remove();
    docks.delete(id);
    if (activePanel === id) dockShow(docks.keys().next().value ?? '');
    ui.dockEmpty.hidden = docks.size > 0;
  }

  ui.dockTabs.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const close = t.closest<HTMLElement>('.pv-tab-close');
    const tab = t.closest<HTMLElement>('.pv-dtab');
    if (close && tab) closeDock(tab.dataset.panel as string);
    else if (tab) dockShow(tab.dataset.panel as string);
  });

  async function openPanel(panelId: string, command?: string) {
    const rec = effective();
    if (!rec || !host || !answer) return;
    const panel = rec.panels.find((p) => p.id === panelId);
    if (!panel) {
      ctx.notify(`${rec.name} has no panel ${panelId}`, 'error');
      return;
    }
    lastActivation = { panel: panelId };
    const title = `${rec.name}: ${panel.title}`;
    if (panel.location === 'dialog') {
      if (dialogPanel === panelId) {
        if (command) await host.openPanel(rec, panelId, ui.pbody, command);
        return;
      }
      if (dialogPanel) closeDialogPanel();
      if (!(await host.host.ensureConsent(rec))) {
        ctx.notify(`${rec.name} was not allowed to open; the row stays at Needs Permission.`, 'warning');
        renderState();
        return;
      }
      dialogPanel = panelId;
      ui.ptitle.textContent = title;
      ui.pbody.textContent = '';
      ui.poverlay.hidden = false;
      await host.openPanel(rec, panelId, ui.pbody, command);
      renderState();
      renderPermissions();
      return;
    }
    let d = docks.get(panelId);
    if (!d) {
      const tab = document.createElement('div');
      tab.className = 'pv-dtab';
      tab.dataset.panel = panelId;
      tab.setAttribute('role', 'tab');
      tab.innerHTML = `<span class="pv-dtab-title">${esc(title)}</span><button class="pv-tab-close" type="button" aria-label="Close ${esc(title)}">${icon('close', 12)}</button>`;
      const body = document.createElement('div');
      body.className = 'pv-dpanel';
      body.hidden = true;
      const frame = await host.openPanel(rec, panelId, body, command);
      if (!frame) {
        ctx.notify(`${rec.name} was not allowed to open; the row stays at Needs Permission.`, 'warning');
        renderState();
        return;
      }
      d = { tab, body, title };
      docks.set(panelId, d);
      ui.dockTabs.appendChild(tab);
      ui.dockBody.appendChild(body);
    } else if (command) {
      await host.openPanel(rec, panelId, d.body, command);
    }
    dockShow(panelId);
    renderState();
    renderPermissions();
  }

  async function runContributed(commandId: string) {
    const rec = effective();
    if (!rec || !host) return;
    const c = rec.commands.find((x) => x.id === commandId);
    if (!c) return;
    if (c.panel) {
      await openPanel(c.panel, c.id);
      return;
    }
    ctx.notify(`${rec.name}: ${c.title} is running headless`, 'info');
    try {
      const result = await host.runCommand(rec, c.id, ui.headless);
      ctx.notify(`${rec.name}: ${c.title} finished${result === undefined || result === null ? '' : ` with ${short(result, 80)}`}`, 'success');
    } catch (err) {
      ctx.notify(`${rec.name}: ${c.title}: ${(err as Error).message}`, 'error');
    }
    renderState();
    renderPermissions();
  }

  function closeDialogPanel() {
    if (!dialogPanel) return;
    host?.closePanel(dialogPanel);
    dialogPanel = '';
    ui.poverlay.hidden = true;
    ui.pbody.textContent = '';
  }
  q('.pv-pdialog .pv-dialog-close').addEventListener('click', closeDialogPanel);

  function teardown() {
    generation += 1;
    for (let i = 0; i < 20 && !ui.overlay.hidden; i++) ui.dialog.querySelector<HTMLButtonElement>('[data-v="no"], [data-v="cancel"]')?.click();
    closeDialogPanel();
    for (const id of [...docks.keys()]) closeDock(id);
    host?.dispose();
    ui.headless.textContent = '';
  }

  function stageTokens() {
    if (!host) return;
    const t = host.theme().tokens;
    for (const [k, v] of Object.entries({ '--sim-bg': t['--bg'], '--sim-panel': t['--panel'], '--sim-text': t['--text'], '--sim-muted': t['--muted'], '--sim-accent': t['--accent'], '--sim-border': t['--border'] })) ui.stage.style.setProperty(k, v ?? '');
    ui.stage.dataset.mode = host.mode;
  }

  function showEmpty(title: string, text: string, button: boolean) {
    ui.empty.hidden = false;
    ui.main.hidden = true;
    ui.emptyTitle.textContent = title;
    ui.emptyText.textContent = text;
    (q('.pv-open') as HTMLElement).hidden = !button;
  }

  async function reload(reason = '') {
    const p = project;
    const reopen = p && answer?.project === p.id ? [...docks.keys()] : [];
    teardown();
    const gen = generation;
    if (!p) {
      ui.sub.innerHTML = '&nbsp;';
      showEmpty('No project open', 'Open a project to run its extension in a simulated host.', true);
      return;
    }
    const manifestProduct = String(p.manifest?.product ?? p.product ?? '');
    const target = ui.as.dataset.chosen && ui.as.dataset.project === p.id ? ui.as.dataset.chosen : manifestProduct;
    const s = simFor(target);
    if (!s) {
      ui.sub.textContent = p.name;
      showEmpty(`${productName(manifestProduct) || 'This product'} is not a host app`, 'The preview runs extensions for the twelve Form apps that load them. Set the manifest product to one of them, or choose one under Simulate in.', false);
      ui.as.value = 'formvis';
      return;
    }
    ui.as.value = target;
    let a: Answer;
    try {
      a = await ctx.api.get<Answer>(`/api/preview/${encodeURIComponent(p.id)}?product=${encodeURIComponent(target)}&app=${encodeURIComponent(s.app)}&app_version=${encodeURIComponent(s.appVersion)}`);
    } catch (err) {
      if (gen !== generation) return;
      showEmpty('The preview could not read the project', errorMessage(err), false);
      return;
    }
    if (gen !== generation) return;
    ui.empty.hidden = true;
    ui.main.hidden = false;
    const keepState = host && sim === s ? host.state : null;
    const keepSteps = host && sim === s ? host.steps : null;
    answer = a;
    sim = s;
    host = new SimHost(s, {
      consent,
      openFiles,
      saveFile,
      fetch: fetchVia,
      notify: (rec, message, level) => ctx.notify(`${rec.name}: ${message}`, level as 'info'),
      setTitle: (frame, title) => {
        for (const [, d] of docks) if (d.body.contains(frame)) (d.tab.querySelector('.pv-dtab-title') as HTMLElement).textContent = title ? `${a.record.name}: ${title}` : d.title;
        if (ui.pbody.contains(frame) && title) ui.ptitle.textContent = `${a.record.name}: ${title}`;
      },
      resize: (frame, h) => {
        if (frame && ui.pbody.contains(frame)) frame.style.height = `${Math.min(h, 2000)}px`;
      },
      log: (entry, fresh) => log.add(entry, fresh),
      changed: () => renderDoc(),
    }, ui.mode.checked ? 'light' : 'dark');
    if (keepState) {
      host.state = keepState;
      host.steps = keepSteps ?? [];
    }
    ui.sub.innerHTML = `${esc(p.name)} <span class="pv-m">${esc(a.record.id)} ${esc(a.record.version)}</span> in ${esc(s.app)} ${esc(s.appVersion)}${target !== manifestProduct ? ' <span class="chip warning">not its product</span>' : ''}`;
    ui.appicon.innerHTML = appIcon(s.product);
    ui.app.textContent = `${productName(s.product)} ${s.appVersion}`;
    ui.docLabel.textContent = s.docLabel;
    ui.what.innerHTML = Object.keys(s.reads).map((w) => `<option value="${esc(w)}"${w === s.defaultRead ? ' selected' : ''}>${esc(w)}${w === s.defaultRead ? ' (default)' : ''}</option>`).join('');
    stageTokens();
    renderStrip();
    renderState();
    renderDoc();
    renderEvents();
    renderPermissions();
    if (reason) ctx.notify(`Preview reloaded (${reason})`, 'info');
    for (const id of reopen) if (a.record.panels.some((x) => x.id === id && x.location === 'dock')) await openPanel(id);
  }

  ui.reload.addEventListener('click', () => void reload('reloaded'));
  q('.pv-docs').addEventListener('click', () => ctx.openPane('docs', { doc: sim?.product ?? ui.as.value }));
  ui.auto.addEventListener('change', () => storage.set(AUTO_KEY, ui.auto.checked ? '1' : '0'));
  ui.mode.addEventListener('change', () => {
    storage.set(MODE_KEY, ui.mode.checked ? 'light' : 'dark');
    host?.setMode(ui.mode.checked ? 'light' : 'dark');
    stageTokens();
  });
  ui.as.addEventListener('change', () => {
    ui.as.dataset.chosen = ui.as.value;
    ui.as.dataset.project = project?.id ?? '';
    void reload();
  });
  q('.pv-open').addEventListener('click', () => void chooseProject());
  ui.undo.addEventListener('click', () => {
    const label = host?.undo();
    if (label) ctx.notify(`Undid ${label}`, 'info');
  });

  const filterLog = () => log.setFilter((q<HTMLInputElement>('.pv-log-filter')).value, { in: q('.pv-dir[data-dir="in"]').getAttribute('aria-pressed') === 'true', out: q('.pv-dir[data-dir="out"]').getAttribute('aria-pressed') === 'true' }, q('.pv-errs').getAttribute('aria-pressed') === 'true');
  q('.pv-log-filter').addEventListener('input', filterLog);
  for (const b of el.querySelectorAll<HTMLElement>('.pv-dir, .pv-errs'))
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      filterLog();
    });
  q('.pv-log-clear').addEventListener('click', () => log.clear());
  q('.pv-log-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log.all(), null, 2));
      ctx.notify('Message log copied as JSON', 'success');
    } catch {
      ctx.notify('The clipboard is not available here', 'warning');
    }
  });

  ui.evName.addEventListener('change', fillEvent);
  ui.evList.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('.pv-ev');
    if (!b) return;
    ui.evName.value = b.dataset.name as string;
    fillEvent();
  });
  q('.pv-ev-send').addEventListener('click', () => {
    if (!host) return;
    const name = ui.evName.value || ui.evCustom.value.trim();
    if (!name) {
      ctx.notify('Give the event a name', 'warning');
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(ui.evData.value || 'null');
    } catch (err) {
      ctx.notify(`The data is not JSON: ${(err as Error).message}`, 'error');
      return;
    }
    host.emit(name, data);
  });
  q('.pv-send-theme').addEventListener('click', () => host?.setMode(host.mode));
  q('.pv-send-activate').addEventListener('click', () => {
    const panel = activePanel || dialogPanel || lastActivation?.panel || '';
    if (!host || !host.reactivate(panel)) ctx.notify('Open a panel first', 'warning');
  });
  q('.pv-close-all').addEventListener('click', () => {
    for (const id of [...docks.keys()]) closeDock(id);
    closeDialogPanel();
  });

  ui.what.addEventListener('change', () => void renderDocument());
  q('.pv-doc-reset').addEventListener('click', () => {
    host?.reset();
    ctx.notify(`The ${sim?.docLabel.toLowerCase() ?? 'document'} is back to the sample`, 'info');
  });
  q('.pv-doc-edit').addEventListener('click', () => {
    if (!host) return;
    ui.docEditor.hidden = false;
    ui.docJson.hidden = true;
    ui.docErr.textContent = '';
    ui.docText.value = JSON.stringify(host.state, null, 2);
  });
  q('.pv-doc-cancel').addEventListener('click', () => {
    ui.docEditor.hidden = true;
    ui.docJson.hidden = false;
  });
  q('.pv-doc-apply').addEventListener('click', () => {
    if (!host) return;
    try {
      host.replace(JSON.parse(ui.docText.value));
      ui.docEditor.hidden = true;
      ui.docJson.hidden = false;
    } catch (err) {
      ui.docErr.textContent = (err as Error).message;
    }
  });

  q('.pv-allow').addEventListener('click', async () => {
    const rec = effective();
    if (!rec || !host) return;
    const grants = storage.json<Record<string, boolean>>('formext.grants', {});
    grants[`${rec.id}@${rec.version}#${[...rec.permissions].sort().join(',')}`] = true;
    storage.set('formext.grants', JSON.stringify(grants));
    renderPermissions();
    renderState();
  });
  q('.pv-revoke').addEventListener('click', () => {
    const rec = effective();
    if (!rec || !host) return;
    host.host.revoke(rec);
    renderPermissions();
    renderState();
    ctx.notify('Consent forgotten; the next open asks again. Open frames keep their permissions until they reload.', 'info');
  });
  q('.pv-storage-clear').addEventListener('click', () => {
    const rec = effective();
    if (!rec) return;
    storage.remove(`formext.store.${rec.id}`);
    renderPermissions();
  });

  let pending = 0;
  const offChange = ctx.events.on('project.changed', (d: { id?: string; paths?: string[] }) => {
    if (!project || d?.id !== project.id || !ui.auto.checked) return;
    window.clearTimeout(pending);
    pending = window.setTimeout(() => void reload('a file was saved'), 800);
  });
  const offProject = ctx.project.onChange((p) => {
    const changed = p?.id !== project?.id;
    project = p;
    if (changed) {
      delete ui.as.dataset.chosen;
      host = null;
      sim = null;
      log.clear();
    }
    void reload();
  });
  const offTheme = ctx.events.on('shell.theme', () => stageTokens());

  ctx.commands.register({ id: 'preview.reload', title: 'Preview: Reload the extension', run: () => reload('reloaded') });
  ctx.commands.register({ id: 'preview.undo', title: 'Preview: Undo the last simulated step', run: () => host?.undo() });

  project = ctx.project.current();
  void reload();

  return () => {
    offChange();
    offProject();
    offTheme();
    window.clearTimeout(pending);
    teardown();
  };
}

export const pane: PaneDef = { id: 'preview', title: 'Preview', icon: 'preview', order: 30, group: 'make', view: 'part', mount };
