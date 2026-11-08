import { get, run } from './commands';
import { esc, keyLabel } from './dom';
import { APP_MENU, MENUS, SEP, SYSTEM_ITEMS } from './menus';

export function mountMenubar(bar: HTMLElement): void {
  const all = [APP_MENU, ...MENUS];
  bar.innerHTML = all.map((m) => `<button type="button" aria-haspopup="menu" aria-expanded="false" data-menu="${esc(m.label)}">${esc(m.label)}</button>`).join('');
  const pop = document.createElement('div');
  pop.className = 'fx-menu';
  pop.setAttribute('role', 'menu');
  pop.hidden = true;
  document.body.append(pop);
  let openBtn: HTMLElement | null = null;

  function close(): void {
    pop.hidden = true;
    openBtn?.setAttribute('aria-expanded', 'false');
    openBtn = null;
  }

  function entry(id: string): string {
    if (id === SEP) return '<div class="fx-menu-sep" role="separator"></div>';
    const sys = SYSTEM_ITEMS[id];
    const cmd = get(id);
    const label = sys ? sys.label : cmd?.title;
    if (!label) return '';
    const keys = sys ? sys.keys : cmd?.keys;
    return `<button type="button" role="menuitem" data-id="${esc(id)}"><span>${esc(label)}</span>${keys ? `<kbd>${esc(keyLabel(keys).join(''))}</kbd>` : ''}</button>`;
  }

  function open(btn: HTMLElement): void {
    const def = all.find((m) => m.label === btn.dataset.menu);
    if (!def) return;
    close();
    pop.innerHTML = def.items.map(entry).join('');
    const r = btn.getBoundingClientRect();
    pop.style.left = `${r.left}px`;
    pop.style.top = `${r.bottom + 2}px`;
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openBtn = btn;
  }

  bar.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('button[data-menu]');
    if (!btn) return;
    if (openBtn === btn) close();
    else open(btn);
  });
  bar.addEventListener('pointerover', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('button[data-menu]');
    if (btn && openBtn && openBtn !== btn) open(btn);
  });
  pop.addEventListener('click', (ev) => {
    const item = (ev.target as HTMLElement).closest<HTMLElement>('button[data-id]');
    if (!item) return;
    const id = item.dataset.id!;
    close();
    const sys = SYSTEM_ITEMS[id];
    if (sys) document.execCommand(sys.exec);
    else void run(id);
  });
  pop.addEventListener('mousedown', (ev) => ev.preventDefault());
  document.addEventListener('pointerdown', (ev) => {
    if (!openBtn) return;
    const t = ev.target as HTMLElement;
    if (!pop.contains(t) && !bar.contains(t)) close();
  });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && openBtn) close();
  });
  window.addEventListener('blur', close);
}
