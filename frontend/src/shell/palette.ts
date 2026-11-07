import { esc, keyLabel } from './dom';
import { icon } from './icons';
import { list, run } from './commands';

export interface PickItem {
  id: string;
  title: string;
  detail?: string;
  icon?: string;
  keys?: string;
}

let root: HTMLElement;
let input: HTMLInputElement;
let listEl: HTMLElement;
let items: PickItem[] = [];
let shown: PickItem[] = [];
let selected = 0;
let resolver: ((id: string | null) => void) | null = null;
let returnFocus: Element | null = null;

export function mountPalette(el: HTMLElement): void {
  root = el;
  input = root.querySelector('input')!;
  listEl = root.querySelector('.fx-palette-list')!;
  input.addEventListener('input', () => {
    selected = 0;
    render();
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      move(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      move(-1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(shown[selected]?.id ?? null);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      choose(null);
    }
  });
  listEl.addEventListener('mousedown', (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (!li) return;
    ev.preventDefault();
    choose(li.dataset.id!);
  });
  listEl.addEventListener('mousemove', (ev) => {
    const li = (ev.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (!li) return;
    const i = Number(li.dataset.index);
    if (i !== selected) {
      selected = i;
      mark();
    }
  });
  document.addEventListener('mousedown', (ev) => {
    if (resolver && !root.contains(ev.target as Node)) choose(null);
  });
}

export function isPaletteOpen(): boolean {
  return resolver !== null;
}

function score(item: PickItem, q: string): number {
  if (!q) return 1;
  const hay = `${item.title} ${item.detail ?? ''}`.toLowerCase();
  const idx = hay.indexOf(q);
  if (idx === 0) return 3;
  if (idx > 0) return 2;
  let pos = 0;
  for (const ch of q) {
    pos = hay.indexOf(ch, pos);
    if (pos < 0) return 0;
    pos++;
  }
  return 1;
}

function render(): void {
  const q = input.value.trim().toLowerCase();
  shown = items
    .map((it, i) => ({ it, s: score(it, q), i }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.it);
  if (!shown.length) {
    listEl.innerHTML = '<li class="fx-palette-empty">Nothing matches.</li>';
    return;
  }
  listEl.innerHTML = shown
    .map((it, i) => {
      const keys = it.keys ? `<span class="keys">${keyLabel(it.keys).map((k) => `<kbd>${esc(k)}</kbd>`).join('')}</span>` : '';
      const detail = it.detail ? `<span class="faint ellipsis">${esc(it.detail)}</span>` : '';
      return `<li class="fx-palette-item" role="option" data-id="${esc(it.id)}" data-index="${i}" aria-selected="${i === selected}">${icon(it.icon ?? 'command', 14)}<span class="ellipsis">${esc(it.title)}</span>${detail}${keys}</li>`;
    })
    .join('');
}

function mark(): void {
  listEl.querySelectorAll<HTMLElement>('[data-index]').forEach((li) => {
    li.setAttribute('aria-selected', String(Number(li.dataset.index) === selected));
  });
  listEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}

function move(d: number): void {
  if (!shown.length) return;
  selected = (selected + d + shown.length) % shown.length;
  mark();
}

function choose(id: string | null): void {
  const r = resolver;
  if (!r) return;
  resolver = null;
  root.classList.remove('open');
  input.value = '';
  listEl.innerHTML = '';
  if (returnFocus instanceof HTMLElement && id === null) returnFocus.focus();
  r(id);
}

export function pick(list: PickItem[], placeholder = 'Type to search'): Promise<string | null> {
  if (resolver) choose(null);
  returnFocus = document.activeElement;
  items = list;
  selected = 0;
  input.placeholder = placeholder;
  input.value = '';
  render();
  root.classList.add('open');
  input.focus();
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export async function openPalette(): Promise<void> {
  const cmds = list();
  const id = await pick(cmds.map((c) => ({ id: c.id, title: c.title, keys: c.keys, icon: c.icon ?? 'command' })),'Run a command or go to a pane');
  if (id) await run(id);
}

export const palette = { pick, open: openPalette };
