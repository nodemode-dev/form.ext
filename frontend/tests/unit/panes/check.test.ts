import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pane } from '../../../src/panes/check';
import type { ShellContext, ProjectRef } from '../../../src/shell';

vi.mock('../../../src/shell/shell', () => ({
  lastArgs: () => undefined,
  activePane: () => 'check',
  chooseProject: async () => undefined,
  partRoot: () => document.body,
  setStatus: () => undefined,
  setNavCount: () => undefined,
  layoutOf: () => 'part',
}));

const PROJECT: ProjectRef = { id: 'shelf sorter', name: 'Shelf Sorter', product: 'none', dir: '/tmp/x', manifest: {} };

function problem(rule: string, severity: string, file: string, line: number, message: string, fix = '') {
  return { rule, severity, file, line, column: 0, message, fix, path: '' };
}

function result(problems: ReturnType<typeof problem>[], checked = 100) {
  const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
  for (const p of problems) counts[p.severity] += 1;
  return { ok: counts.error === 0, counts, problems, files: 3, bytes: 10, manifest: 'manifest.json', checked_at: checked, ms: 4, project: PROJECT.id };
}

interface Harness {
  el: HTMLElement;
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  openPane: ReturnType<typeof vi.fn>;
  fire: (name: string, data: unknown) => void;
  setProject: (p: ProjectRef | null) => void;
}

function mount(project: ProjectRef | null, postImpl: (p: string) => Promise<unknown>, getImpl: () => Promise<unknown> = async () => ({ rules: [] })): Harness {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const listeners = new Map<string, (d: unknown) => void>();
  let current = project;
  let changed: (p: ProjectRef | null) => void = () => undefined;
  const post = vi.fn(postImpl);
  const get = vi.fn(getImpl);
  const openPane = vi.fn();
  const ctx = {
    api: { get, post, put: vi.fn(), del: vi.fn() },
    events: { on: (name: string, cb: (d: unknown) => void) => { listeners.set(name, cb); return () => listeners.delete(name); } },
    project: { current: () => current, onChange: (cb: (p: ProjectRef | null) => void) => { changed = cb; return () => undefined; }, open: vi.fn() },
    notify: vi.fn(),
    openPane,
    commands: { register: vi.fn() },
    dialog: { confirm: vi.fn(), form: vi.fn() },
  } as unknown as ShellContext;
  pane.mount(el, ctx);
  return { el, post, get, openPane, fire: (n, d) => listeners.get(n)?.(d), setProject: (p) => { current = p; changed(p); } };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function q<T extends HTMLElement = HTMLElement>(h: Harness, sel: string): T {
  return h.el.querySelector<T>(sel)!;
}

function shown(h: Harness, sel: string): boolean {
  return !q(h, sel).classList.contains('hidden');
}

const TWO = [
  problem('manifest.id', 'error', 'manifest.json', 3, 'The id has a space in it.', 'Use lower case letters and dashes.'),
  problem('lint.eval', 'warning', 'ui/app.js', 12, 'eval is not allowed.'),
  problem('lint.todo', 'info', 'ui/app.js', 20, 'A note was left in the code.'),
];

describe('check pane', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('says no project is open, disables Check and sends nothing', async () => {
    const h = mount(null, async () => result([]));
    await settle();
    expect(q(h, '.check-sub').textContent).toBe('No project open');
    expect(q(h, '.check-status-text').textContent).toBe('Open a project to check it.');
    expect(shown(h, '.check-none')).toBe(true);
    expect(q<HTMLButtonElement>(h, '.check-run').disabled).toBe(true);
    expect(h.post).not.toHaveBeenCalled();
  });

  it('asks the engine to validate the open project with its id encoded in the address', async () => {
    const h = mount(PROJECT, async () => result([]));
    await settle();
    expect(h.post).toHaveBeenCalledTimes(1);
    expect(h.post.mock.calls[0][0]).toBe('/api/projects/shelf%20sorter/validate');
  });

  it('shows one row per problem grouped under its file with the message and the fix', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    const files = [...h.el.querySelectorAll('.check-group')].map((g) => [g.querySelector('.check-file')!.textContent, g.querySelector('.check-group-count')!.textContent, g.querySelectorAll('.check-row').length]);
    expect(files).toEqual([['manifest.json', '1', 1], ['ui/app.js', '2', 2]]);
    const first = q(h, '.check-row');
    expect(first.querySelector('.check-msg')!.textContent).toBe('The id has a space in it.');
    expect(first.querySelector('.check-fix')!.textContent).toBe('Use lower case letters and dashes.');
    expect(first.querySelector('.check-line')!.textContent).toBe('3');
  });

  it('counts problems of each kind on the filter chips', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    const counts = Object.fromEntries([...h.el.querySelectorAll<HTMLElement>('.check-filter')].map((b) => [b.dataset.filter, b.querySelector('.check-count')!.textContent]));
    expect(counts).toEqual({ all: '3', error: '1', warning: '1', info: '1' });
  });

  it('sums errors, warnings and info in the status sentence', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    expect(q(h, '.check-status-text').textContent).toContain('1 error, 1 warning, 1 info.');
    expect(q(h, '.check-status').classList.contains('error')).toBe(true);
  });

  it('says no problems were found for a clean project', async () => {
    const h = mount(PROJECT, async () => result([]));
    await settle();
    expect(q(h, '.check-status-text').textContent).toBe('No problems found.');
    expect(shown(h, '.check-clean')).toBe(true);
    expect(h.el.querySelectorAll('.check-row')).toHaveLength(0);
  });

  it('shows only warnings when the Warnings filter is pressed and remembers the pressed chip', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    q(h, '.check-filter[data-filter="warning"]').click();
    expect([...h.el.querySelectorAll('.check-msg')].map((m) => m.textContent)).toEqual(['eval is not allowed.']);
    expect(q(h, '.check-filter[data-filter="warning"]').getAttribute('aria-pressed')).toBe('true');
    expect(q(h, '.check-filter[data-filter="all"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('says nothing to show when the filter leaves no problems', async () => {
    const h = mount(PROJECT, async () => result([TWO[0]]));
    await settle();
    q(h, '.check-filter[data-filter="info"]').click();
    expect(shown(h, '.check-filtered')).toBe(true);
    expect(h.el.querySelectorAll('.check-row')).toHaveLength(0);
    q(h, '.check-filter[data-filter="all"]').click();
    expect(shown(h, '.check-filtered')).toBe(false);
    expect(h.el.querySelectorAll('.check-row')).toHaveLength(1);
  });

  it('opens the studio at the file and line of a clicked problem', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    h.el.querySelectorAll<HTMLElement>('.check-row')[1].click();
    expect(h.openPane).toHaveBeenCalledWith('studio', { path: 'ui/app.js', line: 12, column: 1, from: 'check', rule: 'lint.eval' });
  });

  it('keeps the same row node for a problem that is still there after checking again', async () => {
    let answer = result(TWO, 100);
    const h = mount(PROJECT, async () => answer);
    await settle();
    const kept = h.el.querySelectorAll<HTMLElement>('.check-row')[1];
    const group = h.el.querySelectorAll<HTMLElement>('.check-group')[1];
    answer = result([TWO[1]], 200);
    q(h, '.check-run').click();
    await settle();
    expect(h.post).toHaveBeenCalledTimes(2);
    const rows = h.el.querySelectorAll<HTMLElement>('.check-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toBe(kept);
    expect(kept.isConnected).toBe(true);
    expect(h.el.querySelector('.check-group')).toBe(group);
    expect(group.querySelector('.check-group-count')!.textContent).toBe('1');
  });

  it('keeps a file group collapsed when the same problems arrive again', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    const head = q(h, '.check-group-head');
    head.click();
    expect(head.getAttribute('aria-expanded')).toBe('false');
    q(h, '.check-run').click();
    await settle();
    expect(q(h, '.check-group-head')).toBe(head);
    expect(head.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the engine refusal as a sentence when the check cannot run', async () => {
    const h = mount(PROJECT, async () => { throw new Error('The manifest could not be read.'); });
    await settle();
    expect(q(h, '.check-status-text').textContent).toBe('Check could not run: The manifest could not be read.');
    expect(q(h, '.check-status').classList.contains('error')).toBe(true);
    expect(q<HTMLButtonElement>(h, '.check-run').disabled).toBe(false);
  });

  it('fills the rules table from the engine the first time Rules is opened and asks only once', async () => {
    const rules = [{ id: 'manifest.id', severity: 'error', title: 'Id shape', text: 'The id uses lower case letters.' }, { id: 'lint.eval', severity: 'warning', title: 'No eval', text: 'eval is refused by hosts.' }];
    const h = mount(PROJECT, async () => result([]), async () => ({ rules }));
    await settle();
    expect(h.get).not.toHaveBeenCalled();
    q(h, '.check-rules-toggle').click();
    await settle();
    expect(h.get).toHaveBeenCalledWith('/api/validate/rules');
    expect(shown(h, '.check-rules')).toBe(true);
    const cells = [...h.el.querySelectorAll('.check-rules-table tbody tr')].map((r) => [r.querySelector('.check-rule-title')!.textContent, r.querySelectorAll('td')[2].textContent]);
    expect(cells).toEqual([['Id shape', 'The id uses lower case letters.'], ['No eval', 'eval is refused by hosts.']]);
    q(h, '.check-rules-toggle').click();
    q(h, '.check-rules-toggle').click();
    await settle();
    expect(h.get).toHaveBeenCalledTimes(1);
  });

  it('shows a rule text with markup in it as text', async () => {
    const h = mount(PROJECT, async () => result([problem('x', 'error', 'a.js', 1, '<img src=x onerror=1> is bad')]));
    await settle();
    expect(q(h, '.check-msg').textContent).toBe('<img src=x onerror=1> is bad');
    expect(h.el.querySelector('.check-msg img')).toBeNull();
  });

  it('clears the problems and stops showing them when the project is closed', async () => {
    const h = mount(PROJECT, async () => result(TWO));
    await settle();
    h.setProject(null);
    expect(h.el.querySelectorAll('.check-row')).toHaveLength(0);
    expect(q(h, '.check-sub').textContent).toBe('No project open');
    expect(q(h, '.check-filter[data-filter="all"] .check-count').textContent).toBe('0');
  });

  it('runs a check when the pane is opened with the run argument', async () => {
    const h = mount(PROJECT, async () => result([]));
    await settle();
    h.fire('pane.open', { id: 'check', args: { run: true } });
    await settle();
    expect(h.post).toHaveBeenCalledTimes(2);
  });

  it('goes to the New pane from the empty state', async () => {
    const h = mount(null, async () => result([]));
    q(h, '.check-new').click();
    expect(h.openPane).toHaveBeenCalledWith('new');
  });

  it('remembers that automatic checking was switched off', async () => {
    const h = mount(PROJECT, async () => result([]));
    await settle();
    const box = q<HTMLInputElement>(h, '.check-auto input');
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const again = mount(PROJECT, async () => result([]));
    await settle();
    expect(q<HTMLInputElement>(again, '.check-auto input').checked).toBe(false);
  });
});
