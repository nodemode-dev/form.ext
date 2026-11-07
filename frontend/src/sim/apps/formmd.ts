import type { AppSim, Json } from '../types';
import { refuse, invalid, need, esc } from '../util';

interface Block { id: string; type: string; level?: number; language?: string; checked?: boolean[]; text: string }
interface Sel { block: string; from: number; to: number }
interface State { page: Json; mode: string; blocks: Block[]; selection: Sel | null }

let seq = 0;
function bid(): string {
  seq += 1;
  const abc = 'abcdefghijklmnopqrstuvwxyz234567';
  let out = '';
  let n = Date.now() * 1000 + seq;
  for (let i = 0; i < 26; i++) {
    out += abc[n % 32];
    n = Math.floor(n / 32) + i * 7 + seq;
  }
  return out;
}

export function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { out.push({ id: bid(), type: 'heading', level: h[1].length, text: h[2] }); i++; continue; }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push({ id: bid(), type: 'code_block', language: lang, text: body.join('\n') });
      continue;
    }
    if (/^---+$/.test(line.trim())) { out.push({ id: bid(), type: 'horizontal_rule', text: '' }); i++; continue; }
    const group = (re: RegExp) => { const items: string[] = []; while (i < lines.length && re.test(lines[i])) items.push(lines[i++]); return items; };
    if (/^- \[[ xX]\] /.test(line)) { const items = group(/^- \[[ xX]\] /); out.push({ id: bid(), type: 'task_list', checked: items.map((t) => /^- \[[xX]\]/.test(t)), text: items.map((t) => t.slice(6)).join('\n') }); continue; }
    if (/^[-*] /.test(line)) { out.push({ id: bid(), type: 'bullet_list', text: group(/^[-*] /).map((t) => t.slice(2)).join('\n') }); continue; }
    if (/^\d+\. /.test(line)) { out.push({ id: bid(), type: 'ordered_list', text: group(/^\d+\. /).map((t) => t.replace(/^\d+\. /, '')).join('\n') }); continue; }
    if (line.startsWith('> ')) { out.push({ id: bid(), type: 'blockquote', text: group(/^> /).map((t) => t.slice(2)).join('\n') }); continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|[-*] |\d+\. |> )/.test(lines[i])) para.push(lines[i++]);
    out.push({ id: bid(), type: 'paragraph', text: para.join(' ') });
  }
  return out;
}

function toMarkdown(blocks: Block[]): string {
  return blocks.map((b) => {
    const items = b.text.split('\n');
    switch (b.type) {
      case 'heading': return `${'#'.repeat(b.level ?? 1)} ${b.text}`;
      case 'bullet_list': return items.map((t) => `- ${t}`).join('\n');
      case 'ordered_list': return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
      case 'task_list': return items.map((t, i) => `- [${b.checked?.[i] ? 'x' : ' '}] ${t}`).join('\n');
      case 'blockquote': return items.map((t) => `> ${t}`).join('\n');
      case 'code_block': return `\`\`\`${b.language ?? ''}\n${b.text}\n\`\`\``;
      case 'horizontal_rule': return '---';
      default: return b.text;
    }
  }).join('\n\n') + '\n';
}

function writable(s: State) {
  if (s.mode !== 'edit') refuse(`the page is in ${s.mode} mode; changes are refused`);
}

function idx(s: State, id: unknown): number {
  const i = s.blocks.findIndex((b) => b.id === id);
  if (i < 0) refuse(`there is no block ${String(id)}`);
  return i;
}

function insertAt(s: State, a: Json, blocks: Block[]) {
  writable(s);
  let at = s.blocks.length;
  if (a.at === 'start') at = 0;
  else if (a.at === 'cursor') at = s.selection ? idx(s, s.selection.block) + 1 : s.blocks.length;
  else if (a.at === 'after') { need(a, 'block'); at = idx(s, a.block) + 1; }
  else if (a.at !== undefined && a.at !== 'end') invalid('at is end, start, cursor or after');
  s.blocks.splice(at, 0, ...blocks);
  return { blocks: blocks.map((b) => b.id) };
}

function snapshot(s: State, parts: string[]) {
  const out: Json = { page: s.page, writable: s.mode === 'edit', mode: s.mode };
  if (parts.includes('blocks')) out.blocks = s.blocks.map((b) => ({ ...b, text: b.text.slice(0, 4000) }));
  if (parts.includes('markdown')) out.markdown = toMarkdown(s.blocks);
  if (parts.includes('selection')) out.selection = selection(s);
  if (parts.includes('outline')) out.outline = s.blocks.filter((b) => b.type === 'heading').map((b) => ({ id: b.id, level: b.level, text: b.text }));
  return out;
}

function selection(s: State) {
  if (!s.selection) return null;
  const b = s.blocks.find((x) => x.id === s.selection?.block);
  const text = b ? b.text.slice(s.selection.from, s.selection.to) : '';
  return { block: s.selection.block, from: s.selection.from, to: s.selection.to, empty: s.selection.from === s.selection.to, text };
}

function lit(t: string) {
  return new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
}

const doc = 'doc';
const sim: AppSim<State> = {
  product: 'formmd',
  app: 'form.md',
  appVersion: '0.50.0',
  docLabel: 'Page',
  title: (s) => s.page?.title ?? 'Home',
  initial: () => {
    const blocks = parseMarkdown('# Tides and timetables\n\nRowing clubs on tidal rivers plan sessions around the tide tables, since the safe window can be as short as two hours [@pugh2004].\n\n## Method\n\nWe compared three seasons of club logs with the published tide predictions [@ukho2025, p. 12].\n\n- Sessions before high water\n- Sessions after high water\n\n## Results\n\nMost sessions start within forty minutes of high water.\n\n- [ ] Add the winter figures\n- [x] Check the 2025 predictions\n');
    return { page: { id: 'vfe3ownqcwhhlb7lrhegrmy5ka', title: 'Tides and timetables', kind: 'doc', icon: '', workspace_id: 'ixqgbj6kwxgfzlbcjeezsazmq4', url: '/p/vfe3ownqcwhhlb7lrhegrmy5ka' }, mode: 'edit', blocks, selection: { block: blocks[3].id, from: 13, to: 17 } };
  },
  defaultRead: 'all',
  reads: {
    all: (s) => snapshot(s, ['blocks', 'markdown', 'selection', 'outline']),
    blocks: (s) => snapshot(s, ['blocks']),
    markdown: (s) => snapshot(s, ['markdown']),
    selection: (s) => snapshot(s, ['selection']),
    outline: (s) => snapshot(s, ['outline']),
    page: (s) => snapshot(s, []),
  },
  apply: 'atomic',
  undo: true,
  applyKinds: [doc],
  cmds: {
    'doc.insertMarkdown': { title: 'Insert Markdown', kind: doc, args: { markdown: 'string', at: 'end|start|cursor|after', block: 'string?' }, fn: (s, a) => (need(a, 'markdown'), insertAt(s, a, parseMarkdown(String(a.markdown)))) },
    'doc.insertText': { title: 'Insert Text', kind: doc, args: { text: 'string', at: 'end|start|cursor|after', block: 'string?' }, fn: (s, a) => (need(a, 'text'), insertAt(s, a, String(a.text).split(/\n\s*\n/).map((t) => ({ id: bid(), type: 'paragraph', text: t.trim() })))) },
    'doc.replaceBlock': { title: 'Replace Block', kind: doc, args: { block: 'string', markdown: 'string' }, fn: (s, a) => { writable(s); const i = idx(s, a.block); const blocks = parseMarkdown(String(a.markdown ?? '')); s.blocks.splice(i, 1, ...blocks); return { blocks: blocks.map((b) => b.id) }; } },
    'doc.setBlockText': { title: 'Set Block Text', kind: doc, args: { block: 'string', text: 'string' }, fn: (s, a) => { writable(s); const b = s.blocks[idx(s, a.block)]; if (['code_block', 'horizontal_rule', 'table', 'image'].includes(b.type) && b.type !== 'code_block') refuse(`${b.type} is not a text block`); b.text = String(a.text); return { block: b.id }; } },
    'doc.deleteBlock': { title: 'Delete Block', kind: doc, args: { block: 'string' }, fn: (s, a) => { writable(s); s.blocks.splice(idx(s, a.block), 1); if (s.selection?.block === a.block) s.selection = null; return { deleted: a.block }; } },
    'doc.moveBlock': { title: 'Move Block', kind: doc, args: { block: 'string', index: 'number' }, fn: (s, a) => { writable(s); const [b] = s.blocks.splice(idx(s, a.block), 1); const at = Math.max(0, Math.min(s.blocks.length, Number(a.index))); s.blocks.splice(at, 0, b); return { block: b.id, index: at }; } },
    'doc.replaceText': { title: 'Replace Text', kind: doc, args: { find: 'string', replace: 'string', all: 'boolean?', caseSensitive: 'boolean?' }, fn: (s, a) => { writable(s); need(a, 'find'); let n = 0; const re = new RegExp(lit(String(a.find)).source, `${a.all === false ? '' : 'g'}${a.caseSensitive ? '' : 'i'}`); for (const b of s.blocks) b.text = b.text.replace(re, () => (n++, String(a.replace ?? ''))); return { replaced: n }; } },
    'doc.markText': { title: 'Mark Text', kind: doc, args: { find: 'string', mark: 'strong|em|underline|strike|code|highlight', all: 'boolean?' }, fn: (s, a) => { writable(s); const wrap = ({ strong: '**', em: '_', strike: '~~', code: '`', highlight: '==', underline: '__' } as Record<string, string>)[a.mark] ?? invalid('mark is strong, em, underline, strike, code or highlight'); let n = 0; for (const b of s.blocks) b.text = b.text.replace(lit(String(a.find)), (m) => (n++, `${wrap}${m}${wrap}`)); return { marked: n }; } },
    'doc.select': { title: 'Select', kind: doc, args: { block: 'string', from: 'number?', to: 'number?' }, fn: (s, a) => { const b = s.blocks[idx(s, a.block)]; s.selection = { block: b.id, from: Number(a.from ?? 0), to: Number(a.to ?? a.from ?? b.text.length) }; return { block: b.id }; } },
    'doc.undo': { title: 'Undo', group: 'Edit', fn: () => refuse('use the preview Undo button; doc.undo runs in the app') },
    'page.copyMarkdown': { title: 'Copy Page as Markdown', group: 'Page', fn: (s) => ({ copied: toMarkdown(s.blocks).length }) },
    'page.favorite': { title: 'Add to Favorites', group: 'Page', fn: () => ({ favorite: true }) },
    'shell.theme.toggle': { title: 'Toggle Theme', group: 'View', fn: () => ({}) },
    'view.wordCount': { title: 'Word Count', group: 'View', fn: (s) => ({ words: toMarkdown(s.blocks).split(/\s+/).filter(Boolean).length }) },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify(p.blocks) !== JSON.stringify(n.blocks)) out.push({ name: 'document.changed', data: { page: n.page?.id ?? null, reason: 'edit', blocks: n.blocks.length } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: { page: n.page?.id ?? null, ...(selection(n) ?? { block: null, from: 0, to: 0, empty: true, text: '' }) } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'content changed, or another page opened', sample: (s) => ({ page: s.page?.id, reason: 'edit', blocks: s.blocks.length }) },
    { name: 'selection.changed', note: 'the selection moved', sample: (s) => ({ page: s.page?.id, ...(selection(s) ?? {}) }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['files.save: a browser download', 'net.fetch: -32003, the window reaches only its own server'] },
  tokens: {},
  view: (s) => `<div class="sim-md">${s.blocks.map((b) => `<div class="sim-block${s.selection?.block === b.id ? ' on' : ''}" data-type="${b.type}"><span class="sim-k">${esc(b.type === 'heading' ? `h${b.level}` : b.type.replace('_list', '').replace('_block', ''))}</span><span>${esc(b.text.slice(0, 160))}</span></div>`).join('')}</div><div class="sim-m">${s.blocks.length} blocks, mode ${s.mode}${s.selection ? `, selection in ${s.selection.block.slice(0, 6)}` : ''}</div>`,
  samples: ['library.bib', 'library.json'],
};

export default sim;
