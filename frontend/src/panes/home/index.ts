import './home.css';
import { icon, appIcon, brandMark, HOSTS, productName, esc, setText, errorMessage, chooseProject, VERSION } from '../../shell';
import type { PaneDef, ShellContext } from '../../shell';

interface Project {
  id: string;
  name: string;
  product: string;
  version?: string;
  dir: string;
  linked?: string | null;
  manifest_error?: string | null;
  modified?: number;
  opened?: number;
}

interface Example {
  id: string;
  name: string;
  product: string;
  description: string;
  permissions: string[];
}

const RECENT_ROWS = 8;

function ago(seconds?: number): string {
  if (!seconds) return '';
  const d = Date.now() / 1000 - seconds;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)} d ago`;
  return new Date(seconds * 1000).toLocaleDateString();
}

function hasPane(id: string): boolean {
  return !!document.querySelector(`.fx-pane[data-pane="${id}"]`);
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill home-pane">
      <div class="pane-body home-body">
        <header class="home-hero">
          <span class="home-brand">${brandMark}</span>
          <div class="home-hero-text">
            <h1>form.ext</h1>
            <p>Make extensions for every Form app: start from a working project, preview it in a simulated app, check it, then run it in the real one.</p>
          </div>
          <span class="chip home-version">v${esc(VERSION)}</span>
        </header>

        <div class="home-actions">
          <button class="card interactive home-action" type="button" data-act="new">
            <span class="home-action-icon">${icon('new', 20)}</span>
            <span><strong>New Extension</strong><span>Pick an app and a starter</span></span>
          </button>
          <button class="card interactive home-action" type="button" data-act="folder">
            <span class="home-action-icon">${icon('folder-open', 20)}</span>
            <span><strong>Open Folder</strong><span>An extension folder on this computer</span></span>
          </button>
          <button class="card interactive home-action" type="button" data-act="import">
            <span class="home-action-icon">${icon('import', 20)}</span>
            <span><strong>Import .formpkg</strong><span>Turn a package back into a project</span></span>
          </button>
        </div>

        <div class="home-grid">
          <section class="section home-recent">
            <div class="home-section-head"><span class="section-title">Recent</span><button class="btn ghost sm home-all" type="button">${icon('search')}<span>All projects</span></button></div>
            <ul class="list divided home-list" aria-busy="true">
              ${Array.from({ length: 3 }, () => '<li class="list-row home-skel"><span class="home-skel-icon"></span><span class="home-skel-line"></span></li>').join('')}
            </ul>
          </section>

          <aside class="home-side">
            <section class="section">
              <span class="section-title">Start for an app</span>
              <div class="home-apps">
                ${HOSTS.map((p) => `<button class="home-app" type="button" data-product="${p.id}" title="New extension for ${esc(p.name)}">${appIcon(p.id)}<span>${esc(p.name)}</span></button>`).join('')}
              </div>
            </section>
            <section class="section">
              <span class="section-title">Examples</span>
              <ul class="list home-examples"><li class="list-row home-skel"><span class="home-skel-icon"></span><span class="home-skel-line"></span></li></ul>
              <button class="btn sm home-library" type="button">${icon('library')}<span>More in the Library</span></button>
            </section>
          </aside>
        </div>
      </div>
    </div>`;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const list = q('.home-list');
  const examples = q('.home-examples');
  if (!hasPane('library')) q('.home-library').style.display = 'none';

  async function openProject(id: string): Promise<void> {
    await ctx.project.open(id);
    ctx.openPane(hasPane('edit') ? 'edit' : 'check');
  }

  function row(p: Project): string {
    const where = p.linked ? `${icon('link')}<span>${esc(p.linked)}</span>` : `<span>${esc(p.id)}</span>`;
    const state = p.manifest_error ? `<span class="chip error">manifest</span>` : '';
    return `<li class="list-row interactive home-row" data-id="${esc(p.id)}" tabindex="0">
      ${appIcon(p.product)}
      <span class="home-row-text"><strong>${esc(p.name)}</strong><span class="home-row-sub">${esc(productName(p.product))} ${p.version ? `<span>${esc(p.version)}</span>` : ''} ${where}</span></span>
      ${state}
      <span class="meta">${esc(ago(p.opened || p.modified))}</span>
      <button class="btn ghost icon sm home-remove" type="button" title="${p.linked ? 'Forget this folder' : 'Move to the trash'}" aria-label="Remove">${icon('trash')}</button>
    </li>`;
  }

  async function loadRecent(): Promise<void> {
    try {
      const { projects } = await ctx.api.get<{ projects: Project[] }>('/api/projects/recent?limit=' + RECENT_ROWS);
      const html = projects.length
        ? projects.map(row).join('')
        : `<li class="home-empty"><div class="empty">${icon('puzzle')}<h3>No projects yet</h3><p>Start one from a starter: every starter uses its app's real API and passes Check.</p><div class="btn-group"><button class="btn primary" type="button" data-act="new">${icon('plus')}<span>New Extension</span></button></div></div></li>`;
      if (list.innerHTML !== html) list.innerHTML = html;
    } catch (err) {
      const html = `<li class="home-empty"><div class="notice error">${icon('error')}<span>${esc(errorMessage(err))}</span></div></li>`;
      if (list.innerHTML !== html) list.innerHTML = html;
    }
    list.removeAttribute('aria-busy');
  }

  async function loadExamples(): Promise<void> {
    try {
      const r = await ctx.api.get<{ examples: Example[] }>('/api/templates/examples');
      const html =
        r.examples
          .map(
            (x) => `<li class="list-row home-example">${appIcon(x.product)}<span class="home-row-text"><strong>${esc(x.name)}</strong><span class="home-row-sub" title="${esc(x.description)}">${esc(x.description)}</span></span><button class="btn sm" type="button" data-example="${esc(x.id)}">${icon('copy')}<span>Copy</span></button></li>`,
          )
          .join('') || '<li class="list-row"><span class="meta">No examples in the contract kit.</span></li>';
      if (examples.innerHTML !== html) examples.innerHTML = html;
    } catch (err) {
      examples.innerHTML = `<li class="list-row"><span class="meta">${esc(errorMessage(err))}</span></li>`;
    }
  }

  async function openFolder(): Promise<void> {
    const data = await ctx.dialog.form(
      'Open Folder',
      `<div class="field" data-wide><label for="home-path">Folder</label><input class="input code" id="home-path" name="path" required placeholder="/home/me/my-extension" autocomplete="off" spellcheck="false" /><div class="hint">A folder with manifest.json at its root, or a project with package/manifest.json.</div></div>
       <label class="check"><input type="checkbox" name="link" checked /><span>Work on the folder where it is (otherwise form.ext copies it)</span></label>
       <span data-ok="Open" hidden></span>`,
    );
    if (!data) return;
    const path = String(data.get('path') ?? '').trim();
    if (!path) return;
    try {
      const p = await ctx.api.post<Project>('/api/projects/import', { path, link: data.get('link') === 'on' });
      ctx.notify(`Opened ${p.name}`, 'success');
      await openProject(p.id);
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    }
  }

  function importPackage(): void {
    if (hasPane('library')) ctx.openPane('library', { action: 'import', from: 'home' });
    else ctx.notify('Importing a .formpkg needs the Library pane, which is not in this build.', 'warning');
  }

  async function act(name: string): Promise<void> {
    if (name === 'new') ctx.openPane('new');
    else if (name === 'folder') await openFolder();
    else if (name === 'import') importPackage();
  }

  el.addEventListener('click', async (ev) => {
    const t = ev.target as HTMLElement;
    const a = t.closest<HTMLElement>('[data-act]');
    if (a) return act(a.dataset.act!);
    const app = t.closest<HTMLElement>('.home-app');
    if (app) return ctx.openPane('new', { product: app.dataset.product });
    const ex = t.closest<HTMLElement>('[data-example]');
    if (ex) {
      try {
        const p = await ctx.api.post<Project>(`/api/templates/examples/${encodeURIComponent(ex.dataset.example!)}`, {});
        ctx.notify(`${p.name} copied into a new project`, 'success');
        await openProject(p.id);
      } catch (err) {
        ctx.notify(errorMessage(err), 'error');
      }
      return;
    }
    if (t.closest('.home-library')) return ctx.openPane('library', { action: 'examples', from: 'home' });
    if (t.closest('.home-all')) return chooseProject();
    const r = t.closest<HTMLElement>('.home-row');
    if (!r) return;
    if (t.closest('.home-remove')) {
      const name = r.querySelector('strong')?.textContent ?? r.dataset.id!;
      const linked = !!r.querySelector('.home-row-sub svg');
      const ok = await ctx.dialog.confirm(linked ? 'Forget this folder?' : 'Move to the trash?', linked ? `${name} leaves the list; its folder stays where it is.` : `${name} moves to form.ext's trash folder.`, 'Remove');
      if (!ok) return;
      try {
        await ctx.api.del(`/api/projects/${encodeURIComponent(r.dataset.id!)}`);
      } catch (err) {
        ctx.notify(errorMessage(err), 'error');
      }
      return;
    }
    try {
      await openProject(r.dataset.id!);
    } catch (err) {
      ctx.notify(errorMessage(err), 'error');
    }
  });

  list.addEventListener('keydown', (ev) => {
    const r = (ev.target as HTMLElement).closest<HTMLElement>('.home-row');
    if (r && (ev.key === 'Enter' || ev.key === ' ') && ev.target === r) {
      ev.preventDefault();
      openProject(r.dataset.id!).catch((err) => ctx.notify(errorMessage(err), 'error'));
    }
  });

  ctx.commands.register({ id: 'home.open-folder', title: 'Open Folder', keys: 'Mod+Shift+O', run: openFolder });
  ctx.commands.register({ id: 'home.import', title: 'Import .formpkg', run: importPackage });

  let timer = 0;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(loadRecent, 250);
  };
  const offs = [
    ctx.events.on('project.created', later),
    ctx.events.on('project.deleted', later),
    ctx.events.on('project.changed', (d: { kind?: string; manifest?: unknown }) => d?.manifest !== undefined && later()),
    ctx.events.on('shell.project', later),
    ctx.events.on('live.status', (d: { connected?: boolean }) => d?.connected && later()),
  ];

  setText(q('.home-version'), `v${VERSION}`);
  loadRecent();
  loadExamples();
  return () => {
    clearTimeout(timer);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = { id: 'home', title: 'Home', icon: 'home', order: 0, group: 'make', mount };
