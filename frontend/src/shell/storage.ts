const SHARED = new Set(['formext.theme', 'formext.rail']);

function scoped(key: string): string {
  if (document.documentElement.dataset.demo !== 'studio' || !key.startsWith('formext.') || key.startsWith('formext.demo.') || SHARED.has(key)) return key;
  return `formext.demo.${key.slice('formext.'.length)}`;
}

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(scoped(key));
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(scoped(key), value);
    } catch {
      return;
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(scoped(key));
    } catch {
      return;
    }
  },
  json<T>(key: string, fallback: T): T {
    const raw = storage.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
};
