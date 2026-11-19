const HEADER = 'X-Formext-Window-Key';
const STORE = 'formext.window-key';

let key = '';
let packaged = false;
let loading: Promise<void> | null = null;

function remembered(): string {
  try {
    return sessionStorage.getItem(STORE) ?? '';
  } catch {
    return '';
  }
}

function remember(value: string): void {
  try {
    sessionStorage.setItem(STORE, value);
  } catch {
    return;
  }
}

async function claim(): Promise<string> {
  try {
    const res = await fetch('/api/window/key', { method: 'POST' });
    const body = res.ok ? ((await res.json()) as { key?: unknown }) : {};
    return typeof body.key === 'string' ? body.key : '';
  } catch {
    return '';
  }
}

async function load(): Promise<void> {
  const holder = window as unknown as { __FORMEXT_WINDOW_KEY?: unknown };
  const given = holder.__FORMEXT_WINDOW_KEY;
  delete holder.__FORMEXT_WINDOW_KEY;
  if (typeof given === 'string' && given) {
    key = given;
    packaged = true;
    return;
  }
  key = remembered();
  if (key) return;
  key = await claim();
  if (key) remember(key);
}

export function loadWindowKey(): Promise<void> {
  loading ??= load();
  return loading;
}

export async function keyHeaders(): Promise<Record<string, string>> {
  if (loading) await loading;
  return key ? { [HEADER]: key } : {};
}

export async function reclaimWindowKey(): Promise<boolean> {
  if (packaged) return false;
  const claimed = await claim();
  if (!claimed || claimed === key) return false;
  key = claimed;
  remember(claimed);
  return true;
}

export function windowHello(): string {
  return JSON.stringify({ type: 'window', key });
}
