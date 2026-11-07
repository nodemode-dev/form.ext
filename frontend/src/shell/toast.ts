import { esc } from './dom';
import { icon } from './icons';
import type { Level } from './types';

let host: HTMLElement | null = null;
const MAX = 4;

export function mountToasts(el: HTMLElement): void {
  host = el;
}

export function notify(message: string, level: Level = 'info'): void {
  if (!host) {
    console.log(`[${level}] ${message}`);
    return;
  }
  const el = document.createElement('div');
  el.className = `fx-toast ${level}`;
  el.setAttribute('role', level === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(level)}<div class="msg">${esc(message)}</div><button class="btn ghost icon sm close" type="button" aria-label="Dismiss">${icon('close', 14)}</button>`;
  const dismiss = () => {
    if (el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    window.setTimeout(() => el.remove(), 240);
  };
  el.querySelector('.close')!.addEventListener('click', dismiss);
  host.prepend(el);
  while (host.children.length > MAX) host.lastElementChild!.remove();
  const ttl = level === 'error' ? 8000 : level === 'warning' ? 6000 : 3800;
  let timer = window.setTimeout(dismiss, ttl);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => {
    timer = window.setTimeout(dismiss, 2000);
  });
}
