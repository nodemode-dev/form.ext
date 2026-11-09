import './home.css';
import { icon, appIcon, HOSTS, productName, esc, errorMessage, chooseProject, setNavCount } from '../../shell';
import type { PaneDef, ShellContext } from '../../shell';
import { DEMOS } from '../../demo/mode';
import { openDemo, closeDemo } from '../../demo/commands';

const DEMO_ART = `<svg viewBox="0 0 240 120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="228" height="108" rx="8"/><path d="M6 22h228"/><circle cx="16" cy="14" r="2"/><circle cx="24" cy="14" r="2"/><circle cx="32" cy="14" r="2"/><path d="M62 22v92M168 22v92"/><path d="M14 32h38M20 42h28M20 52h24M20 62h30M14 76h36M20 86h26" opacity=".7"/><path d="M72 34h52M72 44h70M80 54h56M80 64h40M72 74h60M80 84h48M72 94h30" opacity=".85"/><rect x="176" y="32" width="50" height="40" rx="4"/><circle cx="201" cy="58" r="8"/><path d="M181 64c8-10 32-10 40 0"/><path d="M176 82h50M176 92h34M176 102h42" opacity=".7"/></svg>`;

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

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function appName(name: string): string {
  return name.startsWith('Form') ? `Form<span class="sfx">${esc(name.slice(4))}</span>` : esc(name);
}

function hasPane(id: string): boolean {
  return !!document.querySelector(`.fx-pane[data-pane="${id}"]`);
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill home-pane">
      <div class="pane-body home-body">
        <header class="home-hello">
          <h1>${greeting()}</h1>
          <p>Make extensions for every Form app: start from a working project, preview it in a simulated app, check it, then run it in the real one.</p>
        </header>

        <section class="home-start" data-product="formext">
          <div class="home-start-copy">
            <div class="home-start-head"><h2>Make an extension</h2><span class="home-start-meta">${HOSTS.length} apps · Extension API 1</span></div>
            <p>Pick a Form app and a starter. The project already works: it reads the open document and runs a command, with the SDK beside it.</p>
            <div class="home-start-apps">${HOSTS.map((p) => appIcon(p.id)).join('')}</div>
          </div>
          <div class="home-start-tree" aria-hidden="true"><b>golden-hour/</b><span>package/</span><span>manifest.json</span><span>ui/</span><span>index.html</span><span>golden-hour.js</span><span>golden-hour.css</span></div>
          <div class="home-start-act">
            <button class="btn primary lg" type="button" data-act="new">${icon('new')}<span>New Extension</span></button>
            <button class="btn lg" type="button" data-act="folder">${icon('folder-open')}<span>Open Folder</span></button>
            <button class="btn lg" type="button" data-act="import">${icon('import')}<span>Import .formpkg</span></button>
            <a class="home-start-link" href="#/docs" data-act="contract">Read the Extension Contract ${icon('arrow', 14)}</a>
          </div>
        </section>

        <section class="home-demos" aria-label="Demos">
          <div class="home-section-head"><h3>Demos</h3><span class="home-note home-demos-out">Opens in this window, apart from your projects</span><span class="home-note home-demos-in">You are in the demo: these projects are samples</span></div>
          <div class="home-demo-list">
            ${DEMOS.map((d) => `<article class="home-demo" data-demo-id="${esc(d.id)}">
              <div class="home-demo-art" aria-hidden="true">${DEMO_ART}</div>
              <div class="home-demo-body">
                <b>${esc(d.title)}</b>
                <p>${esc(d.line)}</p>
                <div class="home-demo-act">
                  <button class="btn primary home-demos-out" type="button" data-demo-open="${esc(d.id)}">${icon('play')}<span>Open Demo</span></button>
                  <button class="btn home-demos-in" type="button" data-demo-open="${esc(d.id)}">${icon('refresh')}<span>Start Over</span></button>
                  <button class="btn primary home-demos-in" type="button" data-demo-leave>${icon('close')}<span>Leave Demo</span></button>
                </div>
              </div>
            </article>`).join('')}
          </div>
        </section>

        <section class="home-recent">
          <div class="home-section-head"><h3>Recent</h3><button class="btn sm home-all" type="button">See all</button></div>
          <div class="home-cards" aria-busy="true">
            ${Array.from({ length: 3 }, () => '<div class="home-card home-skel"></div>').join('')}
          </div>
        </section>

        <section class="home-apps-section">
          <div class="home-section-head"><h3>Start for an app</h3><span class="home-note">Panel, command, or a panel with commands</span></div>
          <div class="home-apps">
            ${HOSTS.map((p) => `<button class="home-app" type="button" data-product="${p.id}" title="New extension for ${esc(p.name)}">${appIcon(p.id)}<span class="home-app-text"><span class="home-app-name">${appName(p.name)}</span><small>3 starters</small></span></button>`).join('')}
          </div>
        </section>
      </div>
    </div>`;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const list = q('.home-cards');

  async function openProject(id: string): Promise<void> {
    await ctx.project.open(id);
    ctx.openPane('studio');
  }

  function row(p: Project): string {
    const where = p.linked ? esc(p.linked) : esc(p.id);
    const state = p.manifest_error ? '<span class="home-card-bad">manifest.json has an error</span>' : `<span class="home-card-when">${esc(ago(p.opened || p.modified))}</span>`;
    return `<article class="home-card home-row" data-id="${esc(p.id)}" data-product="${esc(p.product)}" tabindex="0">
      <div class="home-card-art">${appIcon(p.product, true)}</div>
      <div class="home-card-body">
        <div class="home-card-title"><b>${esc(p.name)}</b><small><span class="sfx">${esc(productName(p.product))}</span> · ${where}</small></div>
        <div class="home-card-meta"><span class="home-card-ver">${esc(p.version ?? '')}</span>${state}</div>
        <div class="home-card-act"><button class="btn primary home-open" type="button">Open</button><button class="btn ghost icon sm home-remove" type="button" title="${p.linked ? 'Forget this folder' : 'Move to the trash'}" aria-label="Remove">${icon('trash')}</button></div>
      </div>
    </article>`;
  }

  async function loadRecent(): Promise<void> {
    try {
      const { projects } = await ctx.api.get<{ projects: Project[] }>('/api/projects/recent?limit=' + RECENT_ROWS);
      const html = projects.length
        ? projects.map(row).join('')
        : `<div class="home-empty"><div class="empty">${icon('puzzle')}<h3>No projects yet</h3><p>Start one from a starter: every starter uses its app's real API and passes Check.</p></div></div>`;
      if (list.innerHTML !== html) list.innerHTML = html;
      setNavCount('recent', projects.length);
    } catch (err) {
      const html = `<div class="home-empty"><div class="notice error">${icon('error')}<span>${esc(errorMessage(err))}</span></div></div>`;
      if (list.innerHTML !== html) list.innerHTML = html;
    }
    list.removeAttribute('aria-busy');
  }

  async function copyExample(): Promise<void> {
    const r = await ctx.api.get<{ examples: Example[] }>('/api/templates/examples');
    const first = r.examples[0];
    if (!first) return ctx.notify('There is no example in the contract kit.', 'warning');
    const p = await ctx.api.post<Project>(`/api/templates/examples/${encodeURIComponent(first.id)}`, {});
    ctx.notify(`${p.name} copied into a new project`, 'success');
    await openProject(p.id);
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
    else if (name === 'contract') ctx.openPane('docs', { doc: 'contract' });
  }

  el.addEventListener('click', async (ev) => {
    const t = ev.target as HTMLElement;
    const demo = t.closest<HTMLElement>('[data-demo-open]');
    if (demo) return openDemo(demo.dataset.demoOpen!);
    if (t.closest('[data-demo-leave]')) return closeDemo();
    const a = t.closest<HTMLElement>('[data-act]');
    if (a) {
      ev.preventDefault();
      return act(a.dataset.act!);
    }
    const app = t.closest<HTMLElement>('.home-app');
    if (app) return ctx.openPane('new', { product: app.dataset.product });
    if (t.closest('.home-all')) return chooseProject();
    const r = t.closest<HTMLElement>('.home-row');
    if (!r) return;
    if (t.closest('.home-remove')) {
      const name = r.querySelector('b')?.textContent ?? r.dataset.id!;
      const linked = r.querySelector('.home-card-title small')?.textContent?.includes('/') ?? false;
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
  ctx.commands.register({ id: 'home.example', title: 'New Extension from the Hello Example', run: copyExample });

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
    ctx.events.on('pane.open', (d: { id?: string; args?: { section?: string } }) => {
      if (d?.id === 'home' && d.args?.section === 'recent') q('.home-recent').scrollIntoView({ block: 'start' });
    }),
  ];

  loadRecent();
  return () => {
    clearTimeout(timer);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = { id: 'home', title: 'Home', icon: 'home', order: 0, group: 'make', view: 'start', mount };
