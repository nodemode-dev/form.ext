import './library.css';
import { icon, appIcon, productName, esc, setText, storage, errorMessage, chooseProject, ApiError } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';

type Tab = 'examples' | 'inspect' | 'compare';

interface Perm { id: string; words: string }
interface Issue { file: string; message: string; kit?: boolean }
interface FileRow { path: string; size: number; packed: number; sha256: string | null; type: string; ok: boolean; problem?: string }
interface CheckProblem { rule: string; severity: 'error' | 'warning' | 'info'; file: string; line: number; message: string; fix: string }
interface Contrib { id: string; title: string; location?: string; panel?: string }
interface Summary {
  id: string; name: string; product: string; kind: string; version: string; author: string; licence: string; api: string; native: boolean;
  minimum_app?: string; description: string; homepage: string; entry: string | null; panels: Contrib[]; commands: Contrib[]; permissions: Perm[];
}
interface Report {
  sha256: string; bytes: number; name: string | null; ok: boolean; can_import: boolean; kit_refuses: boolean; product: string | null;
  errors: Issue[]; warnings: Issue[]; files: FileRow[]; summary: Summary | null; manifest: Record<string, unknown> | null;
  check: { ok: boolean; counts: Record<string, number>; problems: CheckProblem[] } | null;
  rebuild: { ok: boolean; sha256: string | null; same?: boolean; reason: string } | null;
  known: { kind: string; project: string; name?: string }[];
  source?: { kind: string; repo?: string; repo_name?: string; project?: string; path?: string; signed_by?: string | null; index_verified?: boolean; version?: string };
  ms: number;
}
interface RegEntry {
  id: string; name: string; product: string; version: string; kind: string; author: string; licence: string; description: string;
  permissions: Perm[]; verified: boolean; listed_verified: boolean; source: string; registry_commit: string | null; url: string;
  sha256: string; bytes: number | null; signed_by: string | null; imported: string[];
}
interface Shelf {
  url: string; url_source: string; name: string; verified: boolean; key: string | null; keys: number; note: string; offline: string | null;
  fetched_at: number; sha256: string; registry_commit: string | null; publishers: { id: string; name: string }[]; extensions: RegEntry[];
  error?: { detail: string; problem: string; status: number };
}
interface Build { sha256: string; version: string; bytes: number; built_at: number; last_built_at: number; signatures?: unknown[] }
interface Side { kind: string; sha256: string | null; bytes: number; version: string; label: string }
interface FileChange { path: string; change: 'added' | 'removed' | 'changed' | 'same'; before: number | null; after: number | null; text: boolean; lines?: { added: number; removed: number } }
interface Comparison {
  a: Side; b: Side; identical: boolean; version: { before: string; after: string; changed: boolean };
  permissions: { added: Perm[]; removed: Perm[]; kept: Perm[] }; consent_again: boolean;
  manifest: { path: string; change: string; before: unknown; after: unknown }[]; files: FileChange[]; counts: Record<string, number>;
}
interface Hunk { a_start: number; a_lines: number; b_start: number; b_lines: number; lines: { t: ' ' | '+' | '-'; a: number | null; b: number | null; s: string }[] }
interface ImportResult { project: { id: string; name: string }; report: Report }

type Source =
  | { kind: 'upload'; name: string; data: ArrayBuffer }
  | { kind: 'path'; path: string }
  | { kind: 'registry'; id: string }
  | { kind: 'build'; project: string; sha: string };

const TAB_KEY = 'formext.library.tab';
const WORKING = 'current';
const TABS: { id: Tab; label: string; glyph: string }[] = [
  { id: 'examples', label: 'Registry', glyph: 'star' },
  { id: 'inspect', label: 'Inspect and Import', glyph: 'search' },
  { id: 'compare', label: 'Compare Builds', glyph: 'layers' },
];

function size(bytes: number | null | undefined): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function when(seconds?: number | null): string {
  return seconds ? new Date(seconds * 1000).toLocaleString() : '';
}

function value(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function openExternal(href: string): void {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (w.__TAURI_INTERNALS__) {
    import('@tauri-apps/api/core').then((m) => m.invoke('plugin:shell|open', { path: href })).catch(() => window.open(href, '_blank', 'noopener'));
  } else window.open(href, '_blank', 'noopener');
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill library-pane">
      <header class="pane-head">
        <span class="lib-mark">${icon('library', 18)}</span>
        <div class="lib-title"><h1>Library</h1><div class="sub">Import, inspect and compare packages, and start from the registry's verified extensions.</div></div>
        <div class="actions">
          <button class="btn lib-choose-top" type="button">${icon('import')}<span>Import .formpkg</span></button>
        </div>
      </header>
      <div class="tabs lib-tabs" role="tablist">
        ${TABS.map((t) => `<button class="tab" type="button" role="tab" data-tab="${t.id}" aria-selected="false">${icon(t.glyph)}<span>${t.label}</span></button>`).join('')}
      </div>
      <input class="lib-file hidden" type="file" accept=".formpkg,.zip,application/zip" />
      <div class="pane-body lib-body">
        <section class="lib-panel" data-panel="examples">
          <p class="lib-lead">The extensions registered in form.ext-registry, the Form family's registry. form.ext downloads its signed index, checks the signature with the registry's key, and checks each package's SHA-256 and publisher signature before it imports it. Import one to read how it uses its app's API, preview it, or start your own from it.</p>
          <div class="lib-reg-bar">
            <div class="notice lib-reg-status info" role="status"><span class="lib-reg-icon"><span class="spinner"></span></span><span class="lib-reg-text">Reading the registry index...</span></div>
            <button class="btn ghost sm lib-reg-refresh" type="button" title="Download the index again">${icon('refresh')}<span>Refresh</span></button>
          </div>
          <div class="grid-cards lib-examples" aria-busy="true">${Array.from({ length: 4 }, () => '<div class="card lib-skel"></div>').join('')}</div>
          <div class="empty lib-examples-none hidden">${icon('library')}<h3 class="lib-none-title">No extensions in the registry index</h3><p class="lib-examples-folders">&nbsp;</p></div>
        </section>

        <section class="lib-panel" data-panel="inspect">
          <div class="lib-drop" tabindex="0">
            <span class="lib-drop-icon">${icon('package', 22)}</span>
            <div class="lib-drop-text"><strong>Drop a .formpkg here</strong><span>or choose one. form.ext reads it without installing anything, runs the kit's checks and Check, and shows what it asks for.</span></div>
            <div class="lib-drop-actions">
              <button class="btn primary lib-choose" type="button">${icon('folder-open')}<span>Choose File</span></button>
            </div>
            <form class="lib-path-form">
              <input class="input code lib-path" name="path" placeholder="/path/to/extension-0.1.0.formpkg" autocomplete="off" spellcheck="false" aria-label="Package path" />
              <button class="btn" type="submit">${icon('search')}<span>Inspect Path</span></button>
            </form>
          </div>
          <div class="lib-report hidden">
            <div class="card lib-head">
              <span class="lib-head-icon"></span>
              <div class="lib-head-text"><h2 class="lib-name">&nbsp;</h2><div class="lib-idline">&nbsp;</div><p class="lib-desc">&nbsp;</p></div>
              <div class="lib-head-actions">
                <button class="btn primary lib-import" type="button">${icon('import')}<span>Import as Project</span></button>
                <button class="btn ghost sm lib-repo hidden" type="button">${icon('external')}<span class="lib-repo-name">&nbsp;</span></button>
              </div>
            </div>
            <div class="notice lib-verdict"><span class="lib-verdict-icon">${icon('info')}</span><span class="lib-verdict-text">&nbsp;</span></div>
            <div class="lib-cols">
              <section class="section lib-perms-sec"><span class="section-title">Asks for</span><ul class="list lib-perms"></ul></section>
              <section class="section"><span class="section-title">Adds to the app</span><ul class="list lib-contrib"></ul></section>
              <section class="section"><span class="section-title">Package</span><dl class="lib-facts"></dl></section>
            </div>
            <section class="section lib-issues-sec"><span class="section-title">Problems</span><ul class="list lib-issues"></ul></section>
            <section class="section lib-check-sec"><span class="section-title">Check findings <span class="lib-check-counts"></span></span><p class="lib-note">Check is form.ext's lint. Its findings do not stop an import; they are what to fix before you package it again.</p><ul class="list lib-check"></ul></section>
            <section class="section"><span class="section-title">Files</span><table class="table lib-files"><thead><tr><th>Path</th><th class="num">Size</th><th class="num">Packed</th><th>SHA-256</th></tr></thead><tbody></tbody></table></section>
          </div>
        </section>

        <section class="lib-panel" data-panel="compare">
          <div class="empty lib-compare-none hidden">${icon('folder')}<h3>No project open</h3><p>Open a project to compare two of its builds, or a build with the files as they are now.</p><div class="btn-group"><button class="btn lib-open" type="button">${icon('folder-open')}<span>Open Project</span></button></div></div>
          <div class="lib-compare hidden">
            <div class="lib-pick">
              <div class="field"><label for="lib-a">From</label><select class="select lib-a" id="lib-a"></select></div>
              <span class="lib-pick-arrow">${icon('chevron-right')}</span>
              <div class="field"><label for="lib-b">To</label><select class="select lib-b" id="lib-b"></select></div>
              <div class="btn-group lib-pick-actions">
                <button class="btn ghost sm lib-swap" type="button">${icon('transcode')}<span>Swap</span></button>
                <button class="btn ghost sm lib-inspect-build" type="button">${icon('search')}<span>Inspect From</span></button>
              </div>
            </div>
            <div class="notice lib-cmp-status"><span class="lib-cmp-icon">${icon('info')}</span><span class="lib-cmp-text">&nbsp;</span></div>
            <div class="lib-cmp-body hidden">
              <div class="lib-cmp-chips"></div>
              <section class="section lib-cmp-perm-sec"><span class="section-title">Permissions</span><ul class="list lib-cmp-perms"></ul></section>
              <section class="section lib-cmp-man-sec"><span class="section-title">Manifest</span><table class="table lib-cmp-man"><thead><tr><th>Field</th><th>From</th><th>To</th></tr></thead><tbody></tbody></table></section>
              <section class="section"><span class="section-title">Files</span><div class="lib-cmp-files"></div></section>
            </div>
          </div>
        </section>
      </div>
    </div>`;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const tabBtns = [...el.querySelectorAll<HTMLButtonElement>('.lib-tabs .tab')];
  const panels = [...el.querySelectorAll<HTMLElement>('.lib-panel')];
  const fileInput = q<HTMLInputElement>('.lib-file');
  const drop = q('.lib-drop');
  const pathInput = q<HTMLInputElement>('.lib-path');
  const reportEl = q('.lib-report');
  const exGrid = q('.lib-examples');
  const exNone = q('.lib-examples-none');
  const selA = q<HTMLSelectElement>('.lib-a');
  const selB = q<HTMLSelectElement>('.lib-b');
  const cmpStatus = q('.lib-cmp-status');
  const cmpBody = q('.lib-cmp-body');
  const cmpFiles = q('.lib-cmp-files');

  let tab: Tab = (storage.get(TAB_KEY) as Tab) || 'examples';
  if (!TABS.some((t) => t.id === tab)) tab = 'examples';
  let source: Source | null = null;
  let report: Report | null = null;
  let examplesLoaded = false;
  let examples: RegEntry[] = [];
  let builds: Build[] = [];
  let buildsFor = '';
  let comparison: Comparison | null = null;
  let cmpToken = 0;
  let inspectToken = 0;
  let busy = false;

  function setTab(next: Tab): void {
    tab = next;
    storage.set(TAB_KEY, next);
    for (const b of tabBtns) b.setAttribute('aria-selected', String(b.dataset.tab === next));
    for (const p of panels) p.classList.toggle('hidden', p.dataset.panel !== next);
    if (next === 'examples' && !examplesLoaded) loadExamples();
    if (next === 'compare') loadBuilds();
  }

  function notice(target: HTMLElement, level: 'info' | 'success' | 'warning' | 'error', text: string, spinning = false): void {
    target.className = target.className.replace(/\b(info|success|warning|error)\b/g, '').trim() + ` ${level}`;
    const ic = target.firstElementChild as HTMLElement;
    const html = spinning ? '<span class="spinner"></span>' : icon(level);
    if (ic.dataset.state !== (spinning ? 'busy' : level)) {
      ic.innerHTML = html;
      ic.dataset.state = spinning ? 'busy' : level;
    }
    setText(target.lastElementChild, text);
  }

  async function loadExamples(refresh = false): Promise<void> {
    const status = q('.lib-reg-status');
    const refreshBtn = q<HTMLButtonElement>('.lib-reg-refresh');
    refreshBtn.disabled = true;
    if (refresh) notice(status, 'info', 'Downloading the registry index again...', true);
    try {
      const r = await ctx.api.get<Shelf>(`/api/library/registry${refresh ? '?refresh=1' : ''}`);
      if (r.error) {
        regFailed(r.error.problem, r.error.detail);
        return;
      }
      examples = r.extensions;
      examplesLoaded = true;
      exNone.classList.toggle('hidden', examples.length > 0);
      exGrid.classList.toggle('hidden', examples.length === 0);
      setText(q('.lib-none-title'), 'No extensions in the registry index');
      setText(q('.lib-examples-folders'), `The index at ${r.url} lists none yet.`);
      const when = new Date(r.fetched_at * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const trust = r.verified && r.key ? `signature verified with registry key ${r.key}` : r.note || 'signature not checked';
      const commit = r.registry_commit ? ` · registry commit ${r.registry_commit.slice(0, 10)}` : '';
      const text = `${plural(examples.length, 'extension')} from ${r.url}: ${trust}${commit}, read ${when}.${r.offline ? ` Offline: the copy kept on this computer (${r.offline})` : ''}`;
      notice(status, r.verified && !r.offline ? 'success' : 'warning', text);
      const html = examples.map(exampleCard).join('');
      if (exGrid.innerHTML !== html) exGrid.innerHTML = html;
    } catch (err) {
      regFailed(err instanceof ApiError ? (err.detail as { problem?: string } | null)?.problem : undefined, errorMessage(err));
    } finally {
      refreshBtn.disabled = false;
      exGrid.removeAttribute('aria-busy');
    }
  }

  function regFailed(problem: string | undefined, message: string): void {
    examples = [];
    exGrid.classList.add('hidden');
    exNone.classList.remove('hidden');
    const titles: Record<string, string> = { 'no-key': 'This build trusts no registry key yet', private: 'The registry is private or not published yet', unreachable: 'The registry is unreachable', signature: 'Signature mismatch' };
    setText(q('.lib-none-title'), titles[problem ?? ''] ?? 'The registry index could not be read');
    setText(q('.lib-examples-folders'), message);
    notice(q('.lib-reg-status'), 'error', message);
  }

  function exampleCard(x: RegEntry): string {
    const perms = x.permissions.map((p) => `<span class="chip" title="${esc(p.id)}">${esc(p.words)}</span>`).join('');
    const done = x.imported.length;
    const mark = x.verified
      ? `<span class="chip success lib-verified" title="Listed by form.ext-registry in an index whose signature verified${x.signed_by ? `; package signed by ${esc(x.signed_by)}` : ''}">${icon('shield')}Verified</span>`
      : `<span class="chip warning" title="The index signature was not checked">${icon('warning')}Not verified</span>`;
    return `<article class="card lib-ex" data-key="${esc(x.id)}">
      <div class="lib-ex-head">${appIcon(x.product)}<div class="lib-ex-title"><strong>${esc(x.name)}</strong><span>${esc(productName(x.product))} · ${esc(x.version)}${x.bytes ? ` · ${esc(size(x.bytes))}` : ''}</span></div>${mark}</div>
      <p class="lib-ex-desc">${esc(x.description)}</p>
      <div class="lib-ex-perms">${perms || '<span class="chip">Asks for nothing</span>'}</div>
      <a class="lib-ex-repo" href="${esc(x.source)}" data-external="1" target="_blank" rel="noopener noreferrer" title="Source in form.ext-registry">${icon('link')}<span>form.ext-registry/extensions/${esc(x.id)}</span></a>
      <div class="lib-ex-actions">
        <button class="btn sm" type="button" data-ex-inspect>${icon('search')}<span>Inspect</span></button>
        ${done ? `<button class="btn sm" type="button" data-ex-open="${esc(x.imported[0])}">${icon('folder-open')}<span>Open Project</span></button>` : ''}
        <button class="btn ${done ? 'ghost' : 'primary'} sm" type="button" data-ex-import>${icon('import')}<span>${done ? 'Import Again' : 'Import'}</span></button>
      </div>
    </article>`;
  }

  function verdict(r: Report): { level: 'success' | 'warning' | 'error'; text: string } {
    const name = r.summary?.name ?? r.name ?? 'This package';
    if (!r.can_import) {
      const first = r.errors.find((e) => !e.kit) ?? r.errors[0];
      return { level: 'error', text: `${name} cannot be imported: ${first ? first.message : 'it has no readable manifest.json'}. Nothing was unpacked outside a temporary folder.` };
    }
    if (r.kit_refuses) return { level: 'warning', text: `The kit's formpkg refuses ${name} (${plural(r.errors.length, 'problem')} below), so no Form app would load it. You can still import it to fix it.` };
    const rebuilt = r.rebuild?.ok ? (r.rebuild.same ? ' Packing it again gives the same SHA-256 byte for byte.' : ' Packing it again gives a different SHA-256 (it was not made by the kit\'s build).') : '';
    const src = r.source;
    const from = src?.kind === 'registry' ? ` Downloaded from form.ext-registry: its SHA-256 matches the ${src.index_verified ? 'signed ' : ''}index${src.signed_by ? ` and its signature verifies with publisher ${src.signed_by}'s key` : ''}.` : '';
    return { level: r.warnings.length ? 'warning' : 'success', text: `${name} passes the kit's checks: safe paths, allowed file types, no symlinks, valid manifest.${rebuilt}${from}` };
  }

  function renderReport(r: Report): void {
    report = r;
    reportEl.classList.remove('hidden');
    const s = r.summary;
    q('.lib-head-icon').innerHTML = s?.product ? appIcon(s.product, true) : `<span class="app-icon lg">${icon('package')}</span>`;
    setText(q('.lib-name'), s?.name || r.name || 'Unnamed package');
    setText(q('.lib-idline'), s ? `${s.id ?? '?'} · ${s.version ?? '?'} · for ${productName(String(s.product ?? '')) || s.product || '?'}` : r.name ?? '');
    setText(q('.lib-desc'), s?.description || '');
    const imp = q<HTMLButtonElement>('.lib-import');
    imp.disabled = !r.can_import;
    imp.classList.toggle('primary', r.can_import && !r.kit_refuses);
    setText(imp.querySelector('span'), r.kit_refuses && r.can_import ? 'Import Anyway' : 'Import as Project');
    const repoBtn = q<HTMLButtonElement>('.lib-repo');
    const repo = r.source?.repo;
    repoBtn.classList.toggle('hidden', !repo);
    repoBtn.dataset.href = repo ?? '';
    setText(q('.lib-repo-name'), r.source?.repo_name ?? '');
    const v = verdict(r);
    notice(q('.lib-verdict'), v.level, v.text);

    const perms = s?.permissions ?? [];
    q('.lib-perms').innerHTML = perms.length
      ? perms.map((p) => `<li class="list-row lib-perm">${icon(p.id === 'native-code' ? 'warning' : 'shield')}<span><strong>${esc(p.words)}</strong><code>${esc(p.id)}</code></span></li>`).join('')
      : `<li class="list-row"><span class="lib-muted">Nothing: it cannot read the document or touch files.</span></li>`;
    const contrib = [
      ...(s?.panels ?? []).map((p) => `<li class="list-row">${icon('panel')}<span><strong>${esc(p.title)}</strong><span class="lib-muted">${p.location === 'dialog' ? 'dialog panel' : 'docked panel'} · ${esc(p.id)}</span></span></li>`),
      ...(s?.commands ?? []).map((c) => `<li class="list-row">${icon('command')}<span><strong>${esc(c.title)}</strong><span class="lib-muted">${c.panel ? `opens ${esc(c.panel)}` : 'runs without a panel'} · ${esc(c.id)}</span></span></li>`),
    ];
    q('.lib-contrib').innerHTML = contrib.join('') || '<li class="list-row"><span class="lib-muted">No panels or commands.</span></li>';
    const facts: [string, string][] = [
      ['SHA-256', r.sha256],
      ['Size', `${size(r.bytes)} packed · ${plural(r.files.length, 'file')}`],
      ['Kind', String(s?.kind ?? '')],
      ['Author', String(s?.author ?? '')],
      ['Licence', String(s?.licence ?? '')],
      ['API', s?.api ? String(s.api) : 'not set'],
      ['Needs', s?.minimum_app ? `${productName(String(s.product))} ${s.minimum_app} or newer` : 'any version'],
      ['Entry', s?.entry ?? 'none'],
      ['Rebuild', r.rebuild ? (r.rebuild.ok ? (r.rebuild.same ? 'same bytes' : `differs: ${String(r.rebuild.sha256).slice(0, 12)}`) : r.rebuild.reason) : 'not tried'],
    ];
    if (r.known.length) facts.push(['Seen here', r.known.map((k) => (k.kind === 'build' ? `built in ${k.project}` : `imported as ${k.project}`)).join(', ')]);
    q('.lib-facts').innerHTML = facts.map(([k, val]) => `<dt>${esc(k)}</dt><dd${k === 'SHA-256' ? ' class="lib-sha"' : ''}>${esc(val)}${k === 'SHA-256' ? ` <button class="btn ghost icon sm lib-copy" type="button" title="Copy SHA-256" aria-label="Copy SHA-256">${icon('copy')}</button>` : ''}</dd>`).join('');

    const issues = [...r.errors.map((e) => ({ ...e, level: 'error' })), ...r.warnings.map((e) => ({ ...e, level: 'warning' }))];
    q('.lib-issues-sec').classList.toggle('hidden', issues.length === 0);
    q('.lib-issues').innerHTML = issues.map((e) => `<li class="list-row lib-issue ${e.level}">${icon(e.level)}<span>${e.file ? `<code>${esc(e.file)}</code> ` : ''}${esc(e.message)}${e.kit ? ' <span class="chip">kit</span>' : ''}</span></li>`).join('');

    const ch = r.check;
    q('.lib-check-sec').classList.toggle('hidden', !ch);
    if (ch) {
      setText(q('.lib-check-counts'), ch.problems.length ? `(${plural(ch.counts.error ?? 0, 'error')}, ${plural(ch.counts.warning ?? 0, 'warning')})` : '(none)');
      q('.lib-check').innerHTML = ch.problems.length
        ? ch.problems.map((p) => `<li class="list-row lib-issue ${p.severity}">${icon(p.severity)}<span><code>${esc(p.file)}${p.line ? `:${p.line}` : ''}</code> ${esc(p.message)} <span class="chip">${esc(p.rule)}</span></span></li>`).join('')
        : `<li class="list-row lib-issue success">${icon('success')}<span>Check finds nothing to fix.</span></li>`;
    }
    q('.lib-files tbody').innerHTML = r.files
      .map((f) => `<tr class="${f.ok ? '' : 'lib-bad'}"><td><code>${esc(f.path)}</code>${f.problem ? `<div class="lib-muted">${esc(f.problem)}</div>` : ''}</td><td class="num">${esc(size(f.size))}</td><td class="num">${esc(size(f.packed))}</td><td><code class="lib-hash" title="${esc(f.sha256 ?? '')}">${esc(f.sha256 ? f.sha256.slice(0, 16) : '')}</code></td></tr>`)
      .join('');
  }

  async function inspect(src: Source): Promise<void> {
    const token = ++inspectToken;
    setTab('inspect');
    source = src;
    reportEl.classList.remove('hidden');
    notice(q('.lib-verdict'), 'info', 'Reading the package...', true);
    try {
      let r: Report;
      if (src.kind === 'upload') r = await ctx.api.post<Report>(`/api/library/inspect?name=${encodeURIComponent(src.name)}`, src.data);
      else if (src.kind === 'path') r = await ctx.api.post<Report>('/api/library/inspect', { path: src.path });
      else if (src.kind === 'registry') r = await ctx.api.get<Report>(`/api/library/registry/${encodeURIComponent(src.id)}`);
      else r = await ctx.api.get<Report>(`/api/library/builds/${encodeURIComponent(src.project)}/${src.sha}`);
      if (token === inspectToken) renderReport(r);
    } catch (err) {
      if (token !== inspectToken) return;
      const detail = err instanceof ApiError ? (err.detail as { report?: Report } | null) : null;
      if (detail?.report) renderReport(detail.report);
      else {
        report = null;
        q<HTMLButtonElement>('.lib-import').disabled = true;
        notice(q('.lib-verdict'), 'error', errorMessage(err));
      }
    }
  }

  async function runImport(src: Source, anyway: boolean): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      let r: ImportResult;
      const body = { anyway };
      if (src.kind === 'upload') r = await ctx.api.post<ImportResult>(`/api/library/import?name=${encodeURIComponent(src.name)}${anyway ? '&anyway=1' : ''}`, src.data);
      else if (src.kind === 'path') r = await ctx.api.post<ImportResult>('/api/library/import', { path: src.path, anyway });
      else if (src.kind === 'registry') r = await ctx.api.post<ImportResult>(`/api/library/registry/${encodeURIComponent(src.id)}/import`, body);
      else r = await ctx.api.post<ImportResult>(`/api/library/builds/${encodeURIComponent(src.project)}/${src.sha}/import`, body);
      ctx.notify(`Imported ${r.project.name} as project ${r.project.id}`, 'success');
      examplesLoaded = false;
      if (tab === 'examples') loadExamples();
      await ctx.project.open(r.project.id);
      ctx.openPane('edit', { path: 'package/manifest.json', from: 'library' });
    } catch (err) {
      const detail = err instanceof ApiError ? (err.detail as { report?: Report } | null) : null;
      if (detail?.report && detail.report.kit_refuses && detail.report.can_import && !anyway) {
        if (src.kind !== 'registry' || tab === 'inspect') renderReport(detail.report);
        busy = false;
        const ok = await ctx.dialog.confirm('Import anyway?', `${errorMessage(err)} No Form app would load it as it is; form.ext opens it so you can fix the manifest.`, 'Import Anyway');
        if (ok) await runImport(src, true);
        return;
      }
      if (detail?.report) {
        source = src;
        setTab('inspect');
        renderReport(detail.report);
      }
      ctx.notify(errorMessage(err), 'error');
    } finally {
      busy = false;
    }
  }

  async function takeFile(file: File | null | undefined): Promise<void> {
    if (!file) return;
    const data = await file.arrayBuffer();
    await inspect({ kind: 'upload', name: file.name, data });
  }

  function choose(): void {
    setTab('inspect');
    fileInput.value = '';
    fileInput.click();
  }

  function sideLabel(ref: string): string {
    if (ref === WORKING) return 'Current files';
    const b = builds.find((x) => x.sha256 === ref);
    return b ? `${b.version} · ${ref.slice(0, 10)} · ${when(b.built_at)}` : ref.slice(0, 10);
  }

  function fillSelect(sel: HTMLSelectElement, refs: string[], chosen: string): void {
    const html = refs.map((r) => `<option value="${esc(r)}"${r === chosen ? ' selected' : ''}>${esc(sideLabel(r))}</option>`).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    sel.value = chosen;
  }

  async function loadBuilds(): Promise<void> {
    const p = ctx.project.current();
    q('.lib-compare-none').classList.toggle('hidden', !!p);
    q('.lib-compare').classList.toggle('hidden', !p);
    if (!p) return;
    try {
      const r = await ctx.api.get<{ builds: Build[] }>(`/api/projects/${encodeURIComponent(p.id)}/builds`);
      if (ctx.project.current()?.id !== p.id) return;
      const fresh = buildsFor !== p.id;
      builds = r.builds;
      buildsFor = p.id;
      const refs = [...builds.map((b) => b.sha256), WORKING];
      let a = fresh ? '' : selA.value;
      let b = fresh ? '' : selB.value;
      if (!refs.includes(a)) a = builds[0]?.sha256 ?? WORKING;
      if (!refs.includes(b)) b = WORKING;
      if (fresh && builds.length >= 2) {
        a = builds[1].sha256;
        b = builds[0].sha256;
      }
      fillSelect(selA, refs, a);
      fillSelect(selB, refs, b);
      q<HTMLButtonElement>('.lib-inspect-build').disabled = selA.value === WORKING;
      if (!builds.length) {
        cmpBody.classList.add('hidden');
        notice(cmpStatus, 'info', `${p.name} has no builds yet. Package it in the Package pane, then compare a build with the current files or with a later build.`);
        return;
      }
      await runCompare();
    } catch (err) {
      notice(cmpStatus, 'error', errorMessage(err));
    }
  }

  async function runCompare(): Promise<void> {
    const p = ctx.project.current();
    if (!p) return;
    const a = selA.value;
    const b = selB.value;
    q<HTMLButtonElement>('.lib-inspect-build').disabled = a === WORKING;
    if (a === b) {
      cmpBody.classList.add('hidden');
      notice(cmpStatus, 'info', 'Choose two different sides to compare.');
      return;
    }
    const token = ++cmpToken;
    notice(cmpStatus, 'info', 'Comparing...', true);
    try {
      const c = await ctx.api.get<Comparison>(`/api/library/compare/${encodeURIComponent(p.id)}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
      if (token !== cmpToken) return;
      comparison = c;
      renderComparison(c);
    } catch (err) {
      if (token === cmpToken) {
        cmpBody.classList.add('hidden');
        notice(cmpStatus, 'error', errorMessage(err));
      }
    }
  }

  function renderComparison(c: Comparison): void {
    cmpBody.classList.remove('hidden');
    const n = c.counts;
    if (c.identical) notice(cmpStatus, 'success', `${c.a.label} and ${c.b.label} hold the same manifest and the same files.`);
    else notice(cmpStatus, c.permissions.added.length ? 'warning' : 'info', `${plural(n.changed, 'file')} changed, ${n.added} added, ${n.removed} removed, ${n.same} the same; ${plural(c.manifest.length, 'manifest field')} differ.${c.consent_again ? ' Apps ask for consent again for this version.' : ''}`);
    q('.lib-cmp-chips').innerHTML = [
      c.version.changed ? `<span class="chip accent">version ${esc(c.version.before ?? '?')} to ${esc(c.version.after ?? '?')}</span>` : `<span class="chip">version ${esc(c.version.after ?? '?')} on both</span>`,
      c.a.sha256 && c.b.sha256 ? `<span class="chip">${esc(size(c.a.bytes))} to ${esc(size(c.b.bytes))} packed</span>` : '',
      `<span class="chip success">+${n.added}</span><span class="chip warning">~${n.changed}</span><span class="chip error">-${n.removed}</span>`,
    ].join('');
    const pr = c.permissions;
    const permRows = [
      ...pr.added.map((p) => `<li class="list-row lib-issue warning">${icon('plus')}<span><strong>${esc(p.words)}</strong> <code>${esc(p.id)}</code> is new: people are asked again before it runs.</span></li>`),
      ...pr.removed.map((p) => `<li class="list-row lib-issue success">${icon('close')}<span><strong>${esc(p.words)}</strong> <code>${esc(p.id)}</code> is no longer asked for.</span></li>`),
      ...pr.kept.map((p) => `<li class="list-row">${icon('shield')}<span>${esc(p.words)} <code>${esc(p.id)}</code></span></li>`),
    ];
    q('.lib-cmp-perms').innerHTML = permRows.join('') || '<li class="list-row"><span class="lib-muted">Neither side asks for anything.</span></li>';
    q('.lib-cmp-man-sec').classList.toggle('hidden', c.manifest.length === 0);
    q('.lib-cmp-man tbody').innerHTML = c.manifest
      .map((m) => `<tr class="lib-m-${esc(m.change)}"><td><code>${esc(m.path)}</code></td><td class="lib-before">${m.change === 'added' ? '<span class="lib-muted">not set</span>' : esc(value(m.before))}</td><td class="lib-after">${m.change === 'removed' ? '<span class="lib-muted">removed</span>' : esc(value(m.after))}</td></tr>`)
      .join('');
    const html = c.files
      .map((f) => {
        const lines = f.lines ? `<span class="lib-lines"><span class="lib-add">+${f.lines.added}</span> <span class="lib-del">-${f.lines.removed}</span></span>` : '';
        const sizes = f.change === 'same' ? size(f.after) : f.change === 'added' ? size(f.after) : f.change === 'removed' ? size(f.before) : `${size(f.before)} to ${size(f.after)}`;
        const open = f.change !== 'same' && f.text;
        return `<div class="lib-fc" data-path="${esc(f.path)}" data-change="${f.change}"><button class="lib-fc-head" type="button"${open ? '' : ' disabled'} aria-expanded="false"><span class="lib-fc-badge">${f.change === 'added' ? 'A' : f.change === 'removed' ? 'D' : f.change === 'changed' ? 'M' : '='}</span><code>${esc(f.path)}</code>${lines}<span class="lib-muted lib-fc-size">${esc(sizes)}</span>${open ? `<span class="lib-fc-caret">${icon('chevron-down', 14)}</span>` : ''}</button><div class="lib-diff hidden"></div></div>`;
      })
      .join('');
    if (cmpFiles.innerHTML !== html) cmpFiles.innerHTML = html;
  }

  async function toggleDiff(row: HTMLElement): Promise<void> {
    const head = row.querySelector<HTMLButtonElement>('.lib-fc-head')!;
    const box = row.querySelector<HTMLElement>('.lib-diff')!;
    const open = head.getAttribute('aria-expanded') !== 'true';
    head.setAttribute('aria-expanded', String(open));
    box.classList.toggle('hidden', !open);
    if (!open || box.dataset.loaded) return;
    const p = ctx.project.current();
    if (!p || !comparison) return;
    box.innerHTML = '<div class="lib-diff-wait"><span class="spinner"></span></div>';
    try {
      const d = await ctx.api.get<{ hunks: Hunk[]; truncated?: boolean }>(`/api/library/compare/${encodeURIComponent(p.id)}/file?a=${encodeURIComponent(selA.value)}&b=${encodeURIComponent(selB.value)}&path=${encodeURIComponent(row.dataset.path!)}`);
      box.dataset.loaded = '1';
      box.innerHTML =
        d.hunks
          .map((h) => `<div class="lib-hunk"><div class="lib-hunk-head">@@ -${h.a_start},${h.a_lines} +${h.b_start},${h.b_lines} @@</div>${h.lines.map((l) => `<div class="lib-dl lib-dl-${l.t === '+' ? 'add' : l.t === '-' ? 'del' : 'ctx'}"><span class="lib-ln">${l.a ?? ''}</span><span class="lib-ln">${l.b ?? ''}</span><span class="lib-dt">${l.t}</span><span class="lib-ds">${esc(l.s)}</span></div>`).join('')}</div>`)
          .join('') + (d.truncated ? '<div class="lib-muted lib-diff-more">The rest of this diff is not shown.</div>' : '') || '<div class="lib-muted lib-diff-more">Only line endings or encoding differ.</div>';
    } catch (err) {
      box.innerHTML = `<div class="notice error">${icon('error')}<span>${esc(errorMessage(err))}</span></div>`;
    }
  }

  function handleArgs(a: unknown): void {
    const args = (a ?? {}) as { action?: string; path?: string; project?: string; sha?: string; key?: string };
    if (args.action === 'import') choose();
    else if (args.action === 'inspect' && args.path) inspect({ kind: 'path', path: args.path });
    else if (args.action === 'inspect' && args.project && args.sha) inspect({ kind: 'build', project: args.project, sha: args.sha });
    else if (args.action === 'inspect' && args.key) inspect({ kind: 'registry', id: args.key });
    else if (args.action === 'compare') setTab('compare');
    else if (args.action === 'examples') setTab('examples');
  }

  for (const b of tabBtns) b.addEventListener('click', () => setTab(b.dataset.tab as Tab));
  q('.lib-choose').addEventListener('click', choose);
  q('.lib-choose-top').addEventListener('click', choose);
  fileInput.addEventListener('change', () => takeFile(fileInput.files?.[0]));
  q<HTMLFormElement>('.lib-path-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const path = pathInput.value.trim();
    if (path) inspect({ kind: 'path', path });
  });
  el.addEventListener('dragover', (ev) => {
    if (!ev.dataTransfer?.types.includes('Files')) return;
    ev.preventDefault();
    drop.classList.add('over');
  });
  el.addEventListener('dragleave', (ev) => {
    if (!el.contains(ev.relatedTarget as Node)) drop.classList.remove('over');
  });
  el.addEventListener('drop', (ev) => {
    if (!ev.dataTransfer?.files.length) return;
    ev.preventDefault();
    drop.classList.remove('over');
    takeFile(ev.dataTransfer.files[0]);
  });
  drop.addEventListener('keydown', (ev) => {
    if (ev.target === drop && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      choose();
    }
  });
  q('.lib-import').addEventListener('click', () => {
    if (source && report) runImport(source, report.kit_refuses);
  });
  q('.lib-repo').addEventListener('click', (ev) => {
    const href = (ev.currentTarget as HTMLElement).dataset.href;
    if (href) openExternal(href);
  });
  q('.lib-facts').addEventListener('click', async (ev) => {
    if (!(ev.target as HTMLElement).closest('.lib-copy') || !report) return;
    try {
      await navigator.clipboard.writeText(report.sha256);
      ctx.notify('SHA-256 copied', 'success');
    } catch {
      ctx.notify('The clipboard is not available here.', 'warning');
    }
  });
  exGrid.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const link = t.closest<HTMLAnchorElement>('a[data-external]');
    if (link) {
      ev.preventDefault();
      openExternal(link.href);
      return;
    }
    const card = t.closest<HTMLElement>('.lib-ex');
    if (!card) return;
    const id = card.dataset.key!;
    if (t.closest('[data-ex-inspect]')) inspect({ kind: 'registry', id });
    else if (t.closest('[data-ex-import]')) runImport({ kind: 'registry', id }, false);
    else {
      const open = t.closest<HTMLElement>('[data-ex-open]');
      if (open) ctx.project.open(open.dataset.exOpen!).then(() => ctx.openPane('edit')).catch((err) => ctx.notify(errorMessage(err), 'error'));
    }
  });
  q('.lib-reg-refresh').addEventListener('click', () => void loadExamples(true));
  selA.addEventListener('change', runCompare);
  selB.addEventListener('change', runCompare);
  q('.lib-swap').addEventListener('click', () => {
    const a = selA.value;
    selA.value = selB.value;
    selB.value = a;
    runCompare();
  });
  q('.lib-inspect-build').addEventListener('click', () => {
    const p = ctx.project.current();
    if (p && selA.value !== WORKING) inspect({ kind: 'build', project: p.id, sha: selA.value });
  });
  q('.lib-open').addEventListener('click', () => chooseProject());
  cmpFiles.addEventListener('click', (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>('.lib-fc');
    if (row && (ev.target as HTMLElement).closest('.lib-fc-head:not([disabled])')) toggleDiff(row);
  });

  ctx.commands.register({ id: 'library.import', title: 'Library: Import .formpkg', run: choose });
  ctx.commands.register({ id: 'library.examples', title: 'Library: Registry', run: () => ctx.openPane('library', { action: 'examples' }) });
  ctx.commands.register({ id: 'library.compare', title: 'Library: Compare Builds', run: () => ctx.openPane('library', { action: 'compare' }) });

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (tab === 'compare') loadBuilds();
    }, 300);
  };
  const offs = [
    ctx.events.on('pane.open', (d: { id?: string; args?: unknown }) => d?.id === 'library' && handleArgs(d.args)),
    ctx.project.onChange((_p: ProjectRef | null) => {
      buildsFor = '';
      if (tab === 'compare') loadBuilds();
    }),
    ctx.events.on('package.built', later),
    ctx.events.on('package.removed', later),
    ctx.events.on('project.changed', (d: { id?: string }) => d?.id === ctx.project.current()?.id && selB.value === WORKING && later()),
    ctx.events.on('project.deleted', () => {
      examplesLoaded = false;
      if (tab === 'examples') loadExamples();
    }),
  ];

  setTab(tab);
  return () => {
    clearTimeout(timer);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = { id: 'library', title: 'Library', icon: 'library', order: 50, group: 'make', mount };
