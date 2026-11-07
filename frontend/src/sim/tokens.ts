import type { AppSim } from './types';

const BASE = {
  dark: { '--bg': '#111111', '--panel': '#17151b', '--text': '#f7f7f7', '--muted': '#a4a4a4', '--border': '#2a2a2a', '--radius': '6px' },
  light: { '--bg': '#ecebe6', '--panel': '#f6f5f1', '--text': '#1a1a1a', '--muted': '#5c5c5c', '--border': '#d4d2cc', '--radius': '6px' },
};

const hues = new Map<string, string>();

function hueOf(product: string): string {
  const cacheKey = `${product}:${document.documentElement.dataset.theme ?? 'dark'}`;
  const known = hues.get(cacheKey);
  if (known) return known;
  const el = document.createElement('span');
  el.dataset.product = product;
  el.style.cssText = 'position:absolute;visibility:hidden;color:var(--hue)';
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  el.remove();
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  let v = '#f97316';
  if (g && computed) {
    g.fillStyle = computed;
    g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    v = `#${[r, gr, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  hues.set(cacheKey, v);
  return v;
}

export function tokensFor(sim: AppSim, mode: 'dark' | 'light'): Record<string, string> {
  const base: Record<string, string> = { ...BASE[mode], '--accent': hueOf(sim.product) };
  const out: Record<string, string> = { ...base };
  for (const [name, from] of Object.entries(sim.tokens)) out[name] = from.startsWith('--') ? base[from] ?? '' : from;
  return out;
}
