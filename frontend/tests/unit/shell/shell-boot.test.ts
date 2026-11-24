import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const page = readFileSync(here('../../../index.html'), 'utf8');
const contractMd = readFileSync(here('../../../../contract/CONTRACT.md'), 'utf8');
const manualMd = readFileSync(here('../../../../docs/MANUAL.md'), 'utf8');

const REGISTRY = {
  url: 'https://registry.example.org/index.json', url_source: 'default', name: 'Example', verified: true, key: 'k1', keys: 1, note: '', offline: null,
  fetched_at: 1700000000, sha256: 'a'.repeat(64), registry_commit: 'abcdef1234567', publishers: [],
  extensions: [
    { id: 'org.example.tidal', name: 'Tidal Grid', product: 'formmd', version: '1.0.0', kind: 'extension', author: 'Ada', licence: 'MIT', description: 'Grid for tides', permissions: [{ id: 'document', words: 'Read and change the open document' }], verified: true, listed_verified: true, source: 'registry', registry_commit: 'abcdef1', url: 'https://registry.example.org/a.formpkg', sha256: 'b'.repeat(64), bytes: 2048, signed_by: null, imported: [] },
    { id: 'org.example.beats', name: 'Beat Markers', product: 'formwav', version: '2.1.0', kind: 'extension', author: 'Grace', licence: 'MIT', description: 'Markers on beats', permissions: [], verified: true, listed_verified: true, source: 'registry', registry_commit: 'abcdef1', url: 'https://registry.example.org/b.formpkg', sha256: 'c'.repeat(64), bytes: 4096, signed_by: null, imported: [] },
  ],
};

const RECENT = { projects: [{ id: 'p1', name: 'Golden Hour', product: 'formvis', version: '0.3.0', dir: '/tmp/golden-hour', linked: false, manifest: {} }] };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function route(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input instanceof Request ? input.url : input), 'http://localhost');
  const p = url.pathname;
  if (p === '/api/health') return json({ version: '7.7.7' });
  if (p === '/api/projects/recent') return json(RECENT);
  if (p === '/api/projects') return json([]);
  if (p === '/api/library/registry') return json(REGISTRY);
  return json({ detail: 'Not found' }, 404);
}

class QuietSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: unknown = null;
  onclose: unknown = null;
  onmessage: unknown = null;
  onerror: unknown = null;
  constructor(public url: string) {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}

function headings(md: string, level: number): string[] {
  const mark = '#'.repeat(level) + ' ';
  const out: string[] = [];
  let fence = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) fence = !fence;
    else if (!fence && line.startsWith(mark)) out.push(line.slice(mark.length).replace(/`/g, '').trim());
  }
  return out;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

async function until(check: () => boolean, tries = 40) {
  for (let i = 0; i < tries && !check(); i++) await tick(10);
}

let shell: typeof import('../../../src/shell/shell');
let VERSION = '';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(route));
  vi.stubGlobal('WebSocket', QuietSocket);
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.body.innerHTML = page.slice(page.indexOf('<body>') + 6, page.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  shell = await import('../../../src/shell/shell');
  VERSION = (await import('../../../src/shell/version')).VERSION;
  shell.boot();
  await until(() => document.querySelector('[data-status="engine"]')?.getAttribute('data-state') === 'up');
});

const pane = (id: string) => document.querySelector<HTMLElement>(`.fx-pane[data-pane="${id}"]`) ?? shell.partRoot(id)!;
const nav = (key: string) => document.querySelector<HTMLButtonElement>(`.fx-nav[data-nav="${key}"]`)!;

describe('shell boot', () => {
  it('opens on Home when there is no hash and no remembered pane', () => {
    expect(shell.activePane()).toBe('home');
    expect(pane('home').classList.contains('active')).toBe(true);
    expect(nav('home').getAttribute('aria-current')).toBe('page');
  });

  it('builds one section per discovered pane, labelled with its title', () => {
    const defs = shell.panes();
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) expect(pane(d.id).getAttribute('aria-label')).toBe(d.title);
    expect(document.querySelectorAll('.fx-main > .fx-pane').length).toBe(defs.length);
  });

  it('shows its own version and the engine version from the health route in the status bar', () => {
    expect(document.querySelector('[data-status="version"]')!.textContent).toBe(`v${VERSION}`);
    const engine = document.querySelector('[data-status="engine"]')!;
    expect(engine.getAttribute('data-state')).toBe('up');
    expect(engine.textContent).toContain('Engine 7.7.7');
    expect(document.querySelector('[data-status="project"]')!.textContent).toContain('No project');
  });

  it('lists recent projects on Home and counts them in the sidebar', async () => {
    await until(() => pane('home').textContent!.includes('Golden Hour'));
    expect(pane('home').textContent).toContain('Golden Hour');
    expect(nav('recent').querySelector('.cnt')!.textContent).toBe(String(RECENT.projects.length));
  });

  it('says how many apps Home can make extensions for and that it speaks API 1', async () => {
    const { HOSTS } = await import('../../../src/shell/products');
    expect(pane('home').querySelector('.home-start-meta')!.textContent).toBe(`${HOSTS.length} apps \u00b7 Extension API 1`);
    expect(pane('home').querySelectorAll('.home-start-apps > *').length).toBe(HOSTS.length);
  });

  it('warns in a toast when asked for a pane that does not exist and stays put', async () => {
    shell.openPane('nowhere');
    await tick();
    expect(document.querySelector('.fx-toasts')!.textContent).toContain('There is no nowhere pane.');
    expect(shell.activePane()).toBe('home');
  });
});

describe('docs pane through the shell', () => {
  it('opens from the sidebar and updates the hash, the title and the current nav', () => {
    nav('docs').click();
    expect(shell.activePane()).toBe('docs');
    expect(location.hash).toBe('#/docs');
    expect(document.title).toBe('Docs - form.ext');
    expect(nav('docs').getAttribute('aria-current')).toBe('page');
    expect(nav('home').getAttribute('aria-current')).toBeNull();
    expect(pane('home').classList.contains('active')).toBe(false);
  });

  it('renders the extension contract with its own title and section headings', async () => {
    shell.openPane('docs', { doc: 'contract' });
    await tick();
    const el = pane('docs');
    expect(el.querySelector('.docs-article h1')!.textContent!.replace(/#/g, '').trim()).toBe(headings(contractMd, 1)[0]);
    expect(el.querySelector('.docs-file-path')!.textContent).toBe('contract/CONTRACT.md');
    const shown = [...el.querySelectorAll('.docs-article h2')].map((h) => h.textContent!.replace(/#/g, '').trim());
    expect(shown).toEqual(headings(contractMd, 2));
    expect(el.querySelector('.docs-nav-row[data-doc="contract"]')!.getAttribute('aria-selected')).toBe('true');
  });

  it('opens the manual from Help in the sidebar footer', async () => {
    nav('help').click();
    await tick();
    const el = pane('docs');
    expect(el.querySelector('.docs-file-path')!.textContent).toBe('docs/MANUAL.md');
    expect(el.querySelector('.docs-article h1')!.textContent!.replace(/#/g, '').trim()).toBe(headings(manualMd, 1)[0]);
  });

  it('lists one docs row per host app under App APIs', async () => {
    const { HOSTS } = await import('../../../src/shell/products');
    const rows = [...pane('docs').querySelectorAll<HTMLElement>('.docs-nav-row')].map((r) => r.dataset.doc);
    for (const h of HOSTS) expect(rows).toContain(h.id);
  });

  it('highlights search matches for a word the contract uses', async () => {
    shell.openPane('docs', { doc: 'contract', query: 'sandbox' });
    await until(() => /\d/.test(pane('docs').querySelector('.docs-search-count')!.textContent ?? ''));
    const count = pane('docs').querySelector('.docs-search-count')!.textContent!;
    const n = Number(count.match(/\d+/)![0]);
    expect(n).toBeGreaterThan(0);
  });
});

const lib = () => document.querySelector<HTMLElement>('.library-pane')!;

describe('library pane through the shell', () => {
  it('opens from Registry in the sidebar and shows the registry extensions by name', async () => {
    nav('registry').click();
    await until(() => lib().textContent!.includes('Beat Markers'));
    expect(shell.layoutOf('library')).toBe('studio');
    expect(document.documentElement.dataset.layout).toBe('studio');
    expect(lib().querySelector('h1')!.textContent).toBe('Library');
    expect(lib().textContent).toContain('Tidal Grid');
    expect(lib().textContent).toContain('Beat Markers');
    const cards = [...lib().querySelectorAll<HTMLElement>('.lib-ex')].map((c) => c.dataset.key);
    expect(cards).toEqual(REGISTRY.extensions.map((x) => x.id));
    const tidal = lib().querySelector('.lib-ex[data-key="org.example.tidal"]')!;
    expect(tidal.textContent).toContain('Read and change the open document');
    expect(tidal.querySelector('.lib-verified')).not.toBeNull();
  });

  it('says where the registry index came from and that its signature was verified', () => {
    const status = lib().querySelector('.lib-reg-status')!.textContent!;
    expect(status).toContain(REGISTRY.url);
    expect(status).toContain('signature verified with registry key k1');
    expect(status).toMatch(/^2 extensions/);
  });
});

describe('theme toggle', () => {
  it('flips between light and dark and relabels the button', () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-action="theme"]')!;
    const before = btn.title;
    btn.click();
    const after = btn.title;
    expect(new Set([before, after])).toEqual(new Set(['Light theme', 'Dark theme']));
    btn.click();
    expect(btn.title).toBe(before);
  });
});
