import { icon } from './icons';

export interface Product { id: string; name: string; repo: string; glyph: string; host: boolean; blurb: string }

export const PRODUCTS: Product[] = [
  { id: 'formvis', name: 'FormVis', repo: 'formvis', glyph: 'image', host: true, blurb: 'Layered image editor' },
  { id: 'formcut', name: 'FormCut', repo: 'formcut', glyph: 'film', host: true, blurb: 'Video editor' },
  { id: 'formwav', name: 'FormWav', repo: 'formwav', glyph: 'wave', host: true, blurb: 'Audio editor' },
  { id: 'formpdf', name: 'FormPDF', repo: 'formpdf', glyph: 'pdf', host: true, blurb: 'PDF editor' },
  { id: 'formdeck', name: 'FormDeck', repo: 'formdeck', glyph: 'slides', host: true, blurb: 'Slide decks' },
  { id: 'formlit', name: 'FormLit', repo: 'formlit', glyph: 'pen', host: true, blurb: 'Writing studio' },
  { id: 'formmd', name: 'Form.md', repo: 'form.md', glyph: 'markdown', host: true, blurb: 'Markdown editor' },
  { id: 'formencoder', name: 'FormEncoder', repo: 'formencoder', glyph: 'transcode', host: true, blurb: 'Media encoder' },
  { id: 'formvfx', name: 'FormVFX', repo: 'formvfx', glyph: 'sparkles', host: true, blurb: 'Visual effects' },
  { id: 'formmcp', name: 'FormMCP', repo: 'formMCP', glyph: 'nodes', host: true, blurb: 'MCP server manager' },
  { id: 'formtray', name: 'FormTray', repo: 'formtray', glyph: 'tray', host: true, blurb: 'Menu bar tray' },
  { id: 'formskills', name: 'FormSkills', repo: 'formskills', glyph: 'star', host: true, blurb: 'Agent skills' },
  { id: 'formportal', name: 'FormPortal', repo: 'formportal', glyph: 'hub', host: false, blurb: 'The Form hub' },
];

export const HOSTS = PRODUCTS.filter((p) => p.host);

export function product(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productName(id: string): string {
  return product(id)?.name ?? id;
}

const ART = import.meta.glob<string>('../assets/icons/*.webp', { eager: true, query: '?url', import: 'default' });

export function appArt(id: string): string {
  const dark = ART[`../assets/icons/${id}.webp`];
  const light = ART[`../assets/icons/${id}-light.webp`];
  if (!dark || !light) return '';
  return `<img class="art art-dark" src="${dark}" alt="" width="128" height="128" draggable="false" /><img class="art art-light" src="${light}" alt="" width="128" height="128" draggable="false" />`;
}

export function appIcon(id: string, large = false): string {
  const p = product(id);
  const art = appArt(id);
  return `<span class="app-icon${large ? ' lg' : ''}${art ? ' has-art' : ''}" data-product="${id}" title="${p?.name ?? id}">${art || icon(p?.glyph ?? 'puzzle')}</span>`;
}
