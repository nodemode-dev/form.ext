import './check.css';
import { icon, esc, setText, storage, productName, keyLabel, chooseProject, errorMessage, emit } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';

type Severity = 'error' | 'warning' | 'info';
type Filter = 'all' | Severity;

interface Problem {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  column: number;
  message: string;
  fix: string;
  path: string;
}

interface Result {
  ok: boolean;
  counts: Record<Severity, number>;
  problems: Problem[];
  files: number;
  bytes: number;
  manifest: string;
  checked_at: number;
  ms: number;
  project: string;
}

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  text: string;
}

const AUTO_KEY = 'formext.check.auto';
const FILTER_KEY = 'formext.check.filter';
const RUN_KEYS = 'F7';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
  { id: 'info', label: 'Info' },
];

function keyOf(p: Problem): string {
  return `${p.rule}|${p.file}|${p.line}|${p.column}|${p.message}`;
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  el.innerHTML = `
    <div class="pane-fill check-pane">
      <header class="pane-head">
        <span class="check-mark">${icon('checklist', 18)}</span>
        <div class="check-title">
          <h1>Check</h1>
          <div class="sub check-sub">&nbsp;</div>
        </div>
        <div class="actions">
          <label class="switch check-auto" title="Check again whenever a file of the project is saved"><input type="checkbox" /><span>Check on save</span></label>
          <button class="btn primary check-run" type="button">${icon('refresh')}<span>Check</span><kbd>${keyLabel(RUN_KEYS).join('+')}</kbd></button>
        </div>
      </header>
      <div class="toolbar check-bar">
        <div class="btn-group check-filters" role="group" aria-label="Show">
          ${FILTERS.map((f) => `<button class="chip check-filter" type="button" data-filter="${f.id}" aria-pressed="false">${f.id === 'all' ? '' : icon(f.id, 12)}<span>${f.label}</span><span class="check-count">0</span></button>`).join('')}
        </div>
        <span class="check-meta">&nbsp;</span>
        <button class="btn ghost sm check-rules-toggle" type="button" aria-expanded="false">${icon('list')}<span>Rules</span></button>
      </div>
      <div class="pane-body check-body">
        <div class="notice check-status" role="status"><span class="check-status-icon">${icon('info')}</span><span class="check-status-text">&nbsp;</span></div>
        <div class="check-groups"></div>
        <div class="empty check-none hidden">${icon('folder')}<h3>No project open</h3><p>Open a project to check its manifest against the contract and lint its code.</p><div class="btn-group"><button class="btn check-open" type="button">${icon('folder-open')}<span>Open Project</span></button><button class="btn ghost check-new" type="button">${icon('new')}<span>New Extension</span></button></div></div>
        <div class="empty check-clean hidden">${icon('success')}<h3>No problems</h3><p class="check-clean-text">&nbsp;</p></div>
        <div class="empty check-filtered hidden">${icon('search')}<h3>Nothing to show</h3><p>No problems of this kind. Choose All to see the rest.</p></div>
        <section class="section check-rules hidden">
          <div class="section-title">What Check looks for</div>
          <table class="table check-rules-table"><thead><tr><th>Rule</th><th>Severity</th><th>What it means</th></tr></thead><tbody></tbody></table>
        </section>
      </div>
    </div>`;

  const sub = el.querySelector<HTMLElement>('.check-sub')!;
  const runBtn = el.querySelector<HTMLButtonElement>('.check-run')!;
  const auto = el.querySelector<HTMLInputElement>('.check-auto input')!;
  const meta = el.querySelector<HTMLElement>('.check-meta')!;
  const status = el.querySelector<HTMLElement>('.check-status')!;
  const statusIcon = el.querySelector<HTMLElement>('.check-status-icon')!;
  const statusText = el.querySelector<HTMLElement>('.check-status-text')!;
  const groupsEl = el.querySelector<HTMLElement>('.check-groups')!;
  const none = el.querySelector<HTMLElement>('.check-none')!;
  const clean = el.querySelector<HTMLElement>('.check-clean')!;
  const cleanText = el.querySelector<HTMLElement>('.check-clean-text')!;
  const filtered = el.querySelector<HTMLElement>('.check-filtered')!;
  const rulesBtn = el.querySelector<HTMLButtonElement>('.check-rules-toggle')!;
  const rulesSection = el.querySelector<HTMLElement>('.check-rules')!;
  const rulesBody = el.querySelector<HTMLElement>('.check-rules-table tbody')!;
  const filterBtns = [...el.querySelectorAll<HTMLButtonElement>('.check-filter')];

  const groups = new Map<string, { el: HTMLElement; list: HTMLElement; count: HTMLElement }>();
  const rows = new Map<string, HTMLElement>();
  const collapsed = new Set<string>();
  let filter: Filter = (storage.get(FILTER_KEY) as Filter) || 'all';
  if (!FILTERS.some((f) => f.id === filter)) filter = 'all';
  let result: Result | null = null;
  let running = false;
  let again = false;
  let timer = 0;
  let statusLevel = '';
  let rulesLoaded = false;

  auto.checked = storage.get(AUTO_KEY) !== '0';

  function setStatus(level: 'info' | 'success' | 'warning' | 'error', text: string, busy = false): void {
    const key = busy ? 'busy' : level;
    if (statusLevel !== key) {
      status.className = `notice check-status ${level}`;
      statusIcon.innerHTML = busy ? '<span class="spinner"></span>' : icon(level === 'success' ? 'success' : level);
      statusLevel = key;
    }
    setText(statusText, text);
  }

  function renderFilters(): void {
    for (const b of filterBtns) {
      const id = b.dataset.filter as Filter;
      b.setAttribute('aria-pressed', String(id === filter));
      const n = !result ? 0 : id === 'all' ? result.problems.length : result.counts[id as Severity];
      setText(b.querySelector('.check-count'), String(n));
    }
  }

  function rowFor(p: Problem): HTMLElement {
    const key = keyOf(p);
    let row = rows.get(key);
    if (!row) {
      const btn = document.createElement('button');
      btn.type = 'button';
      row = btn;
      row.className = `check-row ${p.severity}`;
      row.dataset.key = key;
      const where = p.line ? `${p.line}${p.column ? `:${p.column}` : ''}` : '';
      row.title = p.line ? `Open ${p.file} at line ${p.line}` : `Open ${p.file}`;
      row.innerHTML = `<span class="check-sev">${icon(p.severity, 14)}</span><span class="check-text"><span class="check-msg">${esc(p.message)}</span><span class="check-fix">${esc(p.fix)}</span></span><span class="check-where">${where ? `<span class="check-line">${esc(where)}</span>` : ''}<span class="check-rule">${esc(p.rule)}</span><span class="btn sm check-open-line">Open line</span></span>`;
      row.querySelector<HTMLElement>('.check-fix')!.classList.toggle('hidden', !p.fix);
      row.addEventListener('click', () => ctx.openPane('studio', { path: p.file, line: p.line || 1, column: p.column || 1, from: 'check', rule: p.rule }));
      rows.set(key, row);
    }
    return row;
  }

  function groupFor(file: string): { el: HTMLElement; list: HTMLElement; count: HTMLElement } {
    let g = groups.get(file);
    if (!g) {
      const wrap = document.createElement('section');
      wrap.className = 'check-group';
      wrap.dataset.file = file;
      wrap.innerHTML = `<button class="check-group-head" type="button" aria-expanded="true"><span class="check-caret">${icon('chevron-down', 14)}</span>${icon('file', 14)}<span class="check-file">${esc(file || 'package')}</span><span class="badge check-group-count">0</span></button><div class="check-group-list"></div>`;
      const head = wrap.querySelector<HTMLButtonElement>('.check-group-head')!;
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(open));
        if (open) collapsed.delete(file);
        else collapsed.add(file);
      });
      if (collapsed.has(file)) head.setAttribute('aria-expanded', 'false');
      g = { el: wrap, list: wrap.querySelector<HTMLElement>('.check-group-list')!, count: wrap.querySelector<HTMLElement>('.check-group-count')! };
      groups.set(file, g);
    }
    return g;
  }

  function renderList(): void {
    const project = ctx.project.current();
    none.classList.toggle('hidden', !!project);
    const shown = result && project ? result.problems.filter((p) => filter === 'all' || p.severity === filter) : [];
    const byFile = new Map<string, Problem[]>();
    for (const p of shown) {
      const list = byFile.get(p.file) ?? [];
      list.push(p);
      byFile.set(p.file, list);
    }
    const keepGroups = new Set(byFile.keys());
    const keepRows = new Set(shown.map(keyOf));
    for (const [file, g] of groups) {
      if (!keepGroups.has(file)) {
        g.el.remove();
        groups.delete(file);
      }
    }
    for (const [key, row] of rows) {
      if (!keepRows.has(key)) {
        row.remove();
        rows.delete(key);
      }
    }
    let gi = 0;
    for (const [file, list] of byFile) {
      const g = groupFor(file);
      if (groupsEl.children[gi] !== g.el) groupsEl.insertBefore(g.el, groupsEl.children[gi] ?? null);
      setText(g.count, String(list.length));
      g.count.dataset.severity = list.some((p) => p.severity === 'error') ? 'error' : list.some((p) => p.severity === 'warning') ? 'warning' : 'info';
      list.forEach((p, ri) => {
        const row = rowFor(p);
        if (g.list.children[ri] !== row) g.list.insertBefore(row, g.list.children[ri] ?? null);
      });
      gi++;
    }
    const total = result?.problems.length ?? 0;
    clean.classList.toggle('hidden', !project || !result || total > 0);
    filtered.classList.toggle('hidden', !project || !result || total === 0 || shown.length > 0);
    if (result) setText(cleanText, `The manifest follows the contract and the code passes every lint rule (${plural(result.files, 'file')}, ${sizeText(result.bytes)}). It is ready to package.`);
  }

  function renderHead(): void {
    const project = ctx.project.current();
    runBtn.disabled = !project || running;
    auto.disabled = !project;
    if (!project) {
      setText(sub, 'No project open');
      setText(meta, '');
      setStatus('info', 'Open a project to check it.');
      return;
    }
    setText(sub, `${project.name} · ${productName(project.product) || project.product || 'no product'}`);
    if (!result) {
      setText(meta, '');
      if (running) setStatus('info', 'Checking...', true);
      return;
    }
    const at = new Date(result.checked_at * 1000);
    setText(meta, `${plural(result.files, 'file')} · ${sizeText(result.bytes)} · ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${result.ms} ms`);
    const { error, warning, info } = result.counts;
    if (running) setStatus('info', 'Checking...', true);
    else if (error) setStatus('error', `${plural(error, 'error')}${warning ? `, ${plural(warning, 'warning')}` : ''}${info ? `, ${info} info` : ''}. Hosts refuse the extension or parts of it will not run until the errors are fixed.`);
    else if (warning) setStatus('warning', `No errors, ${plural(warning, 'warning')}${info ? ` and ${info} info` : ''}. The extension loads; the warnings say what will not work as you expect.`);
    else if (info) setStatus('success', `No errors or warnings, ${info} info.`);
    else setStatus('success', 'No problems found.');
  }

  function render(): void {
    renderHead();
    renderFilters();
    renderList();
  }

  async function run(): Promise<void> {
    const project = ctx.project.current();
    if (!project) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    renderHead();
    try {
      const out = await ctx.api.post<Result>(`/api/projects/${encodeURIComponent(project.id)}/validate`);
      if (ctx.project.current()?.id === project.id) result = out;
      running = false;
      render();
      emit('check.result', result);
    } catch (err) {
      running = false;
      renderHead();
      setStatus('error', `Check could not run: ${errorMessage(err)}`);
    }
    if (again) {
      again = false;
      void run();
    }
  }

  function schedule(ms = 500): void {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(), ms);
  }

  async function loadRules(): Promise<void> {
    if (rulesLoaded) return;
    rulesLoaded = true;
    try {
      const { rules } = await ctx.api.get<{ rules: Rule[] }>('/api/validate/rules');
      rulesBody.innerHTML = rules.map((r) => `<tr><td><span class="chip">${esc(r.id)}</span><div class="check-rule-title">${esc(r.title)}</div></td><td><span class="chip ${r.severity}">${icon(r.severity, 12)}${esc(r.severity)}</span></td><td>${esc(r.text)}</td></tr>`).join('');
    } catch (err) {
      rulesLoaded = false;
      rulesBody.innerHTML = `<tr><td colspan="3">${esc(errorMessage(err))}</td></tr>`;
    }
  }

  runBtn.addEventListener('click', () => void run());
  auto.addEventListener('change', () => {
    storage.set(AUTO_KEY, auto.checked ? '1' : '0');
    if (auto.checked) void run();
  });
  for (const b of filterBtns) {
    b.addEventListener('click', () => {
      filter = b.dataset.filter as Filter;
      storage.set(FILTER_KEY, filter);
      renderFilters();
      renderList();
    });
  }
  rulesBtn.addEventListener('click', () => {
    const open = rulesSection.classList.contains('hidden');
    rulesSection.classList.toggle('hidden', !open);
    rulesBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      void loadRules();
      rulesSection.scrollIntoView({ block: 'nearest' });
    }
  });
  el.querySelector('.check-open')!.addEventListener('click', () => void chooseProject());
  el.querySelector('.check-new')!.addEventListener('click', () => ctx.openPane('new'));

  ctx.commands.register({
    id: 'check.run',
    title: 'Check Project',
    keys: RUN_KEYS,
    run: () => {
      ctx.openPane('check');
      return run();
    },
  });

  const offs = [
    ctx.project.onChange((p: ProjectRef | null) => {
      if (result && (!p || result.project !== p.id)) {
        result = null;
        emit('check.result', null);
      }
      render();
      if (p) void run();
    }),
    ctx.events.on('project.changed', (d: { id?: string }) => {
      if (auto.checked && d?.id && d.id === ctx.project.current()?.id) schedule();
    }),
    ctx.events.on('validate.done', (d: { id?: string; checked_at?: number }) => {
      if (running || !d?.id || d.id !== ctx.project.current()?.id) return;
      if (result && d.checked_at === result.checked_at) return;
      schedule(50);
    }),
    ctx.events.on('pane.open', (d: { id?: string; args?: { run?: boolean } }) => {
      if (d?.id === 'check' && d.args?.run) void run();
    }),
  ];

  render();
  if (ctx.project.current()) void run();

  return () => {
    window.clearTimeout(timer);
    for (const off of offs) off();
  };
}

export const pane: PaneDef = {
  id: 'check',
  title: 'Check',
  icon: 'checklist',
  order: 40,
  group: 'make',
  view: 'part',
  mount,
};
