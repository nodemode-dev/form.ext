export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | number | undefined> = {}, html = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  if (html) el.innerHTML = html;
  return el;
}

export function qs<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}

export function setText(el: Element | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function keyLabel(keys: string): string[] {
  return keys.split('+').map((k) => {
    const key = k.trim();
    if (key === 'Mod') return isMac ? '⌘' : 'Ctrl';
    if (key === 'Shift') return isMac ? '⇧' : 'Shift';
    if (key === 'Alt') return isMac ? '⌥' : 'Alt';
    if (key === 'Ctrl') return isMac ? '⌃' : 'Ctrl';
    return key.length === 1 ? key.toUpperCase() : key;
  });
}

export function matchKeys(ev: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+').map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1];
  const mod = parts.includes('mod');
  const want = {
    meta: parts.includes('meta') || (mod && isMac),
    ctrl: parts.includes('ctrl') || (mod && !isMac),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
  if (ev.metaKey !== want.meta || ev.ctrlKey !== want.ctrl || ev.shiftKey !== want.shift || ev.altKey !== want.alt) return false;
  const pressed = ev.key.toLowerCase();
  if (pressed === key) return true;
  if (key.length === 1 && ev.code === `Key${key.toUpperCase()}`) return true;
  if (key.length === 1 && /\d/.test(key) && ev.code === `Digit${key}`) return true;
  return false;
}
