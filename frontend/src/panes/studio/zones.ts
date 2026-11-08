import { icon, esc, setText, storage, setStatus, setNavCount, partRoot, output, commandRun, keyLabel } from '../../shell';
import type { ShellContext } from '../../shell';

export interface Zones {
  setLeft(id: 'files' | 'library'): void;
  setRight(id: 'manifest' | 'permissions' | 'check'): void;
  setBottom(id: string, expand?: boolean): void;
  setSplit(on: boolean): void;
  openSheet(id: string): void;
  closeSheet(): void;
  dispose(): void;
}

interface CheckResult {
  counts: { error: number; warning: number; info: number };
  problems: { rule: string; severity: string }[];
  files: number;
  bytes: number;
  checked_at: number;
  ms: number;
  project: string;
}

const GROUPS: { id: string; label: string; rules: string[] | null }[] = [
  { id: 'manifest', label: 'Manifest schema', rules: ['json', 'package', 'schema', 'description', 'unused-permission'] },
  { id: 'host', label: 'Host acceptance', rules: ['host', 'missing-entry', 'missing-file', 'headless-command', 'file-size'] },
  { id: 'sandbox', label: 'Sandbox lint', rules: null },
];

const LEFT_KEY = 'formext.studio.left';
const RIGHT_KEY = 'formext.studio.right';
const BOTTOM_KEY = 'formext.studio.bottom';
const SPLIT_KEY = 'formext.studio.split';
const FOLD_KEY = 'formext.studio.fold';
const SHEETS = new Set(['package', 'run', 'publish']);

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function mountZones(el: HTMLElement, ctx: ShellContext): Zones {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const pane = q('.st-pane');
  const bottom = q('.st-bottom');
  const prev = q('.st-prev');
  let sheetId = '';
  let sheetHome: HTMLElement | null = null;
  let sheetNode: HTMLElement | null = null;

  const sheet = document.createElement('div');
  sheet.className = 'st-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `<div class="st-sheet-card" role="dialog" aria-modal="true"><button class="st-sheet-x" type="button" aria-label="Close">${icon('close', 16)}</button><div class="st-sheet-body"></div></div>`;
  pane.append(sheet);
  const sheetBody = sheet.querySelector<HTMLElement>('.st-sheet-body')!;

  function pick(attr: 'ltab' | 'rtab' | 'btab', body: 'lbody' | 'rbody' | 'bbody', id: string, key: string): void {
    for (const b of el.querySelectorAll<HTMLElement>(`[data-${attr}]`)) b.setAttribute('aria-selected', String(b.dataset[attr] === id));
    for (const b of el.querySelectorAll<HTMLElement>(`[data-${body}]`)) b.classList.toggle('hidden', b.dataset[body] !== id);
    storage.set(key, id);
  }

  function setLeft(id: 'files' | 'library'): void {
    pick('ltab', 'lbody', id, LEFT_KEY);
    q('.st-left').dataset.view = id;
  }

  function setRight(id: 'manifest' | 'permissions' | 'check'): void {
    pick('rtab', 'rbody', id, RIGHT_KEY);
  }

  function setBottom(id: string, expand = true): void {
    pick('btab', 'bbody', id, BOTTOM_KEY);
    q('.st-bacts').classList.toggle('hidden', id !== 'problems');
    if (expand) fold(false);
  }

  function fold(on: boolean): void {
    bottom.classList.toggle('folded', on);
    q('.st-fold').setAttribute('aria-expanded', String(!on));
    storage.set(FOLD_KEY, on ? '1' : '0');
  }

  function setSplit(on: boolean): void {
    prev.hidden = !on;
    pane.classList.toggle('split', on);
    for (const b of el.querySelectorAll<HTMLElement>('[data-tool="split"], [data-tool="preview"]')) b.setAttribute('aria-pressed', String(on));
    for (const b of el.querySelectorAll<HTMLElement>('[data-btab="events"], [data-btab="document"]')) b.hidden = !on;
    const current = q('.st-bottom [aria-selected="true"]').dataset.btab;
    if (!on && (current === 'events' || current === 'document')) setBottom('calls', false);
    storage.set(SPLIT_KEY, on ? '1' : '0');
  }

  function closeSheet(): void {
    if (!sheetId) return;
    if (sheetNode && sheetHome) sheetHome.append(sheetNode);
    sheetId = '';
    sheetNode = null;
    sheetHome = null;
    sheet.hidden = true;
    pane.classList.remove('sheeted');
  }

  function openSheet(id: string): void {
    const root = partRoot(id);
    if (!root) return;
    if (sheetId === id) return;
    closeSheet();
    const node = root.firstElementChild as HTMLElement | null;
    if (!node) return;
    sheetId = id;
    sheetNode = node;
    sheetHome = node.parentElement;
    sheet.dataset.sheet = id;
    sheetBody.append(node);
    sheet.hidden = false;
    pane.classList.add('sheeted');
  }

  sheet.addEventListener('pointerdown', (ev) => {
    if (ev.target === sheet) closeSheet();
  });
  sheet.querySelector('.st-sheet-x')!.addEventListener('click', closeSheet);
  sheet.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      closeSheet();
    }
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !sheet.hidden && !document.querySelector('.fx-dialog.open, .fx-palette.open')) closeSheet();
  });

  const bacts = document.createElement('span');
  bacts.className = 'st-bacts';
  q('.st-bottom .st-ph').insertBefore(bacts, q('.st-fold'));

  const outBody = q('[data-bbody="output"]');
  outBody.innerHTML = '<div class="st-out" role="log"></div><button class="btn ghost sm st-out-clear" type="button" title="Clear the output" aria-label="Clear the output">' + icon('trash', 14) + '</button>';
  const outList = outBody.querySelector<HTMLElement>('.st-out')!;
  const lineHtml = (l: { at: number; source: string; text: string; level: string }) =>
    `<div class="st-out-row ${l.level}"><time>${new Date(l.at).toLocaleTimeString([], { hour12: false })}</time><span class="src">${esc(l.source)}</span><span class="txt">${esc(l.text)}</span></div>`;
  outList.innerHTML = output.all().map(lineHtml).join('');
  output.onWrite((l) => {
    if (!l) outList.innerHTML = '';
    else {
      outList.insertAdjacentHTML('beforeend', lineHtml(l));
      outList.scrollTop = outList.scrollHeight;
    }
  });
  outBody.querySelector('.st-out-clear')!.addEventListener('click', () => output.clear());

  const sum = q('[data-rbody="check"]');
  sum.innerHTML = `
    <div class="st-gh"><span>Last check</span></div>
    <div class="st-sum"><div class="e"><b>-</b><span>errors</span></div><div class="w"><b>-</b><span>warnings</span></div><div class="i"><b>-</b><span>info</span></div></div>
    <p class="st-sum-meta">&nbsp;</p>
    <div class="st-sum-row st-sum-auto"></div>
    <div class="st-gh"><span>What Check reads</span><em>3</em></div>
    <div class="st-reads">${GROUPS.map((g) => `<div class="st-read" data-group="${g.id}">${icon('check', 14)}<span>${g.label}</span><em>not run</em></div>`).join('')}</div>
    <p class="st-note">The same rules a host and its sandbox apply.</p>
    <div class="st-sum-act"></div>`;

  function adopt(): void {
    const lib = partRoot('library');
    if (lib && lib.firstElementChild) q('[data-lbody="library"]').append(lib.firstElementChild);

    const pv = partRoot('preview');
    if (pv) {
      const move = (sel: string, to: HTMLElement) => {
        const node = pv.querySelector<HTMLElement>(sel);
        if (node) {
          node.hidden = false;
          to.append(node);
        }
        return node;
      };
      move('.pv-empty', q('.st-prev-body'));
      move('.pv-stage', q('.st-prev-body'));
      move('.pv-as', q('.st-prev-as'));
      const bar = q('.st-prev-bar');
      const spacer = document.createElement('span');
      spacer.className = 'st-spacer';
      move('.pv-auto', bar);
      move('.pv-mode', bar);
      bar.append(spacer);
      move('.pv-docs', bar);
      move('.pv-reload', bar);
      move('.pv-tabbody[data-tab="log"]', q('[data-bbody="calls"]'));
      move('.pv-tabbody[data-tab="events"]', q('[data-bbody="events"]'));
      move('.pv-tabbody[data-tab="document"]', q('[data-bbody="document"]'));
      move('.pv-tabbody[data-tab="permissions"]', q('[data-rbody="permissions"]'));
      const count = q('[data-bbody="calls"]').querySelector('.pv-log-count');
      if (count) {
        const sync = () => setText(q('[data-btab="calls"] em'), (count.textContent ?? '0').split(' ')[0]);
        new MutationObserver(sync).observe(count, { childList: true, characterData: true, subtree: true });
        sync();
      }
      const app = pv.querySelector('.pv-app') ?? q('.st-prev-body').querySelector('.pv-app');
      if (app) {
        const sync = () => setStatus('host', `${(app.textContent ?? '').trim()} simulated`.trim());
        new MutationObserver(sync).observe(app, { childList: true, characterData: true, subtree: true });
        sync();
      }
    }

    const ck = partRoot('check');
    if (ck) {
      const body = ck.querySelector<HTMLElement>('.check-body');
      if (body) q('[data-bbody="problems"]').append(body);
      const filters = ck.querySelector<HTMLElement>('.check-filters');
      if (filters) bacts.append(filters);
      const auto = ck.querySelector<HTMLElement>('.check-auto');
      if (auto) sum.querySelector('.st-sum-auto')!.append(auto);
      const run = ck.querySelector<HTMLElement>('.check-run');
      if (run) sum.querySelector('.st-sum-act')!.append(run);
      const rules = ck.querySelector<HTMLElement>('.check-rules-toggle');
      if (rules) {
        sum.querySelectorAll('.st-gh')[1].append(rules);
        rules.addEventListener('click', () => setBottom('problems'));
      }
    }
  }

  function renderCheck(r: CheckResult | null): void {
    const counts = r?.counts ?? { error: 0, warning: 0, info: 0 };
    const set = (cls: string, n: number | string) => setText(sum.querySelector(`.${cls} b`), String(n));
    set('e', r ? counts.error : '-');
    set('w', r ? counts.warning : '-');
    set('i', r ? counts.info : '-');
    sum.querySelector('.st-sum')!.classList.toggle('ran', !!r);
    const total = r ? r.problems.length : 0;
    setText(q('[data-btab="problems"] em'), String(total));
    setText(q('.st-check-count'), r && total ? String(total) : '');
    setStatus('problems', r ? (counts.error || counts.warning ? `${plural(counts.error, 'error')}, ${plural(counts.warning, 'warning')}` : '0 problems') : '');
    setText(
      sum.querySelector('.st-sum-meta'),
      r ? `${plural(r.files, 'file')} · ${sizeText(r.bytes)} · ${new Date(r.checked_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${r.ms} ms` : ' ',
    );
    for (const g of GROUPS) {
      const row = sum.querySelector<HTMLElement>(`.st-read[data-group="${g.id}"]`)!;
      const own = r ? r.problems.filter((p) => (g.rules ? g.rules.includes(p.rule) : !GROUPS.some((o) => o.rules?.includes(p.rule)))) : [];
      const errors = own.filter((p) => p.severity === 'error').length;
      row.dataset.state = !r ? 'idle' : errors ? 'error' : own.length ? 'note' : 'clear';
      setText(row.querySelector('em'), !r ? 'not run' : errors ? plural(errors, 'error') : own.length ? plural(own.length, 'note') : 'clear');
    }
    if (r && counts.error) setStatus('problems', `${plural(counts.error, 'error')}, ${plural(counts.warning, 'warning')}`);
  }

  el.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const l = t.closest<HTMLElement>('[data-ltab]');
    if (l) return setLeft(l.dataset.ltab as 'files' | 'library');
    const r = t.closest<HTMLElement>('[data-rtab]');
    if (r) return setRight(r.dataset.rtab as 'manifest' | 'permissions' | 'check');
    const b = t.closest<HTMLElement>('[data-btab]');
    if (b) return setBottom(b.dataset.btab!);
    if (t.closest('.st-fold')) return fold(!bottom.classList.contains('folded'));
    const tool = t.closest<HTMLElement>('[data-tool]');
    if (!tool) return;
    const id = tool.dataset.tool!;
    if (id === 'split' || id === 'preview') {
      const on = Boolean(prev.hidden);
      setSplit(on);
      if (on) ctx.openPane('preview');
    } else if (id === 'check') ctx.openPane('check', { run: true });
    else if (id === 'run') void commandRun('run.toggle');
    else if (id === 'package') void commandRun('package.build');
  });
  q('.st-publish').addEventListener('click', () => ctx.openPane('publish'));
  q('.st-proj').addEventListener('click', () => void commandRun('shell.project'));

  const hint = q('.st-hint');
  const hints: Record<string, string> = {
    check: 'Check reads the manifest and the code against the Extension Contract, as a host would.',
    preview: 'Preview runs the extension in a simulated app and logs every call it makes to the host.',
    run: 'Run in App writes dev.json so the installed Form app loads this extension from its folder.',
    package: 'Package builds the .formpkg after Check, the same bytes every time.',
  };
  const ownHint = ' ';
  setText(hint, ownHint);
  for (const b of el.querySelectorAll<HTMLElement>('.st-tbtn')) {
    b.addEventListener('mouseenter', () => setText(hint, hints[b.dataset.tool!] ?? ownHint));
    b.addEventListener('mouseleave', () => setText(hint, ownHint));
    b.title = `${b.textContent}`;
  }
  q('.st-publish').addEventListener('mouseenter', () => setText(hint, 'Publish writes the index entry, the submission folder and the registry submission for this version.'));
  q('.st-publish').addEventListener('mouseleave', () => setText(hint, ownHint));
  q('[data-tool="check"]').title = `Check (${keyLabel('F7').join('+')})`;

  const offs = [
    ctx.events.on('check.result', (r: CheckResult | null) => renderCheck(r)),
    ctx.events.on('library.count', (n: number) => {
      setText(q('.st-lib-count'), String(n));
      setNavCount('registry', n);
    }),
    ctx.events.on('studio.part', (d: { id: string; args?: { action?: string } }) => {
      const id = d.id;
      if (id === 'check') {
        setRight('check');
        setBottom('problems');
      } else if (id === 'preview') {
        setSplit(true);
        setBottom('calls');
        setRight('permissions');
      } else if (id === 'library') {
        const action = d.args?.action;
        if (!action || action === 'examples') {
          closeSheet();
          setLeft('library');
        } else openSheet('library');
      } else if (SHEETS.has(id)) openSheet(id);
    }),
  ];

  adopt();
  const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = storage.get(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  };
  setLeft(stored(LEFT_KEY, ['files', 'library'] as const, 'files'));
  setRight(stored(RIGHT_KEY, ['manifest', 'permissions', 'check'] as const, 'manifest'));
  setBottom(stored(BOTTOM_KEY, ['problems', 'calls', 'output'] as const, 'problems'), false);
  fold(storage.get(FOLD_KEY) !== '0');
  setSplit(storage.get(SPLIT_KEY) === '1');
  renderCheck(null);

  return {
    setLeft,
    setRight,
    setBottom,
    setSplit,
    openSheet,
    closeSheet,
    dispose: () => {
      for (const off of offs) off();
    },
  };
}
