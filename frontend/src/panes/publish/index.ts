import './publish.css';
import { icon, esc, setText, appIcon, productName, storage, chooseProject, errorMessage, ApiError } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';

interface Key { id: string; name: string; fingerprint: string; encrypted: boolean; public_key: string }
interface Submission {
  folder: string;
  files: string[];
  sha256: string;
  bytes: number;
  package: string;
  url: string;
  url_default: boolean;
  signed_by: string | null;
  prepared_at: number;
  entry: Record<string, unknown>;
  publishers: { id: string; name: string; public_key: string }[];
  stale: boolean;
  warnings?: { message: string }[];
}
interface Status {
  project: string;
  manifest: Record<string, unknown>;
  default_url: string;
  keys: Key[];
  publisher: string;
  submission: Submission | null;
  submissions_dir: string;
}
interface Sent { method: string; opened?: string; note?: string | null; cli_error?: string | null; installed?: { name?: string; version?: string } | null }

const NO_SIGN = '';
const PLAIN: Record<string, string> = {
  document: 'read and change the open document',
  'files-read': 'open files you choose',
  'files-write': 'save files where you choose',
  network: 'reach the internet',
  models: 'use local models',
  'native-code': 'run native code',
};

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill publish-pane">
      <header class="pane-head">
        <span class="publish-mark">${icon('publish', 18)}</span>
        <div class="publish-title">
          <h1>Publish</h1>
          <div class="sub publish-sub">&nbsp;</div>
        </div>
        <div class="actions">
          <button class="btn primary publish-prepare" type="button" disabled>${icon('package')}<span>Prepare Submission</span></button>
        </div>
      </header>
      <div class="pane-body publish-body">
        <div class="empty publish-none hidden">${icon('folder')}<h3>No project open</h3><p>Open a project to make its entry for the extension index and a submission folder for formai.studio.</p><div class="btn-group"><button class="btn publish-choose" type="button">${icon('folder-open')}<span>Open Project</span></button></div></div>
        <div class="publish-main">
          <div class="notice publish-status info" role="status"><span class="publish-status-icon">${icon('info')}</span><span class="publish-status-text">&nbsp;</span></div>
          <section class="section">
            <div class="section-title">Index entry</div>
            <div class="publish-form">
              <div class="field publish-url-field">
                <label for="publish-url">Package address</label>
                <input id="publish-url" class="input code publish-url" type="url" spellcheck="false" autocomplete="off" placeholder="https://" />
                <span class="hint">Where formai.studio will serve the package. It must start with https://; leave it empty for the site's usual address.</span>
              </div>
              <div class="field publish-key-field">
                <label for="publish-key">Sign with</label>
                <select id="publish-key" class="select publish-key"><option value="">Do not sign</option></select>
                <span class="hint publish-key-hint">&nbsp;</span>
              </div>
            </div>
          </section>
          <section class="section">
            <div class="section-title">Submission folder</div>
            <div class="card publish-card">
              <div class="publish-head-row">
                <span class="publish-app-icon">${appIcon('formportal', true)}</span>
                <div class="publish-app-text"><div class="publish-name">&nbsp;</div><div class="publish-meta">&nbsp;</div></div>
              </div>
              <dl class="publish-facts">
                <dt>Signature</dt><dd><span class="chip publish-sign-chip">&nbsp;</span></dd>
                <dt>Folder</dt><dd><code class="publish-folder">&nbsp;</code></dd>
                <dt>Files</dt><dd class="publish-files">&nbsp;</dd>
                <dt>SHA-256</dt><dd><code class="publish-sha">&nbsp;</code></dd>
                <dt>Address</dt><dd><code class="publish-addr">&nbsp;</code></dd>
                <dt>May</dt><dd class="publish-perms">&nbsp;</dd>
              </dl>
              <div class="btn-group publish-actions">
                <button class="btn publish-reveal" type="button" disabled>${icon('folder-open')}<span>Open Folder</span></button>
                <button class="btn publish-copy" type="button" disabled>${icon('copy')}<span>Copy Entry</span></button>
                <button class="btn publish-send" type="button" disabled title="Install this package with FormPortal">${icon('hub')}<span>Send to FormPortal</span></button>
              </div>
            </div>
          </section>
          <section class="section">
            <div class="section-title">entry.json</div>
            <pre class="code-block publish-json">&nbsp;</pre>
          </section>
        </div>
      </div>
    </div>`;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const sub = q('.publish-sub');
  const prepareBtn = q<HTMLButtonElement>('.publish-prepare');
  const none = q('.publish-none');
  const main = q('.publish-main');
  const status = q('.publish-status');
  const statusIcon = q('.publish-status-icon');
  const statusText = q('.publish-status-text');
  const urlInput = q<HTMLInputElement>('.publish-url');
  const keySelect = q<HTMLSelectElement>('.publish-key');
  const keyHint = q('.publish-key-hint');
  const appIconEl = q('.publish-app-icon');
  const nameEl = q('.publish-name');
  const metaEl = q('.publish-meta');
  const signChip = q('.publish-sign-chip');
  const folderEl = q('.publish-folder');
  const filesEl = q('.publish-files');
  const shaEl = q('.publish-sha');
  const addrEl = q('.publish-addr');
  const permsEl = q('.publish-perms');
  const revealBtn = q<HTMLButtonElement>('.publish-reveal');
  const copyBtn = q<HTMLButtonElement>('.publish-copy');
  const sendBtn = q<HTMLButtonElement>('.publish-send');
  const jsonEl = q('.publish-json');

  let state: Status | null = null;
  let busy = false;
  let level = '';
  let iconProduct = 'formportal';
  let keySig = '';

  function setStatus(kind: 'info' | 'success' | 'warning' | 'error', text: string): void {
    if (level !== kind) {
      status.className = `notice publish-status ${kind}`;
      statusIcon.innerHTML = icon(kind === 'success' ? 'success' : kind);
      level = kind;
    }
    setText(statusText, text);
  }

  function urlKey(id: string): string {
    return `formext.publish.url.${id}`;
  }

  function keyKey(id: string): string {
    return `formext.publish.key.${id}`;
  }

  function renderKeys(s: Status): void {
    const sig = JSON.stringify(s.keys.map((k) => [k.id, k.name, k.encrypted]));
    if (sig !== keySig) {
      keySig = sig;
      keySelect.innerHTML = `<option value="${NO_SIGN}">Do not sign</option>${s.keys.map((k) => `<option value="${esc(k.id)}">${esc(k.name)} (${esc(k.id)})${k.encrypted ? ', protected' : ''}</option>`).join('')}`;
    }
    const remembered = storage.get(keyKey(s.project));
    const wanted = remembered !== null ? remembered : s.keys.find((k) => k.id === s.publisher)?.id ?? s.keys[s.keys.length - 1]?.id ?? NO_SIGN;
    keySelect.value = s.keys.some((k) => k.id === wanted) ? wanted : NO_SIGN;
    keySelect.disabled = busy || !s.keys.length;
    const chosen = s.keys.find((k) => k.id === keySelect.value);
    setText(keyHint, !s.keys.length ? 'No publisher key yet: make one in Package to sign. Unsigned script extensions still install.' : chosen ? `Fingerprint ${chosen.fingerprint}. The entry carries the Ed25519 signature and the folder's extensions.json lists the public key.` : 'The entry goes without a signature.');
  }

  function render(): void {
    const project = ctx.project.current();
    none.classList.toggle('hidden', !!project);
    main.classList.toggle('hidden', !project);
    prepareBtn.disabled = busy || !project || !state;
    if (!project) {
      setText(sub, 'No project open');
      return;
    }
    setText(sub, `${project.name} · ${productName(project.product) || project.product || 'no app'}`);
    const s = state && state.project === project.id ? state : null;
    if (!s) return;
    renderKeys(s);
    urlInput.placeholder = s.default_url;
    urlInput.disabled = busy;
    const m = s.manifest;
    const product = String(m.product || 'formportal');
    if (iconProduct !== product) {
      iconProduct = product;
      appIconEl.innerHTML = appIcon(product, true);
    }
    const sb = s.submission;
    setText(nameEl, `${m.name ?? s.project} ${m.version ?? ''}`.trim());
    setText(metaEl, `${productName(product)} · ${m.kind ?? 'no kind'} · ${m.licence ?? 'no licence'} · by ${m.author ?? 'nobody'}`);
    const perms = (Array.isArray(m.permissions) ? m.permissions : []) as string[];
    setText(permsEl, perms.length ? perms.map((p) => PLAIN[p] ?? p).join('; ') : 'nothing beyond its own panel');
    revealBtn.disabled = busy || !sb;
    copyBtn.disabled = busy || !sb;
    sendBtn.disabled = busy || !sb;
    if (!sb) {
      signChip.className = 'chip publish-sign-chip';
      setText(signChip, 'Not prepared');
      setText(folderEl, `${s.submissions_dir}/${m.id}-${m.version}`);
      setText(filesEl, 'package, entry.json, extensions.json, README.md');
      setText(shaEl, 'made when you prepare');
      setText(addrEl, urlInput.value.trim() || s.default_url);
      setText(jsonEl, 'Prepare the submission to see the entry.');
      if (!busy) setStatus('info', 'Prepare builds the package (the same source always gives the same SHA-256), signs it when you choose a key, writes its index entry and puts both with a README in a folder for formai.studio.');
      return;
    }
    signChip.className = `chip publish-sign-chip ${sb.signed_by ? 'success' : ''}`;
    setText(signChip, sb.signed_by ? `Signed by ${sb.signed_by}` : 'Unsigned');
    setText(folderEl, sb.folder);
    setText(filesEl, sb.files.join(', '));
    setText(shaEl, `${sb.sha256} (${sizeText(sb.bytes)})`);
    setText(addrEl, sb.url);
    setText(jsonEl, JSON.stringify(sb.entry, null, 2));
    if (busy) return;
    if (sb.stale) setStatus('warning', 'The project has a newer build than this submission. Prepare again so the entry matches the package you mean to publish.');
    else setStatus('success', `Ready for formai.studio, prepared ${new Date(sb.prepared_at * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. The entry passes extensions.schema.json${sb.signed_by ? ' and its signature verifies' : ''}.`);
  }

  async function load(): Promise<void> {
    const project = ctx.project.current();
    if (!project) {
      state = null;
      render();
      return;
    }
    try {
      const s = await ctx.api.get<Status>(`/api/publish/${encodeURIComponent(project.id)}`);
      if (ctx.project.current()?.id !== project.id) return;
      if (!state || state.project !== s.project) urlInput.value = storage.get(urlKey(s.project)) ?? '';
      state = s;
      render();
    } catch (err) {
      setStatus('error', `Publish could not read the project: ${errorMessage(err)}`);
    }
  }

  async function askPassphrase(kid: string): Promise<string | null> {
    const data = await ctx.dialog.form(`Unlock ${kid}`, `<div class="field"><label for="publish-pass">Passphrase of the key ${esc(kid)}</label><input id="publish-pass" class="input" name="passphrase" type="password" required minlength="8" autocomplete="off" /></div><span data-ok="Sign"></span>`);
    return data ? String(data.get('passphrase') ?? '') : null;
  }

  async function prepare(): Promise<void> {
    const project = ctx.project.current();
    if (!project || busy) return;
    const url = urlInput.value.trim();
    if (url && !/^https:\/\//.test(url)) {
      setStatus('error', 'The package address must start with https://.');
      urlInput.setAttribute('aria-invalid', 'true');
      urlInput.focus();
      return;
    }
    urlInput.removeAttribute('aria-invalid');
    const kid = keySelect.value;
    const key = state?.keys.find((k) => k.id === kid);
    let passphrase = '';
    if (key?.encrypted) {
      const given = await askPassphrase(kid);
      if (given === null) return;
      passphrase = given;
    }
    busy = true;
    setStatus('info', 'Building, checking and writing the submission...');
    render();
    try {
      const sb = await ctx.api.post<Submission>(`/api/publish/${encodeURIComponent(project.id)}`, { url, publisher: kid, sign: !!kid, passphrase });
      if (state) state = { ...state, submission: sb };
      ctx.notify(`Submission ready: ${sb.folder}`, 'success');
      busy = false;
      await load();
      if (sb.warnings?.length) setStatus('warning', `Ready, with ${sb.warnings.length} warning${sb.warnings.length === 1 ? '' : 's'} from Check: ${sb.warnings.map((w) => w.message).slice(0, 2).join('; ')}`);
    } catch (err) {
      busy = false;
      render();
      const text = errorMessage(err);
      if (err instanceof ApiError && err.status === 422 && /Check found/.test(text)) setStatus('error', text);
      else setStatus('error', `Not prepared: ${text}`);
    }
  }

  async function act(fn: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try {
      await fn();
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    } finally {
      busy = false;
      render();
    }
  }

  prepareBtn.addEventListener('click', () => void prepare());
  urlInput.addEventListener('change', () => {
    const p = ctx.project.current();
    if (p) storage.set(urlKey(p.id), urlInput.value.trim());
    urlInput.removeAttribute('aria-invalid');
    if (state && !state.submission) setText(addrEl, urlInput.value.trim() || state.default_url);
  });
  keySelect.addEventListener('change', () => {
    const p = ctx.project.current();
    if (p) storage.set(keyKey(p.id), keySelect.value);
    if (state) renderKeys(state);
  });
  revealBtn.addEventListener('click', () => void act(async () => {
    await ctx.api.post(`/api/publish/${encodeURIComponent(ctx.project.current()!.id)}/reveal`);
  }));
  copyBtn.addEventListener('click', () => void act(async () => {
    await navigator.clipboard.writeText(JSON.stringify(state?.submission?.entry ?? {}, null, 2));
    ctx.notify('The index entry is on the clipboard.', 'success');
  }));
  sendBtn.addEventListener('click', () => void act(async () => {
    const r = await ctx.api.post<Sent>(`/api/publish/${encodeURIComponent(ctx.project.current()!.id)}/send`);
    if (r.method === 'cli') ctx.notify(`FormPortal installed ${r.installed?.name ?? 'the package'}${r.installed?.version ? ` ${r.installed.version}` : ''}.${r.note ? ` ${r.note}` : ''}`, 'success');
    else ctx.notify(`Opened the package with ${r.opened}; FormPortal asks before it installs it.`, 'info');
  }));
  q('.publish-choose').addEventListener('click', () => void chooseProject());

  ctx.commands.register({ id: 'publish.prepare', title: 'Prepare Submission for formai.studio', run: () => { ctx.openPane('publish'); return prepare(); } });

  const offs = [
    ctx.project.onChange((_p: ProjectRef | null) => {
      state = null;
      render();
      void load();
    }),
    ctx.events.on('keys.changed', () => void load()),
    ctx.events.on('package.built', (d: { id?: string }) => {
      if (d?.id === ctx.project.current()?.id && !busy) void load();
    }),
    ctx.events.on('package.signed', (d: { id?: string }) => {
      if (d?.id === ctx.project.current()?.id && !busy) void load();
    }),
    ctx.events.on('pane.open', (d: { id?: string }) => {
      if (d?.id === 'publish' && !busy) void load();
    }),
  ];

  render();
  void load();

  return () => {
    for (const off of offs) off();
  };
}

export const pane: PaneDef = {
  id: 'publish',
  title: 'Publish',
  icon: 'publish',
  order: 30,
  group: 'ship',
  mount,
};
