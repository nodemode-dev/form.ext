import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pane } from '../../../src/panes/new';
import { HOSTS } from '../../../src/shell';
import type { ShellContext } from '../../../src/shell';

vi.mock('../../../src/shell/shell', () => ({
  lastArgs: () => undefined,
  activePane: () => 'new',
  chooseProject: async () => undefined,
  partRoot: () => document.body,
  setStatus: () => undefined,
  setNavCount: () => undefined,
  layoutOf: () => 'start',
}));

const A = HOSTS[0].id;
const B = HOSTS[1].id;

function starter(product: string, id: string, name: string) {
  return {
    product,
    starter: id,
    title: id,
    name,
    summary: 's',
    uses: ['doc.read'],
    description: `${name} description`,
    permissions: id === 'command' ? [] : ['document', 'network'],
    panels: id === 'command' ? [] : [{ id: 'main', title: 'Main Panel', location: 'dock' }],
    commands: id === 'panel' ? [] : [{ id: 'go', title: 'Go Now' }],
  };
}

function catalogue() {
  return {
    starters: [],
    products: [A, B].map((p) => ({
      id: p,
      name: p,
      docs: null,
      starters: ['panel', 'command', 'panel-commands'].map((s) => starter(p, s, `${p} ${s} kit`)),
    })),
  };
}

interface Harness {
  el: HTMLElement;
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
  openPane: ReturnType<typeof vi.fn>;
  fire: (name: string, data: unknown) => void;
}

function mount(getImpl: () => Promise<unknown>, postImpl: (p: string, body: unknown) => Promise<unknown> = async () => ({ id: 'x', name: 'X' })): Harness {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const listeners = new Map<string, (d: unknown) => void>();
  const get = vi.fn(getImpl);
  const post = vi.fn(postImpl);
  const open = vi.fn(async () => undefined);
  const notify = vi.fn();
  const openPane = vi.fn();
  const ctx = {
    api: { get, post, put: vi.fn(), del: vi.fn() },
    events: { on: (name: string, cb: (d: unknown) => void) => { listeners.set(name, cb); return () => listeners.delete(name); } },
    project: { current: () => null, onChange: () => () => undefined, open },
    notify,
    openPane,
    commands: { register: vi.fn() },
    dialog: { confirm: vi.fn(), form: vi.fn() },
  } as unknown as ShellContext;
  pane.mount(el, ctx);
  return { el, get, post, open, notify, openPane, fire: (n, d) => listeners.get(n)?.(d) };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function q<T extends HTMLElement = HTMLElement>(h: Harness, sel: string): T {
  return h.el.querySelector<T>(sel)!;
}

function submit(h: Harness): void {
  q<HTMLFormElement>(h, '.new-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function type(h: Harness, value: string): void {
  const input = q<HTMLInputElement>(h, '#new-name');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('new extension pane', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('asks the engine for the starter catalogue once when it mounts', async () => {
    const h = mount(async () => catalogue());
    await settle();
    expect(h.get).toHaveBeenCalledTimes(1);
    expect(h.get).toHaveBeenCalledWith('/api/templates');
  });

  it('offers one app choice for every host app', async () => {
    const h = mount(async () => catalogue());
    const ids = [...h.el.querySelectorAll<HTMLElement>('.new-app')].map((b) => b.dataset.product);
    expect(ids).toEqual(HOSTS.map((p) => p.id));
  });

  it('keeps Create disabled until the catalogue has arrived', async () => {
    let release: (v: unknown) => void = () => undefined;
    const h = mount(() => new Promise((r) => { release = r; }));
    type(h, 'My Tool');
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(true);
    release(catalogue());
    await settle();
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(false);
  });

  it('fills the name field and detail card from the chosen starter in the engine answer', async () => {
    const h = mount(async () => catalogue());
    await settle();
    expect(q<HTMLInputElement>(h, '#new-name').value).toBe(`${A} panel kit`);
    expect(q(h, '.new-detail-title').textContent).toBe(`${A} panel kit for ${HOSTS[0].name}`);
    expect(q(h, '.new-detail-sub').textContent).toBe(`${A} panel kit description`);
  });

  it('lists each permission of the starter with a plain sentence', async () => {
    const h = mount(async () => catalogue());
    await settle();
    const items = [...h.el.querySelectorAll('.new-perms li')].map((li) => li.textContent);
    expect(items).toEqual(['documentread and change the open document', 'networkreach the internet']);
  });

  it('says nothing needs consent for a starter without permissions', async () => {
    const h = mount(async () => catalogue());
    await settle();
    q(h, '[data-starter="command"]').click();
    expect(q(h, '.new-perms').textContent).toBe('Nothing that needs consent');
    expect(q(h, '.new-adds').textContent).toContain('Command Go Now, runs headless');
  });

  it('shows panel and command counts on each starter card', async () => {
    const h = mount(async () => catalogue());
    await settle();
    const chips = [...h.el.querySelectorAll('[data-starter="panel-commands"] .chip')].map((c) => c.textContent);
    expect(chips).toEqual(['1 panel', '1 command', 'document', 'network']);
  });

  it('marks only the clicked app as checked and follows it with the starter name', async () => {
    const h = mount(async () => catalogue());
    await settle();
    q(h, `.new-app[data-product="${B}"]`).click();
    const checked = [...h.el.querySelectorAll<HTMLElement>('.new-app[aria-checked="true"]')].map((b) => b.dataset.product);
    expect(checked).toEqual([B]);
    expect(q<HTMLInputElement>(h, '#new-name').value).toBe(`${B} panel kit`);
  });

  it('keeps a name the user typed when another starter is chosen', async () => {
    const h = mount(async () => catalogue());
    await settle();
    type(h, 'Shelf Sorter');
    q(h, '[data-starter="command"]').click();
    expect(q<HTMLInputElement>(h, '#new-name').value).toBe('Shelf Sorter');
  });

  it('shows the id made from the typed name in lower case with dashes', async () => {
    const h = mount(async () => catalogue());
    await settle();
    type(h, '  Shelf   Sorter 2! ');
    expect(q(h, '.new-id').textContent).toBe('Id shelf-sorter-2 (a number is added if a project has it already)');
  });

  it('sends no request and disables Create when the name is empty', async () => {
    const h = mount(async () => catalogue());
    await settle();
    type(h, '   ');
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(true);
    submit(h);
    await settle();
    expect(h.post).not.toHaveBeenCalled();
    expect(q(h, '.new-id').textContent).toBe('The id is made from the name.');
  });

  it('sends the chosen app, starter, trimmed name and description when Create is pressed', async () => {
    const h = mount(async () => catalogue());
    await settle();
    q(h, `.new-app[data-product="${B}"]`).click();
    q(h, '[data-starter="command"]').click();
    type(h, '  Shelf Sorter ');
    q<HTMLTextAreaElement>(h, '#new-desc').value = ' Sorts shelves. ';
    submit(h);
    await settle();
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(h.post).toHaveBeenCalledWith('/api/templates/create', { product: B, starter: 'command', name: 'Shelf Sorter', description: 'Sorts shelves.' });
  });

  it('leaves the description out of the request when it is empty', async () => {
    const h = mount(async () => catalogue());
    await settle();
    submit(h);
    await settle();
    const body = h.post.mock.calls[0][1] as Record<string, unknown>;
    expect(body.description).toBeUndefined();
    expect(body.name).toBe(`${A} panel kit`);
  });

  it('opens the made project and goes to the studio after the engine answers', async () => {
    const h = mount(async () => catalogue(), async () => ({ id: 'shelf-sorter', name: 'Shelf Sorter' }));
    await settle();
    submit(h);
    await settle();
    expect(h.open).toHaveBeenCalledWith('shelf-sorter');
    expect(h.openPane).toHaveBeenCalledWith('studio', { path: 'package/ui/app.js', from: 'new' });
    expect(h.notify.mock.calls[0][0]).toContain('Shelf Sorter is ready');
    expect(h.notify.mock.calls[0][1]).toBe('success');
  });

  it('shows the engine refusal as a sentence and does not open anything', async () => {
    const h = mount(async () => catalogue(), async () => { throw new Error('The name is already taken by another project.'); });
    await settle();
    submit(h);
    await settle();
    expect(q(h, '.new-msg').textContent).toBe('The name is already taken by another project.');
    expect(h.notify).toHaveBeenCalledWith('The name is already taken by another project.', 'error');
    expect(h.open).not.toHaveBeenCalled();
    expect(h.openPane).not.toHaveBeenCalled();
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(false);
  });

  it('does not send a second request while the first is still being written', async () => {
    let release: (v: unknown) => void = () => undefined;
    const h = mount(async () => catalogue(), () => new Promise((r) => { release = r; }));
    await settle();
    submit(h);
    submit(h);
    await settle();
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(q(h, '.new-msg').textContent).toBe('Writing the project');
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(true);
    release({ id: 'a', name: 'A' });
    await settle();
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(false);
  });

  it('says the starters could not be read when the catalogue request fails', async () => {
    const h = mount(async () => { throw new Error('The engine is not reachable.'); });
    await settle();
    expect(q(h, '.new-msg').textContent).toBe('The starters could not be read: The engine is not reachable.');
    expect(q<HTMLButtonElement>(h, '.new-create').disabled).toBe(true);
  });

  it('remembers the chosen app and starter for the next time the pane is mounted', async () => {
    const first = mount(async () => catalogue());
    await settle();
    q(first, `.new-app[data-product="${B}"]`).click();
    q(first, '[data-starter="panel-commands"]').click();
    const second = mount(async () => catalogue());
    await settle();
    expect(q(second, '.new-app[aria-checked="true"]').dataset.product).toBe(B);
    expect(q(second, '.new-starter[aria-checked="true"]').dataset.starter).toBe('panel-commands');
  });

  it('takes app, starter and name from the arguments the pane is opened with', async () => {
    const h = mount(async () => catalogue());
    await settle();
    h.fire('pane.open', { id: 'new', args: { product: B, starter: 'command', name: 'From Docs' } });
    expect(q<HTMLInputElement>(h, '#new-name').value).toBe('From Docs');
    expect(q(h, '.new-app[aria-checked="true"]').dataset.product).toBe(B);
    expect(q(h, '.new-starter[aria-checked="true"]').dataset.starter).toBe('command');
  });

  it('ignores an open event meant for another pane', async () => {
    const h = mount(async () => catalogue());
    await settle();
    h.fire('pane.open', { id: 'docs', args: { product: B, name: 'Other' } });
    expect(q(h, '.new-app[aria-checked="true"]').dataset.product).toBe(A);
    expect(q<HTMLInputElement>(h, '#new-name').value).toBe(`${A} panel kit`);
  });

  it('keeps the same card and field nodes when choices change', async () => {
    const h = mount(async () => catalogue());
    const card = q(h, '[data-starter="panel"]');
    const input = q(h, '#new-name');
    const detail = q(h, '.new-detail');
    await settle();
    q(h, `.new-app[data-product="${B}"]`).click();
    q(h, '[data-starter="command"]').click();
    expect(q(h, '[data-starter="panel"]')).toBe(card);
    expect(q(h, '#new-name')).toBe(input);
    expect(q(h, '.new-detail')).toBe(detail);
    expect(card.isConnected).toBe(true);
  });
});
