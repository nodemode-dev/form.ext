export interface Heading { level: number; text: string; id: string }

export interface Rendered { html: string; headings: Heading[]; title: string; text: string }

export type LinkResolver = (href: string) => { href: string; attrs: string } | null;

interface Ctx { link: LinkResolver; headings: Heading[]; ids: Map<string, number>; text: string[] }

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

export function slug(text: string): string {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

const FENCE = /^(\s{0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const ATX = /^\s{0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const LIST = /^(\s*)([-*+]|\d{1,9}[.)])(\s+|$)(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function blank(line: string): boolean {
  return line.trim() === '';
}

function startsBlock(line: string, next: string | undefined): boolean {
  return FENCE.test(line) || ATX.test(line) || HR.test(line) || QUOTE.test(line) || LIST.test(line) || (line.includes('|') && next !== undefined && TABLE_SEP.test(next) && next.includes('-'));
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function blocks(lines: string[], ctx: Ctx, tight = false): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const pad = fence[1].length;
      const mark = fence[2];
      const lang = fence[3];
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.startsWith(mark[0].repeat(mark.length)) && /^[`~]+$/.test(t)) { i++; break; }
        body.push(lines[i].slice(Math.min(pad, indentOf(lines[i]))));
        i++;
      }
      const code = body.join('\n');
      ctx.text.push(code);
      out.push(`<div class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><button class="md-copy" type="button" title="Copy" aria-label="Copy"></button><pre class="code-block"><code>${escapeHtml(code)}</code></pre></div>`);
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      const level = atx[1].length;
      const inner = inline(atx[2] ?? '', ctx);
      const text = plain(inner);
      let id = slug(text) || 'section';
      const seen = ctx.ids.get(id);
      ctx.ids.set(id, (seen ?? -1) + 1);
      if (seen !== undefined) id = `${id}-${seen + 1}`;
      ctx.headings.push({ level, text, id });
      ctx.text.push(text);
      out.push(`<h${level} id="${escapeHtml(id)}"><a class="md-anchor" href="#${escapeHtml(id)}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${level}>`);
      i++;
      continue;
    }

    if (HR.test(line)) { out.push('<hr>'); i++; continue; }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !blank(lines[i]) && lines[i].includes('|')) { rows.push(splitRow(lines[i])); i++; }
      const cell = (tag: string, c: string, k: number) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c, ctx)}</${tag}>`;
      const thead = `<tr>${head.map((c, k) => cell('th', c, k)).join('')}</tr>`;
      const tbody = rows.map((r) => `<tr>${head.map((_, k) => cell('td', r[k] ?? '', k)).join('')}</tr>`).join('');
      out.push(`<div class="md-table"><table class="table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`);
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !blank(lines[i])) {
        const q = QUOTE.exec(lines[i]);
        inner.push(q ? q[1] : lines[i]);
        i++;
      }
      out.push(`<blockquote>${blocks(inner, ctx)}</blockquote>`);
      continue;
    }

    const lm = LIST.exec(line);
    if (lm) {
      const base = lm[1].length;
      const ordered = /\d/.test(lm[2]);
      const start = ordered ? parseInt(lm[2], 10) : 1;
      const items: string[][] = [];
      let loose = false;
      let sawBlank = false;
      while (i < lines.length) {
        const cur = lines[i];
        const m = LIST.exec(cur);
        if (m && m[1].length === base && /\d/.test(m[2]) === ordered) {
          if (sawBlank && items.length) loose = true;
          sawBlank = false;
          const contentIndent = m[1].length + m[2].length + Math.max(1, Math.min(m[3].length, 4));
          const item = [m[4]];
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (blank(l)) {
              let j = i + 1;
              while (j < lines.length && blank(lines[j])) j++;
              if (j < lines.length && indentOf(lines[j]) >= contentIndent) {
                item.push('');
                i++;
                sawBlank = true;
                continue;
              }
              break;
            }
            const ind = indentOf(l);
            if (ind >= contentIndent) { item.push(l.slice(contentIndent)); i++; continue; }
            if (ind > base && LIST.test(l)) { item.push(l.slice(Math.min(ind, contentIndent))); i++; continue; }
            if (!startsBlock(l, lines[i + 1]) && !LIST.test(l)) { item.push(l.trim()); i++; continue; }
            break;
          }
          items.push(item);
          if (i < lines.length && blank(lines[i])) {
            let j = i;
            while (j < lines.length && blank(lines[j])) j++;
            const nm = j < lines.length ? LIST.exec(lines[j]) : null;
            if (nm && nm[1].length === base && /\d/.test(nm[2]) === ordered) { sawBlank = true; i = j; continue; }
            break;
          }
          continue;
        }
        break;
      }
      if (items.some((it) => it.slice(1).some((l) => l === ''))) loose = true;
      const lis = items.map((it) => `<li>${blocks(it, ctx, !loose)}</li>`).join('');
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${lis}</ol>` : `<ul>${lis}</ul>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !blank(lines[i]) && (para.length === 0 || !startsBlock(lines[i], lines[i + 1]))) {
      para.push(lines[i]);
      i++;
    }
    const html = inline(para.join('\n'), ctx);
    ctx.text.push(plain(html));
    out.push(tight ? html : `<p>${html}</p>`);
  }
  return out.join('');
}

const SAFE_URL = /^(https?:|mailto:|#|\.{0,2}\/|[\w.-]+(?:[/#?]|$))/i;

function inline(src: string, ctx: Ctx): string {
  const slots: string[] = [];
  const hold = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t: string, code: string) => {
    const c = code.replace(/\n/g, ' ');
    const trimmed = /^ .* $/.test(c) && c.trim() ? c.slice(1, -1) : c;
    return hold(`<code>${escapeHtml(trimmed)}</code>`);
  });
  s = s.replace(/\\([!-/:-@[-`{-~])/g, (_, c: string) => hold(escapeHtml(c)));
  const linkHtml = (label: string, href: string, title?: string) => {
    if (!SAFE_URL.test(href) || /^\s*(javascript|data|vbscript):/i.test(href)) return label;
    const r = ctx.link(href);
    if (!r) return `<span class="md-deadlink" title="${escapeHtml(href)}">${label}</span>`;
    return `<a href="${escapeHtml(r.href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${r.attrs}>${label}</a>`;
  };
  s = s.replace(/!?\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*<?([^\s)>]*)>?(?:\s+"([^"]*)")?\s*\)/g, (_, label: string, href: string, title?: string) =>
    hold(linkHtml(inlineRest(label, slots), href, title)),
  );
  s = s.replace(/<(https?:\/\/[^\s<>]+)>/g, (_, url: string) => hold(linkHtml(escapeHtml(url), url)));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/g, (_, pre: string, url: string) => pre + hold(linkHtml(escapeHtml(url), url)));
  return restore(inlineRest(s, slots), slots);
}

function inlineRest(s: string, slots: string[]): string {
  let t = s
    .split(/(\u0000\d+\u0000)/)
    .map((part) => (/^\u0000\d+\u0000$/.test(part) ? part : escapeHtml(part)))
    .join('');
  t = t.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  t = t.replace(/(^|[^*\\])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])([\s\S]*?[^\s_])_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  t = t.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  t = t.replace(/ {2,}\n/g, '<br>').replace(/\\\n/g, '<br>');
  return restore(t, slots);
}

function restore(s: string, slots: string[]): string {
  let t = s;
  for (let k = 0; k < 4 && t.includes('\u0000'); k++) t = t.replace(/\u0000(\d+)\u0000/g, (_, n: string) => slots[Number(n)] ?? '');
  return t;
}

export function render(src: string, link: LinkResolver = (href) => ({ href, attrs: '' })): Rendered {
  const lines = src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const ctx: Ctx = { link, headings: [], ids: new Map(), text: [] };
  const html = blocks(lines, ctx);
  const first = ctx.headings.find((x) => x.level === 1) ?? ctx.headings[0];
  return { html, headings: ctx.headings, title: first?.text ?? '', text: ctx.text.join('\n') };
}
