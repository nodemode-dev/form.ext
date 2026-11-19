import { emit } from './events';
import { storage } from './storage';

export type ThemeMode = 'dark' | 'light' | 'amoled';
const KEY = 'formext.theme';
const OLED: Record<string, true> = { amoled: true };

export function themeMode(): ThemeMode {
  const mode = document.documentElement.dataset.theme;
  return mode === 'light' || mode === 'amoled' ? mode : 'dark';
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
  root.style.colorScheme = mode === 'light' ? 'light' : 'dark';
  if (OLED[mode] && !root.hasAttribute('data-oled')) root.setAttribute('data-oled', '');
  else if (!OLED[mode] && root.hasAttribute('data-oled')) root.removeAttribute('data-oled');
  storage.set(KEY, mode);
  emit('shell.theme', { mode, tokens: themeTokens() });
}

export function toggleTheme(): void {
  setTheme(themeMode() === 'light' ? 'dark' : 'light');
}

export const theme = { mode: themeMode, tokens: themeTokens, set: setTheme, toggle: toggleTheme };
