import './run.css';
import { icon, esc, setText, appIcon, productName, PRODUCTS, chooseProject, activePane, errorMessage } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';

interface Install { channel: string; version: string; path: string; installed_at: number | null; present: boolean; target: string | null; previous: string | null }
interface HostView { state: string; reason: string; name?: string; version?: string; panels?: { id: string; title: string }[]; commands?: { id: string; title: string }[]; permissions?: string[]; app_version?: string | null }
interface DevRow { id: string; path: string; added?: string; project: { id: string; name: string } | null; host: HostView }
interface AppRow {
  product: string;
  name: string;
  installs: Install[];
  version: string | null;
  launchable: boolean;
  dev: { file: string; exists: boolean; mtime: number | null; problems: string[]; extensions: DevRow[] };
  enabled: { exists: boolean; extensions: { id: string; version: string; source: string }[] };
  extensions: { id: string; name: string; version: string; source: string; enabled: boolean }[];
}
interface Overview { root: { path: string; source: string; exists: boolean }; state_error: string; cli: { found: boolean; command: string[]; source: string }; apps: AppRow[]; checked_at: number }
interface Status {
  project: string;
  product: string;
  id: string;
  package_dir: string;
  listed: boolean;
  entry: { id: string; path: string; added?: string } | null;
  other_path: string | null;
  host: HostView | null;
  app: { name: string; version: string | null; installs: Install[]; launchable: boolean } | null;
  dev?: { file: string; exists: boolean; problems: string[]; count: number };
}
interface Sent { method: string; package: string; opened?: string; command?: string; note?: string | null; cli_error?: string | null; installed?: { name?: string; version?: string } | null }

const POLL_MS = 4000;
const BLANK = ' ';
const STOP = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
const ROOT_SOURCE: Record<string, string> = { FORMPORTAL_ROOT: 'from FORMPORTAL_ROOT', settings: 'from form.ext settings', default: 'FormPortal default' };

function when(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  const hosts = PRODUCTS;
  el.innerHTML = `
    <div class="pane-fill run-pane">
      <header class="pane-head">
        <span class="run-mark">${icon('run', 18)}</span>
        <div class="run-title">
          <h1>Run in App</h1>
          <div class="sub run-sub">&nbsp;</div>
        </div>
        <div class="actions">
          <button class="btn ghost run-refresh" type="button" title="Read FormPortal's folder again">${icon('refresh')}<span>Refresh</span></button>
          <button class="btn primary run-toggle" type="button" disabled><span class="run-toggle-icon">${icon('play')}</span><span class="run-toggle-text">Run in App</span></button>
        </div>
      </header>
      <div class="pane-body run-body">
        <section class="section run-project">
          <div class="section-title">This project</div>
          <div class="notice run-status info" role="status"><span class="run-status-icon">${icon('info')}</span><span class="run-status-text">&nbsp;</span></div>
          <div class="run-slot">
          <div class="card run-card">
            <div class="run-app">
              <span class="run-app-icon">${appIcon('formportal', true)}</span>
              <div class="run-app-text">
                <div class="run-app-name">&nbsp;</div>
                <div class="run-app-meta">&nbsp;</div>
              </div>
            </div>
            <dl class="run-facts">
              <dt>State</dt><dd><span class="chip run-host-chip">&nbsp;</span></dd>
              <dt>Loads from</dt><dd><code class="run-folder">&nbsp;</code></dd>
              <dt>dev.json</dt><dd><code class="run-devfile">&nbsp;</code></dd>
              <dt>Contributes</dt><dd class="run-contrib">&nbsp;</dd>
            </dl>
            <div class="btn-group run-actions">
              <button class="btn run-reload" type="button" disabled title="Touch dev.json so the app reads it again">${icon('refresh')}<span>Reload in App</span></button>
              <button class="btn run-install" type="button" disabled title="Build the package and send it to FormPortal">${icon('package')}<span>Install with FormPortal</span></button>
              <button class="btn ghost run-manage" type="button" disabled>${icon('hub')}<span>Manage in FormPortal</span></button>
              <button class="btn run-open" type="button" disabled>${icon('external')}<span class="run-open-text">Open App</span></button>
            </div>
          </div>
          <div class="empty run-none run-off">${icon('folder')}<h3>No project open</h3><p>Open a project to load it live in its Form app. form.ext lists it in FormPortal's dev.json for that app, and the app picks it up within two seconds.</p><div class="btn-group"><button class="btn run-choose" type="button">${icon('folder-open')}<span>Open Project</span></button><button class="btn ghost run-new" type="button">${icon('new')}<span>New Extension</span></button></div></div>
          </div>
        </section>
        <section class="section run-portal">
          <div class="section-title">FormPortal</div>
          <div class="run-portal-row">
            <span class="run-portal-label">Folder</span><code class="run-root">&nbsp;</code>
          </div>
          <div class="run-portal-row">
            <span class="run-portal-label">Chosen by</span><span class="chip run-root-source">&nbsp;</span>
          </div>
          <div class="run-portal-row">
            <span class="run-portal-label">Command line</span><span class="run-cli">&nbsp;</span>
          </div>
        </section>
        <section class="section run-apps">
          <div class="section-title">Form apps on this computer</div>
          <table class="table run-table">
            <colgroup><col class="run-col-app" /><col class="run-col-installed" /><col class="run-col-dev" /><col class="run-col-ext" /><col class="run-col-open" /></colgroup>
            <thead><tr><th>App</th><th>Installed</th><th>In development</th><th>From FormPortal</th><th></th></tr></thead>
            <tbody>
              ${hosts.map((p) => `<tr data-product="${p.id}"><td><span class="run-cell-app">${appIcon(p.id)}<span>${esc(p.name)}</span></span></td><td class="run-cell-installed">&nbsp;</td><td class="run-cell-dev">&nbsp;</td><td class="run-cell-ext">&nbsp;</td><td class="run-cell-open"><button class="btn sm ghost run-row-open" type="button" disabled>${icon('external')}<span>Open</span></button></td></tr>`).join('')}
            </tbody>
          </table>
        </section>
      </div>
    </div>`;

  const q = <T extends HTMLElement = HTMLElement>(sel: string) => (el.querySelector<T>(sel) ?? document.querySelector<T>(sel))!;
  const sub = q('.run-sub');
  const toggle = q<HTMLButtonElement>('.run-toggle');
  const toggleText = q('.run-toggle-text');
  const toggleIcon = q('.run-toggle-icon');
  const refreshBtn = q<HTMLButtonElement>('.run-refresh');
  const status = q('.run-status');
  const statusIcon = q('.run-status-icon');
  const statusText = q('.run-status-text');
  const card = q('.run-card');
  const none = q('.run-none');
  const appIconEl = q('.run-app-icon');
  const appName = q('.run-app-name');
  const appMeta = q('.run-app-meta');
  const hostChip = q('.run-host-chip');
  const folderEl = q('.run-folder');
  const devfileEl = q('.run-devfile');
  const contrib = q('.run-contrib');
  const reloadBtn = q<HTMLButtonElement>('.run-reload');
  const openBtn = q<HTMLButtonElement>('.run-open');
  const openText = q('.run-open-text');
  const installBtn = q<HTMLButtonElement>('.run-install');
  const manageBtn = q<HTMLButtonElement>('.run-manage');
  const rootEl = q('.run-root');
  const rootSource = q('.run-root-source');
  const cliEl = q('.run-cli');
  const rows = new Map<string, HTMLTableRowElement>();
  for (const tr of el.querySelectorAll<HTMLTableRowElement>('.run-table tbody tr')) rows.set(tr.dataset.product!, tr);

  let overview: Overview | null = null;
  let current: Status | null = null;
  let busy = false;
  let poll = 0;
  let level = '';
  let iconProduct = 'formportal';
  let lastSig = '';

  function setStatus(kind: 'info' | 'success' | 'warning' | 'error', text: string): void {
    if (level !== kind) {
      status.className = `notice run-status ${kind}`;
      statusIcon.innerHTML = icon(kind === 'success' ? 'success' : kind);
      level = kind;
    }
    setText(statusText, text);
  }

  function setChip(chip: HTMLElement, kind: string, text: string): void {
    const cls = `chip run-host-chip ${kind}`;
    if (chip.className !== cls) chip.className = cls;
    setText(chip, text);
  }

  function installText(list: Install[]): string {
    if (!list.length) return 'Not installed';
    return list.map((i) => `${i.version || '?'}${i.channel !== 'stable' ? ` ${i.channel}` : ''}${i.present ? '' : ' (folder missing)'}`).join(', ');
  }

  function renderProject(): void {
    const project = ctx.project.current();
    none.classList.toggle('run-off', !!project);
    card.classList.toggle('run-off', !project);
    none.inert = !!project;
    card.inert = !project;
    if (!project) {
      setText(sub, 'No project open');
      setStatus('info', 'Open a project to run it in its app.');
      toggle.disabled = true;
      setText(toggleText, 'Run in App');
      return;
    }
    const product = project.product;
    const name = productName(product) || product || 'no app';
    setText(sub, `${project.name} · ${name}`);
    if (iconProduct !== (product || 'formportal')) {
      iconProduct = product || 'formportal';
      appIconEl.innerHTML = appIcon(iconProduct, true);
    }
    setText(appName, name);
    const s = current && current.project === project.id ? current : null;
    toggle.disabled = busy || !s || !s.app;
    setText(toggleText, s?.listed ? `Stop in ${name}` : `Run in ${name}`);
    toggle.classList.toggle('primary', !s?.listed);
    const glyph = s?.listed ? 'stop' : 'play';
    if (toggleIcon.dataset.glyph !== glyph) {
      toggleIcon.dataset.glyph = glyph;
      toggleIcon.innerHTML = s?.listed ? STOP : icon('play');
    }
    if (!s) {
      setText(appMeta, BLANK);
      setChip(hostChip, '', 'Checking');
      setText(folderEl, BLANK);
      setText(devfileEl, BLANK);
      setText(contrib, BLANK);
      if (!busy) setStatus('info', 'Reading FormPortal’s folder...');
      return;
    }
    if (!s.app) {
      setText(appMeta, 'The manifest names no Form app');
      setChip(hostChip, 'error', 'No app');
      setStatus('error', 'Set the manifest’s product to one of the Form apps (Edit, Manifest) to run it in that app.');
      for (const b of [reloadBtn, openBtn, installBtn, manageBtn]) b.disabled = true;
      return;
    }
    const app = s.app;
    setText(appMeta, app.installs.length ? `FormPortal installed ${installText(app.installs)}` : 'FormPortal has not installed it here; a copy you run from source reads the same folder');
    const host = s.host;
    if (host?.state === 'ready') setChip(hostChip, 'success', s.listed ? 'Loading live' : 'Ready to load');
    else setChip(hostChip, 'error', 'Refused');
    setText(folderEl, s.package_dir);
    setText(devfileEl, s.dev?.file ?? '');
    const panels = host?.panels?.length ?? 0;
    const commands = host?.commands?.length ?? 0;
    setText(contrib, host?.state === 'ready' ? `${panels} panel${panels === 1 ? '' : 's'}, ${commands} command${commands === 1 ? '' : 's'}${host.permissions?.length ? ` · asks for ${host.permissions.join(', ')}` : ' · asks for no permission'}` : host?.reason ?? '');
    reloadBtn.disabled = busy || !s.listed;
    openBtn.disabled = busy || !app.launchable;
    setText(openText, `Open ${app.name}`);
    installBtn.disabled = busy;
    manageBtn.disabled = busy;
    if (s.dev?.problems.length) setStatus('error', `${app.name}’s dev.json does not follow the contract (${s.dev.problems.join('; ')}). Fix or delete ${s.dev.file}.`);
    else if (host && host.state !== 'ready') setStatus('error', `${app.name} would refuse it: ${host.reason}. Fix it in Edit, then Run again.`);
    else if (s.listed) setStatus('success', `Listed in ${app.name}’s dev.json. A running ${app.name} loads it within two seconds as a Development extension and serves its files straight from this project, so a saved change shows the next time you open its panel.`);
    else if (s.other_path) setStatus('warning', `${app.name}’s dev.json lists ${s.id} from another folder (${s.other_path}). Run replaces that entry with this project.`);
    else setStatus('info', `Run writes this project into ${app.name}’s dev.json, so ${app.name} loads it live, without packaging.`);
  }

  function renderApps(): void {
    if (!overview) return;
    setText(rootEl, overview.root.path);
    setText(rootSource, `${ROOT_SOURCE[overview.root.source] ?? overview.root.source}${overview.root.exists ? '' : ', not created yet'}`);
    setText(cliEl, overview.cli.found ? `${overview.cli.command.join(' ')} (${overview.cli.source}): Install with FormPortal runs extension-install --path` : 'Not found: Install with FormPortal opens the package with FormPortal instead');
    for (const app of overview.apps) {
      const tr = rows.get(app.product);
      if (!tr) continue;
      setText(tr.querySelector('.run-cell-installed'), installText(app.installs));
      const devCell = tr.querySelector<HTMLElement>('.run-cell-dev')!;
      const dev = app.dev.extensions;
      const sig = JSON.stringify(dev.map((d) => [d.id, d.path, d.host.state, d.host.reason, d.project?.id]).concat(app.dev.problems));
      if (devCell.dataset.sig !== sig) {
        devCell.dataset.sig = sig;
        devCell.innerHTML = app.dev.problems.length
          ? `<span class="chip error">${icon('error', 12)}dev.json is not valid</span>`
          : dev.length
            ? dev.map((d) => `<div class="run-dev-row" title="${esc(d.path)}${d.added ? ` · added ${esc(when(d.added))}` : ''}"><span class="chip ${d.host.state === 'ready' ? 'success' : 'error'}">${esc(d.host.name || d.id)}</span>${d.host.state === 'ready' ? '' : `<span class="run-dev-reason">${esc(d.host.reason)}</span>`}${d.project ? '' : '<span class="run-dev-outside">outside form.ext</span>'}</div>`).join('')
            : '<span class="run-faint">None</span>';
      }
      const ext = app.extensions;
      setText(tr.querySelector('.run-cell-ext'), ext.length ? `${ext.filter((e) => e.enabled).length} on, ${ext.length} installed` : app.enabled.extensions.length ? `${app.enabled.extensions.length} enabled` : 'None');
      tr.querySelector<HTMLButtonElement>('.run-row-open')!.disabled = !app.launchable;
    }
  }

  async function load(quiet = false): Promise<void> {
    const project = ctx.project.current();
    try {
      const [ov, st] = await Promise.all([
        ctx.api.get<Overview>('/api/runapp'),
        project ? ctx.api.get<Status>(`/api/runapp/projects/${encodeURIComponent(project.id)}`) : Promise.resolve(null),
      ]);
      const sig = JSON.stringify([ov.root, ov.cli, ov.apps, st]);
      if (sig === lastSig && quiet) return;
      lastSig = sig;
      overview = ov;
      current = st;
      renderApps();
      renderProject();
    } catch (err) {
      if (!quiet) setStatus('error', `form.ext could not read FormPortal’s folder: ${errorMessage(err)}`);
    }
  }

  async function act(fn: () => Promise<unknown>): Promise<void> {
    if (busy) return;
    busy = true;
    renderProject();
    try {
      await fn();
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    } finally {
      busy = false;
      await load();
    }
  }

  function pid(): string {
    return encodeURIComponent(ctx.project.current()!.id);
  }

  async function runOrStop(): Promise<void> {
    const project = ctx.project.current();
    if (!project) return;
    const name = productName(project.product);
    await act(async () => {
      if (current?.listed) {
        await ctx.api.del(`/api/runapp/projects/${pid()}`);
        ctx.notify(`${project.name} is no longer loaded in ${name}.`, 'info');
      } else {
        const s = await ctx.api.post<Status>(`/api/runapp/projects/${pid()}`);
        ctx.notify(s.host?.state === 'ready' ? `${project.name} is listed in ${name}’s dev.json; ${name} loads it live.` : `Listed, but ${name} would refuse it: ${s.host?.reason}`, s.host?.state === 'ready' ? 'success' : 'warning');
      }
    });
  }

  function describeSent(r: Sent): void {
    if (r.method === 'cli') ctx.notify(`FormPortal installed ${r.installed?.name ?? 'the package'}${r.installed?.version ? ` ${r.installed.version}` : ''}.${r.note ? ` ${r.note}` : ''}`, 'success');
    else ctx.notify(`Opened the package with ${r.opened}; FormPortal asks before it installs it.${r.cli_error ? ` (Command line: ${r.cli_error})` : ''}`, 'info');
  }

  toggle.addEventListener('click', () => void runOrStop());
  refreshBtn.addEventListener('click', () => void load());
  reloadBtn.addEventListener('click', () => void act(async () => {
    await ctx.api.post(`/api/runapp/apps/${ctx.project.current()!.product}/reload`);
    ctx.notify('dev.json touched; the app reads it again.', 'info');
  }));
  openBtn.addEventListener('click', () => void act(async () => {
    const r = await ctx.api.post<{ opened: string }>(`/api/runapp/apps/${ctx.project.current()!.product}/open`);
    ctx.notify(`Opened ${r.opened}`, 'success');
  }));
  installBtn.addEventListener('click', () => void act(async () => describeSent(await ctx.api.post<Sent>(`/api/runapp/projects/${pid()}/install`))));
  manageBtn.addEventListener('click', () => void act(() => ctx.api.post(`/api/runapp/apps/${ctx.project.current()!.product}/manage`)));
  for (const [product, tr] of rows) {
    tr.querySelector('.run-row-open')!.addEventListener('click', () => void act(async () => {
      const r = await ctx.api.post<{ opened: string }>(`/api/runapp/apps/${product}/open`);
      ctx.notify(`Opened ${r.opened}`, 'success');
    }));
  }
  q('.run-choose').addEventListener('click', () => void chooseProject());
  q('.run-new').addEventListener('click', () => ctx.openPane('new'));

  ctx.commands.register({ id: 'run.toggle', title: 'Run in App (or Stop)', keys: 'F5', run: () => { ctx.openPane('run'); return runOrStop(); } });
  ctx.commands.register({ id: 'run.reload', title: 'Reload Extension in App', run: () => ctx.project.current() && ctx.api.post(`/api/runapp/apps/${ctx.project.current()!.product}/reload`) });

  poll = window.setInterval(() => {
    if (document.visibilityState === 'visible' && activePane() === 'run' && !busy) void load(true);
  }, POLL_MS);

  const offs = [
    ctx.project.onChange((_p: ProjectRef | null) => {
      current = null;
      renderProject();
      void load();
    }),
    ctx.events.on('runapp.changed', () => void load(true)),
    ctx.events.on('pane.open', (d: { id?: string }) => {
      if (d?.id === 'run') void load(true);
    }),
    ctx.events.on('project.changed', (d: { id?: string; manifest?: unknown }) => {
      if (d?.manifest && d.id === ctx.project.current()?.id) void load(true);
    }),
  ];

  renderProject();
  void load();

  return () => {
    window.clearInterval(poll);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = {
  id: 'run',
  title: 'Run in App',
  icon: 'run',
  order: 10,
  group: 'ship',
  view: 'part',
  mount,
};
