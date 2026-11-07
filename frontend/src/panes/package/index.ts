import './package.css';
import { icon, esc, setText, productName, keyLabel, chooseProject, errorMessage, ApiError } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';

interface Sig { publisher: string; algorithm: string; value: string; signed_at?: number; fingerprint?: string }
interface Entry { path: string; size: number; packed: number; sha256: string }
interface Build {
  sha256: string; bytes: number; file: string; path: string; project: string; id: string; name: string; product: string; version: string;
  entries: Entry[]; built_at: number; last_built_at: number; times_built: number; reproduced_at?: number;
  check: Record<string, number>; signatures: Sig[]; fresh?: boolean; anyway?: boolean;
}
interface Run { how: string; sha256: string; bytes: number; command?: string }
interface Repro {
  project: string; reproducible: boolean; sha256: string; bytes: number; version: string; runs: Run[];
  differences: { path: string; first: string | null; second: string | null }[];
  matches_build: string | null; latest_build: string | null; source_changed: boolean; checked_at: number; ms: number;
}
interface Key { id: string; name: string; url: string; public_key: string; fingerprint: string; encrypted: boolean; created: number }
interface Problem { rule: string; severity: string; file: string; line: number; message: string }
interface EntryAnswer { entry: Record<string, unknown>; publishers: Record<string, unknown>[]; url_default: boolean }

const BUILD_KEYS = 'Mod+Shift+B';
const CONTRACT_RULES = new Set(['json', 'package', 'schema', 'host', 'missing-entry']);

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function when(t: number): string {
  return new Date(t * 1000).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.className = 'pk-copy-area';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function saveText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill pk-pane">
      <header class="pane-head">
        <span class="pk-mark">${icon('package', 18)}</span>
        <div class="pk-title"><h1>Package and Sign</h1><div class="sub pk-sub">&nbsp;</div></div>
        <div class="actions">
          <button class="btn pk-repro" type="button">${icon('refresh')}<span>Check Reproducibility</span></button>
          <button class="btn primary pk-build" type="button">${icon('package')}<span>Build Package</span><kbd>${keyLabel(BUILD_KEYS).join('+')}</kbd></button>
        </div>
      </header>
      <div class="pane-body pk-body">
        <div class="empty pk-none hidden">${icon('folder')}<h3>No project open</h3><p>Open a project to build its .formpkg, check that the build is reproducible and sign it with your publisher key.</p><div class="btn-group"><button class="btn pk-open" type="button">${icon('folder-open')}<span>Open Project</span></button></div></div>
        <div class="pk-grid">
          <div class="pk-main">
            <div class="notice pk-status info" role="status"><span class="pk-status-icon">${icon('info')}</span><div class="pk-status-body"><span class="pk-status-text">&nbsp;</span><ul class="pk-problems hidden"></ul><div class="btn-group pk-status-actions hidden"><button class="btn sm pk-to-check" type="button">${icon('checklist')}<span>Open Check</span></button><button class="btn sm pk-anyway" type="button">${icon('package')}<span>Package Anyway</span></button></div></div></div>

            <section class="section pk-current">
              <div class="section-title">Build</div>
              <div class="card pk-card">
                <div class="pk-card-empty"><span>${icon('package', 22)}</span><p>No build yet. Build Package runs Check, then packs the package folder with the contract kit's deterministic rules (sorted entries, 1980-01-01 timestamps, mode 0644, deflate).</p></div>
                <div class="pk-card-body hidden">
                  <div class="pk-file-row"><span class="pk-file-icon">${icon('package', 18)}</span><div class="pk-file-text"><div class="pk-file">&nbsp;</div><div class="pk-file-meta">&nbsp;</div></div><div class="btn-group"><a class="btn sm pk-download" download>${icon('download')}<span>Download</span></a><button class="btn sm primary pk-sign" type="button">${icon('signature')}<span>Sign</span></button><button class="btn sm ghost icon pk-delete" type="button" title="Delete this build">${icon('trash')}</button></div></div>
                  <dl class="pk-facts">
                    <dt>SHA-256</dt><dd><code class="pk-sha">&nbsp;</code><button class="btn ghost icon sm pk-copy-sha" type="button" title="Copy SHA-256">${icon('copy')}</button></dd>
                    <dt>Size</dt><dd class="pk-size">&nbsp;</dd>
                    <dt>Check</dt><dd class="pk-check">&nbsp;</dd>
                    <dt>Signed</dt><dd class="pk-signed">&nbsp;</dd>
                  </dl>
                  <details class="pk-entries"><summary>Files in the package</summary><table class="table"><thead><tr><th>Path</th><th>Size</th><th>Packed</th><th>SHA-256</th></tr></thead><tbody></tbody></table></details>
                </div>
              </div>
            </section>

            <section class="section pk-repro-section">
              <div class="section-title">Reproducibility</div>
              <div class="card pk-repro-card">
                <p class="pk-repro-text">Builds the folder again in the engine and with the kit's own command line (tools/formpkg.py) and compares the bytes. Anyone with the same folder gets the same SHA-256.</p>
                <table class="table pk-runs hidden"><thead><tr><th>Run</th><th>SHA-256</th><th>Size</th></tr></thead><tbody></tbody></table>
              </div>
            </section>

            <section class="section pk-entry-section">
              <div class="section-title">Index entry</div>
              <div class="card pk-entry-card">
                <div class="pk-entry-fields">
                  <div class="field pk-url-field"><label for="pk-url">Package address</label><input class="input pk-url" id="pk-url" type="url" placeholder="https://formai.studio/extensions/packages/id-version.formpkg" spellcheck="false" /></div>
                  <div class="field pk-pub-field"><label for="pk-pub">Signature</label><select class="select pk-pub" id="pk-pub"><option value="">Unsigned</option></select></div>
                </div>
                <pre class="code-block pk-entry">{ }</pre>
                <div class="btn-group"><button class="btn sm pk-copy-entry" type="button">${icon('copy')}<span>Copy Entry</span></button><button class="btn sm ghost pk-copy-pub" type="button">${icon('key')}<span>Copy Publisher</span></button><span class="pk-entry-note">&nbsp;</span></div>
              </div>
            </section>

            <section class="section pk-history">
              <div class="section-title">All builds <span class="badge pk-history-count">0</span></div>
              <div class="card pk-history-card"><ul class="list divided pk-builds"></ul><p class="pk-builds-empty">Builds of this project appear here, newest first. The same folder always gives the same build.</p></div>
            </section>
          </div>

          <aside class="pk-side">
            <section class="section">
              <div class="pk-side-head"><div class="section-title">Publisher keys</div><button class="btn sm pk-new-key" type="button">${icon('plus')}<span>New Key</span></button></div>
              <div class="card pk-keys-card">
                <ul class="list divided pk-keys"></ul>
                <p class="pk-keys-empty">No publisher key yet. A key is an Ed25519 pair kept in form.ext's data folder; its public half goes in the index's publishers list, and FormPortal checks every signed package against it.</p>
              </div>
              <p class="pk-side-note">FormPortal verifies the signature over the .formpkg file's exact bytes with the publisher's public key from the index, so sign the build you publish and do not rebuild it afterwards with different files.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>`;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const sub = q('.pk-sub');
  const buildBtn = q<HTMLButtonElement>('.pk-build');
  const reproBtn = q<HTMLButtonElement>('.pk-repro');
  const none = q('.pk-none');
  const grid = q('.pk-grid');
  const status = q('.pk-status');
  const statusIcon = q('.pk-status-icon');
  const statusText = q('.pk-status-text');
  const problemsEl = q('.pk-problems');
  const statusActions = q('.pk-status-actions');
  const anywayBtn = q<HTMLButtonElement>('.pk-anyway');
  const cardEmpty = q('.pk-card-empty');
  const cardBody = q('.pk-card-body');
  const fileEl = q('.pk-file');
  const fileMeta = q('.pk-file-meta');
  const download = q<HTMLAnchorElement>('.pk-download');
  const signBtn = q<HTMLButtonElement>('.pk-sign');
  const shaEl = q('.pk-sha');
  const sizeEl = q('.pk-size');
  const checkEl = q('.pk-check');
  const signedEl = q('.pk-signed');
  const entriesBody = q('.pk-entries tbody');
  const reproText = q('.pk-repro-text');
  const runsTable = q('.pk-runs');
  const runsBody = q('.pk-runs tbody');
  const urlInput = q<HTMLInputElement>('.pk-url');
  const pubSelect = q<HTMLSelectElement>('.pk-pub');
  const entryEl = q('.pk-entry');
  const entryNote = q('.pk-entry-note');
  const buildsEl = q('.pk-builds');
  const buildsEmpty = q('.pk-builds-empty');
  const historyCount = q('.pk-history-count');
  const keysEl = q('.pk-keys');
  const keysEmpty = q('.pk-keys-empty');

  let builds: Build[] = [];
  let keys: Key[] = [];
  let selected = '';
  let repro: Repro | null = null;
  let busy = '';
  let entry: EntryAnswer | null = null;
  let entrySeq = 0;
  let statusKey = '';
  const urls = new Map<string, string>();

  function current(): Build | null {
    return builds.find((b) => b.sha256 === selected) ?? builds[0] ?? null;
  }

  function setStatus(level: 'info' | 'success' | 'warning' | 'error', text: string, spin = false): void {
    const k = spin ? 'busy' : level;
    if (statusKey !== k) {
      status.className = `notice pk-status ${level}`;
      statusIcon.innerHTML = spin ? '<span class="spinner"></span>' : icon(level);
      statusKey = k;
    }
    setText(statusText, text);
  }

  function showProblems(list: Problem[], canForce: boolean): void {
    problemsEl.innerHTML = list.slice(0, 6).map((p) => `<li><span class="chip">${esc(p.rule)}</span><span>${esc(p.message)}</span><span class="pk-where">${esc(p.file)}${p.line ? `:${p.line}` : ''}</span></li>`).join('') + (list.length > 6 ? `<li class="pk-more">and ${list.length - 6} more in Check</li>` : '');
    problemsEl.classList.toggle('hidden', list.length === 0);
    statusActions.classList.toggle('hidden', list.length === 0);
    anywayBtn.classList.toggle('hidden', !canForce);
  }

  function renderHead(): void {
    const p = ctx.project.current();
    none.classList.toggle('hidden', !!p);
    grid.classList.toggle('hidden', !p);
    buildBtn.disabled = !p || !!busy;
    reproBtn.disabled = !p || !!busy;
    if (!p) {
      setText(sub, 'No project open');
      return;
    }
    const version = String(p.manifest?.version ?? '');
    setText(sub, `${p.name} · ${productName(p.product) || p.product || 'no product'}${version ? ` · ${version}` : ''}`);
  }

  function renderCard(): void {
    const b = current();
    cardEmpty.classList.toggle('hidden', !!b);
    cardBody.classList.toggle('hidden', !b);
    if (!b) return;
    setText(fileEl, b.file);
    setText(fileMeta, `${b.name} ${b.version} for ${productName(b.product) || b.product} · built ${when(b.last_built_at)}${b.times_built > 1 ? ` · same bytes ${b.times_built} times` : ''}`);
    const href = `/api/projects/${encodeURIComponent(b.project)}/builds/${b.sha256}/file`;
    if (download.getAttribute('href') !== href) download.setAttribute('href', href);
    download.setAttribute('download', b.file);
    setText(shaEl, b.sha256);
    setText(sizeEl, `${sizeText(b.bytes)} (${b.bytes} bytes) · ${plural(b.entries.length, 'file')}`);
    const c = b.check || {};
    setText(checkEl, c.error ? `${plural(c.error, 'code error')}, packaged anyway` : c.warning ? `no errors, ${plural(c.warning, 'warning')}` : 'no errors or warnings');
    checkEl.dataset.level = c.error ? 'error' : c.warning ? 'warning' : 'success';
    signedEl.innerHTML = b.signatures.length
      ? b.signatures.map((s) => `<span class="chip success" title="${esc(s.value)}">${icon('signature', 12)}${esc(s.publisher)}</span>`).join(' ')
      : '<span class="pk-faint">Not signed</span>';
    const rows = b.entries.map((e) => `<tr><td><code>${esc(e.path)}</code></td><td>${sizeText(e.size)}</td><td>${sizeText(e.packed)}</td><td><code class="pk-faint">${e.sha256.slice(0, 16)}</code></td></tr>`).join('');
    if (entriesBody.dataset.sha !== b.sha256) {
      entriesBody.innerHTML = rows;
      entriesBody.dataset.sha = b.sha256;
    }
  }

  function renderRepro(): void {
    const p = ctx.project.current();
    if (busy === 'repro') {
      setText(reproText, 'Building twice and comparing...');
      return;
    }
    if (!repro || !p || repro.project !== p.id) {
      runsTable.classList.add('hidden');
      reproText.className = 'pk-repro-text';
      setText(reproText, 'Builds the folder again in the engine and with the kit\'s own command line (tools/formpkg.py) and compares the bytes. Anyone with the same folder gets the same SHA-256.');
      return;
    }
    const r = repro;
    reproText.className = `pk-repro-text ${r.reproducible ? 'ok' : 'bad'}`;
    let text = r.reproducible
      ? `Reproducible: ${plural(r.runs.length, 'independent build')} gave the same ${r.bytes} bytes (${r.ms} ms).`
      : `Not reproducible: the builds differ in ${plural(r.differences.length, 'entry', 'entries')}.`;
    if (r.reproducible && r.matches_build) text += ' It matches the stored build of this version.';
    else if (r.reproducible && r.source_changed) text += ' The folder has changed since the last build of this version; build again before you sign.';
    else if (r.reproducible && !r.latest_build) text += ' No stored build of this version yet.';
    setText(reproText, text);
    runsTable.classList.remove('hidden');
    runsBody.innerHTML = r.runs.map((run) => `<tr><td>${esc(run.how)}${run.command ? `<div class="pk-faint pk-cmd">${esc(run.command)}</div>` : ''}</td><td><code class="${run.sha256 === r.sha256 ? '' : 'pk-bad'}">${esc(run.sha256)}</code></td><td>${run.bytes}</td></tr>`).join('')
      + r.differences.map((d) => `<tr class="pk-diff"><td colspan="3">${icon('warning', 12)} <code>${esc(d.path)}</code> differs</td></tr>`).join('');
  }

  function renderBuilds(): void {
    setText(historyCount, String(builds.length));
    buildsEmpty.classList.toggle('hidden', builds.length > 0);
    const cur = current();
    const keep = new Set(builds.map((b) => b.sha256));
    for (const row of [...buildsEl.children] as HTMLElement[]) if (!keep.has(row.dataset.sha || '')) row.remove();
    builds.forEach((b, i) => {
      let row = buildsEl.querySelector<HTMLElement>(`[data-sha="${b.sha256}"]`);
      if (!row) {
        row = document.createElement('li');
        row.className = 'list-row interactive pk-build-row';
        row.dataset.sha = b.sha256;
        row.tabIndex = 0;
        row.innerHTML = `<span class="pk-row-icon">${icon('package', 14)}</span><span class="pk-row-main"><span class="pk-row-title"></span><code class="pk-row-sha"></code></span><span class="pk-row-sigs"></span><span class="meta pk-row-meta"></span>`;
        const pick = () => {
          selected = b.sha256;
          renderAll();
        };
        row.addEventListener('click', pick);
        row.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            pick();
          }
        });
      }
      if (buildsEl.children[i] !== row) buildsEl.insertBefore(row, buildsEl.children[i] ?? null);
      setText(row.querySelector('.pk-row-title'), `${b.version}`);
      setText(row.querySelector('.pk-row-sha'), b.sha256.slice(0, 16));
      const sigs = b.signatures.map((s) => s.publisher).join(', ');
      const sigEl = row.querySelector<HTMLElement>('.pk-row-sigs')!;
      const sigHtml = sigs ? `<span class="chip success">${icon('signature', 12)}${esc(sigs)}</span>` : '';
      if (sigEl.dataset.v !== sigs) {
        sigEl.innerHTML = sigHtml;
        sigEl.dataset.v = sigs;
      }
      setText(row.querySelector('.pk-row-meta'), `${sizeText(b.bytes)} · ${when(b.last_built_at)}`);
      row.setAttribute('aria-selected', String(cur?.sha256 === b.sha256));
    });
  }

  function renderKeys(): void {
    keysEmpty.classList.toggle('hidden', keys.length > 0);
    keysEl.innerHTML = keys.map((k) => `<li class="list-row pk-key" data-id="${esc(k.id)}">
      <span class="pk-key-icon">${icon(k.encrypted ? 'lock' : 'key', 14)}</span>
      <span class="pk-key-main"><span class="pk-key-name">${esc(k.name)} <span class="pk-faint">${esc(k.id)}</span></span><code class="pk-key-fp" title="${esc(k.public_key)}">${esc(k.fingerprint)}</code></span>
      <span class="btn-group"><button class="btn ghost icon sm pk-key-copy" type="button" title="Copy the publisher record">${icon('copy')}</button><button class="btn ghost icon sm pk-key-export" type="button" title="Save the public key">${icon('download')}</button><button class="btn ghost icon sm pk-key-del" type="button" title="Delete this key">${icon('trash')}</button></span>
    </li>`).join('');
    const prev = pubSelect.value;
    const signed = current()?.signatures.map((s) => s.publisher) ?? [];
    pubSelect.innerHTML = `<option value="">Unsigned</option>${signed.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join('')}`;
    pubSelect.value = signed.includes(prev) ? prev : signed[signed.length - 1] ?? '';
  }

  function renderEntry(): void {
    const b = current();
    const p = ctx.project.current();
    if (!b || !p) {
      setText(entryEl, 'Build the package to get its index entry.');
      setText(entryNote, '');
      return;
    }
    const seq = ++entrySeq;
    const url = urlInput.value.trim();
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (pubSelect.value) params.set('publisher', pubSelect.value);
    ctx.api.get<EntryAnswer>(`/api/projects/${encodeURIComponent(p.id)}/builds/${b.sha256}/entry?${params}`).then((ans) => {
      if (seq !== entrySeq) return;
      entry = ans;
      setText(entryEl, JSON.stringify(ans.entry, null, 2));
      setText(entryNote, ans.entry.signature ? 'With the signature block; add the publisher to the index once.' : ans.url_default ? 'Default formai.studio address; change it to where the file will live.' : '');
    }).catch((err) => {
      if (seq !== entrySeq) return;
      entry = null;
      setText(entryEl, errorMessage(err));
    });
  }

  function renderAll(): void {
    renderHead();
    renderCard();
    renderRepro();
    renderBuilds();
    renderKeys();
    renderEntry();
  }

  async function loadBuilds(): Promise<void> {
    const p = ctx.project.current();
    if (!p) {
      builds = [];
      return;
    }
    const ans = await ctx.api.get<{ builds: Build[] }>(`/api/projects/${encodeURIComponent(p.id)}/builds`);
    if (ctx.project.current()?.id !== p.id) return;
    builds = ans.builds;
    if (!builds.some((b) => b.sha256 === selected)) selected = builds[0]?.sha256 ?? '';
  }

  async function loadKeys(): Promise<void> {
    keys = (await ctx.api.get<{ keys: Key[] }>('/api/keys')).keys;
  }

  async function refresh(): Promise<void> {
    try {
      await Promise.all([loadBuilds(), loadKeys()]);
    } catch (err) {
      setStatus('error', `Could not read the builds: ${errorMessage(err)}`);
    }
    renderAll();
  }

  function idleStatus(): void {
    const p = ctx.project.current();
    if (!p) return setStatus('info', 'Open a project to package it.');
    const b = current();
    if (!b) setStatus('info', 'Build Package checks the project, then packs it the way the contract kit does.');
    else if (b.signatures.length) setStatus('success', `${b.file} is built and signed by ${b.signatures.map((s) => s.publisher).join(', ')}.`);
    else setStatus('info', `${b.file} is built. Sign it with a publisher key before you publish it.`);
  }

  async function build(anyway = false): Promise<void> {
    const p = ctx.project.current();
    if (!p || busy) return;
    busy = 'build';
    renderHead();
    showProblems([], false);
    setStatus('info', 'Checking and building...', true);
    try {
      const b = await ctx.api.post<Build & { warnings: Problem[] }>(`/api/projects/${encodeURIComponent(p.id)}/package`, { anyway });
      busy = '';
      selected = b.sha256;
      await loadBuilds();
      renderAll();
      const warn = b.warnings?.length ?? 0;
      setStatus(warn ? 'warning' : 'success', `${b.fresh ? 'Built' : 'Built again, same bytes:'} ${b.file}, ${sizeText(b.bytes)}, SHA-256 ${b.sha256.slice(0, 16)}...${warn ? ` Check reported ${plural(warn, 'problem')}.` : ''}`);
      if (warn) showProblems(b.warnings, false);
      ctx.notify(`Built ${b.file}`, 'success');
    } catch (err) {
      busy = '';
      renderHead();
      const body = err instanceof ApiError ? (err.detail as { check?: { problems: Problem[] } } | null) : null;
      const errors = (body?.check?.problems ?? []).filter((x) => x.severity === 'error');
      setStatus('error', errorMessage(err));
      showProblems(errors, errors.length > 0 && !errors.some((x) => CONTRACT_RULES.has(x.rule)));
    }
  }

  async function reproduce(): Promise<void> {
    const p = ctx.project.current();
    if (!p || busy) return;
    busy = 'repro';
    renderHead();
    renderRepro();
    try {
      repro = await ctx.api.post<Repro>(`/api/projects/${encodeURIComponent(p.id)}/package/reproduce`);
      busy = '';
      await loadBuilds();
      renderAll();
      ctx.notify(repro.reproducible ? 'The build is reproducible' : 'The builds differ', repro.reproducible ? 'success' : 'error');
    } catch (err) {
      busy = '';
      repro = null;
      renderAll();
      setText(reproText, `Could not build: ${errorMessage(err)}`);
      reproText.className = 'pk-repro-text bad';
    }
  }

  async function newKey(): Promise<Key | null> {
    const author = String(ctx.project.current()?.manifest?.author ?? '');
    const suggested = author.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 39);
    const data = await ctx.dialog.form('New Publisher Key', `
      <div class="pk-form" data-ok="Create Key">
        <div class="field"><label for="pk-k-id">Publisher id</label><input class="input" id="pk-k-id" name="id" required pattern="[a-z0-9][a-z0-9\\-]{1,38}" value="${esc(suggested)}" spellcheck="false" /><span class="hint">2 to 39 lower-case letters, digits and hyphens; the index and every signature name it.</span></div>
        <div class="field"><label for="pk-k-name">Name</label><input class="input" id="pk-k-name" name="name" required value="${esc(author)}" /><span class="hint">FormPortal shows it when a signature does not match.</span></div>
        <div class="field"><label for="pk-k-url">Address (optional)</label><input class="input" id="pk-k-url" name="url" type="url" pattern="https://.*" placeholder="https://" /></div>
        <div class="field"><label for="pk-k-pass">Passphrase (optional)</label><input class="input" id="pk-k-pass" name="passphrase" type="password" minlength="8" autocomplete="new-password" /><span class="hint">Encrypts the private key in the data folder; you give it each time you sign. form.ext cannot recover it.</span></div>
      </div>`);
    if (!data) return null;
    try {
      const k = await ctx.api.post<Key>('/api/keys', { id: data.get('id'), name: data.get('name'), url: data.get('url'), passphrase: data.get('passphrase') });
      await loadKeys();
      renderAll();
      ctx.notify(`Created the publisher key ${k.id}`, 'success');
      return k;
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
      return null;
    }
  }

  async function sign(): Promise<void> {
    const p = ctx.project.current();
    const b = current();
    if (!p || !b) return;
    if (!keys.length && !(await newKey())) return;
    const options = keys.map((k) => `<option value="${esc(k.id)}" data-locked="${k.encrypted}">${esc(k.name)} (${esc(k.id)})${k.encrypted ? ', protected' : ''}</option>`).join('');
    const anyLocked = keys.some((k) => k.encrypted);
    const data = await ctx.dialog.form(`Sign ${b.file}`, `
      <div class="pk-form" data-ok="Sign">
        <div class="field"><label for="pk-s-key">Publisher key</label><select class="select" id="pk-s-key" name="key">${options}</select></div>
        ${anyLocked ? '<div class="field"><label for="pk-s-pass">Passphrase</label><input class="input" id="pk-s-pass" name="passphrase" type="password" autocomplete="current-password" /><span class="hint">Only for a protected key.</span></div>' : ''}
        <p class="pk-form-note">Signs the exact bytes of this build (SHA-256 <code>${b.sha256.slice(0, 16)}</code>) with Ed25519. The index entry then carries <code>signature: { publisher, algorithm: "ed25519", value }</code>.</p>
      </div>`);
    if (!data) return;
    busy = 'sign';
    renderHead();
    setStatus('info', 'Signing...', true);
    try {
      const ans = await ctx.api.post<{ signature: Sig; verified: boolean }>(`/api/projects/${encodeURIComponent(p.id)}/builds/${b.sha256}/sign`, { key: data.get('key'), passphrase: data.get('passphrase') ?? '' });
      busy = '';
      await loadBuilds();
      pubSelect.value = ans.signature.publisher;
      renderAll();
      pubSelect.value = ans.signature.publisher;
      renderEntry();
      setStatus('success', `Signed by ${ans.signature.publisher} and verified the way FormPortal checks it.`);
      ctx.notify(`Signed ${b.file}`, 'success');
    } catch (err) {
      busy = '';
      renderHead();
      setStatus('error', `Not signed: ${errorMessage(err)}`);
    }
  }

  async function removeBuild(): Promise<void> {
    const p = ctx.project.current();
    const b = current();
    if (!p || !b) return;
    if (!(await ctx.dialog.confirm('Delete this build?', `${b.file} (${b.sha256.slice(0, 16)}) and its signatures are removed from form.ext's builds folder. Building the same folder again gives the same bytes, but it needs signing again.`, 'Delete Build'))) return;
    try {
      await ctx.api.del(`/api/projects/${encodeURIComponent(p.id)}/builds/${b.sha256}`);
      selected = '';
      await loadBuilds();
      renderAll();
      idleStatus();
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    }
  }

  async function keyAction(ev: Event): Promise<void> {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    const row = btn?.closest<HTMLElement>('.pk-key');
    if (!btn || !row) return;
    const id = row.dataset.id!;
    try {
      if (btn.classList.contains('pk-key-del')) {
        if (!(await ctx.dialog.confirm(`Delete the key ${id}?`, 'The key file moves to form.ext\'s trash folder. Packages signed with it stay valid for anyone who has its public key, but you cannot sign new ones with it.', 'Delete Key'))) return;
        await ctx.api.del(`/api/keys/${encodeURIComponent(id)}`);
        await loadKeys();
        renderAll();
        return;
      }
      const ans = await ctx.api.get<{ publisher: Record<string, unknown> }>(`/api/keys/${encodeURIComponent(id)}/public`);
      const text = JSON.stringify(ans.publisher, null, 2);
      if (btn.classList.contains('pk-key-copy')) ctx.notify((await copy(text)) ? `Copied the publisher record of ${id}` : 'Could not copy', 'success');
      else saveText(`${id}.publisher.json`, `${text}\n`);
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    }
  }

  buildBtn.addEventListener('click', () => void build());
  anywayBtn.addEventListener('click', () => void build(true));
  q('.pk-to-check').addEventListener('click', () => ctx.openPane('check', { run: true }));
  reproBtn.addEventListener('click', () => void reproduce());
  signBtn.addEventListener('click', () => void sign());
  q('.pk-delete').addEventListener('click', () => void removeBuild());
  q('.pk-new-key').addEventListener('click', () => void newKey());
  q('.pk-open').addEventListener('click', () => void chooseProject());
  keysEl.addEventListener('click', (ev) => void keyAction(ev));
  q('.pk-copy-sha').addEventListener('click', async () => {
    const b = current();
    if (b) ctx.notify((await copy(b.sha256)) ? 'Copied the SHA-256' : 'Could not copy', 'success');
  });
  q('.pk-copy-entry').addEventListener('click', async () => {
    if (entry) ctx.notify((await copy(JSON.stringify(entry.entry, null, 2))) ? 'Copied the index entry' : 'Could not copy', 'success');
  });
  q('.pk-copy-pub').addEventListener('click', async () => {
    const pubs = entry?.publishers ?? [];
    if (!pubs.length) return ctx.notify('Sign the build first; the publisher record comes with the signature.', 'info');
    ctx.notify((await copy(JSON.stringify(pubs[0], null, 2))) ? 'Copied the publisher record' : 'Could not copy', 'success');
  });
  let urlTimer = 0;
  urlInput.addEventListener('input', () => {
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(renderEntry, 300);
  });
  pubSelect.addEventListener('change', renderEntry);

  ctx.commands.register({ id: 'package.build', title: 'Build Package', keys: BUILD_KEYS, run: () => { ctx.openPane('package'); return build(); } });
  ctx.commands.register({ id: 'package.reproduce', title: 'Check Package Reproducibility', run: () => { ctx.openPane('package'); return reproduce(); } });
  ctx.commands.register({ id: 'package.sign', title: 'Sign Package', run: () => { ctx.openPane('package'); return sign(); } });
  ctx.commands.register({ id: 'package.new-key', title: 'New Publisher Key', run: () => newKey() });

  const mine = (d: { id?: string }) => !!d?.id && d.id === ctx.project.current()?.id;
  const offs = [
    ctx.project.onChange((p: ProjectRef | null) => {
      if (repro && (!p || repro.project !== p.id)) repro = null;
      selected = '';
      if (p && !urls.has(p.id)) urls.set(p.id, '');
      urlInput.value = p ? urls.get(p.id) ?? '' : '';
      showProblems([], false);
      void refresh().then(idleStatus);
    }),
    ctx.events.on('package.built', (d) => { if (mine(d) && !busy) void refresh(); }),
    ctx.events.on('package.signed', (d) => { if (mine(d) && !busy) void refresh(); }),
    ctx.events.on('package.removed', (d) => { if (mine(d) && !busy) void refresh(); }),
    ctx.events.on('keys.changed', () => { if (!busy) void refresh(); }),
  ];
  urlInput.addEventListener('change', () => {
    const p = ctx.project.current();
    if (p) urls.set(p.id, urlInput.value.trim());
  });

  renderAll();
  idleStatus();
  void refresh().then(idleStatus);

  return () => {
    window.clearTimeout(urlTimer);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = {
  id: 'package',
  title: 'Package',
  icon: 'package',
  order: 20,
  group: 'ship',
  mount,
};
