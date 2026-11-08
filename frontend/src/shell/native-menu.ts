import { get, run } from './commands';
import { MENUS, SEP, SYSTEM_ITEMS } from './menus';

export const wantsNativeMenus = (): boolean => '__TAURI_INTERNALS__' in window && /Mac/.test(navigator.platform);

export function accelerator(combo: string | undefined): string | null {
  if (!combo) return null;
  const names: Record<string, string> = { Mod: 'CmdOrCtrl', Alt: 'Alt', Shift: 'Shift', Ctrl: 'Ctrl', ',': ',', '.': '.' };
  const out: string[] = [];
  for (const p of combo.split('+')) {
    if (names[p]) out.push(names[p]);
    else if (/^[A-Za-z0-9]$/.test(p)) out.push(p.toUpperCase());
    else if (/^F([1-9]|1[0-2])$/.test(p)) out.push(p);
    else return null;
  }
  return out.join('+');
}

type Api = typeof import('@tauri-apps/api/menu');

export async function buildNativeMenus(): Promise<void> {
  const api: Api = await import('@tauri-apps/api/menu');
  const make = async (id: string): Promise<unknown> => {
    if (id === SEP) return api.PredefinedMenuItem.new({ item: 'Separator' });
    const sys = SYSTEM_ITEMS[id];
    if (sys) {
      const map: Record<string, 'Undo' | 'Redo' | 'Cut' | 'Copy' | 'Paste' | 'SelectAll'> = { undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'SelectAll' };
      return api.PredefinedMenuItem.new({ item: map[sys.exec], text: sys.label });
    }
    const cmd = get(id);
    if (!cmd) return null;
    const acc = accelerator(cmd.keys);
    const opts = { text: cmd.title, action: () => void run(id) };
    try {
      return await api.MenuItem.new(acc ? { ...opts, accelerator: acc } : opts);
    } catch {
      return api.MenuItem.new(opts);
    }
  };
  const top: unknown[] = [];
  const app = [
    await api.PredefinedMenuItem.new({ item: { About: { name: 'form.ext', license: 'Apache-2.0' } }, text: 'About form.ext' }),
    await api.PredefinedMenuItem.new({ item: 'Separator' }),
    await make('settings'),
    await api.PredefinedMenuItem.new({ item: 'Separator' }),
    await api.PredefinedMenuItem.new({ item: 'Hide' }),
    await api.PredefinedMenuItem.new({ item: 'Quit' }),
  ].filter(Boolean);
  top.push(await api.Submenu.new({ text: 'form.ext', items: app as never[] }));
  for (const def of MENUS) {
    const items = (await Promise.all(def.items.map(make))).filter(Boolean);
    top.push(await api.Submenu.new({ text: def.label, items: items as never[] }));
  }
  const menu = await api.Menu.new({ items: top as never[] });
  await menu.setAsAppMenu();
}
