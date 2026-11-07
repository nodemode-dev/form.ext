import { emit } from './events';
import { storage } from './storage';

export type ThemeMode = 'dark' | 'light';
const KEY = 'formext.theme';

export function themeMode(): ThemeMode {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function themeTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string) => cs.getPropertyValue(name).trim();
  return {
    '--bg': read('--ground'),
    '--panel': read('--pane'),
    '--text': read('--ink'),
    '--muted': read('--ink-soft'),
    '--accent': read('--accent-color'),
    '--border': read('--edge'),
    '--radius': read('--radius'),
    '--float': read('--float'),
    '--input': read('--bg-input'),
    '--danger': read('--fault'),
    '--font': read('--font-ui'),
    '--font-mono': read('--font-code'),
  };
}

export function setTheme(mode: ThemeMode): void {
  if (mode === themeMode()) return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  storage.set(KEY, mode);
  emit('shell.theme', { mode, tokens: themeTokens() });
}

export function toggleTheme(): void {
  setTheme(themeMode() === 'dark' ? 'light' : 'dark');
}

export const theme = { mode: themeMode, tokens: themeTokens, set: setTheme, toggle: toggleTheme };
