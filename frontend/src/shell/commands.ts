import { matchKeys } from './dom';
import { notify } from './toast';
import { errorMessage } from './api';
import type { Command } from './types';

const registry = new Map<string, Command>();
const order: string[] = [];

export function register(c: Command): void {
  if (!c || !c.id || typeof c.run !== 'function') return;
  if (!registry.has(c.id)) order.push(c.id);
  registry.set(c.id, c);
}

export function list(): Command[] {
  return order.map((id) => registry.get(id)!).filter(Boolean);
}

export async function run(id: string): Promise<void> {
  const c = registry.get(id);
  if (!c) return;
  try {
    await c.run();
  } catch (err) {
    notify(errorMessage(err), 'error');
  }
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.closest?.('.cm-editor');
}

export function bindKeys(blocked: () => boolean): void {
  window.addEventListener('keydown', (ev) => {
    if (ev.defaultPrevented || ev.repeat || blocked()) return;
    for (const c of registry.values()) {
      if (!c.keys) continue;
      const withMod = /(^|\+)(mod|ctrl|meta|alt)\+/i.test(c.keys);
      if (!withMod && typing(ev.target)) continue;
      if (matchKeys(ev, c.keys)) {
        ev.preventDefault();
        void run(c.id);
        return;
      }
    }
  });
}

export const commands = { register };
