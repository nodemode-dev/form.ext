import { describe, it, expect } from 'vitest';
import { render, slug, escapeHtml } from '../../../src/panes/docs/markdown';

function dom(src: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = render(src).html;
  return el;
}

describe('docs markdown', () => {
  it('turns a level one heading into an h1 and reports it as the title', () => {
    const r = render('# Getting Started\n\nSome text.');
    expect(r.title).toBe('Getting Started');
    const h1 = dom('# Getting Started').querySelector('h1')!;
    h1.querySelector('a[aria-hidden="true"]')?.remove();
    expect(h1.textContent!.trim()).toBe('Getting Started');
  });

  it('lists every heading with its level in document order', () => {
    const r = render('# One\n\n## Two\n\ntext\n\n### Three\n');
    expect(r.headings.map((h) => [h.level, h.text])).toEqual([[1, 'One'], [2, 'Two'], [3, 'Three']]);
  });

  it('gives two headings with the same text different ids', () => {
    const r = render('## Setup\n\n## Setup\n');
    expect(r.headings).toHaveLength(2);
    expect(r.headings[0].id).not.toBe(r.headings[1].id);
  });

  it('makes a heading id that is its text in lower case with dashes', () => {
    expect(slug('Hello World')).toBe('hello-world');
    expect(render('## Hello World').headings[0].id).toBe('hello-world');
  });

  it('shows raw html from the source as text and builds no script element', () => {
    const el = dom('Hi <script>alert(1)</script> there');
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
  });

  it('escapes the five html special characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('renders emphasis, strong text and inline code', () => {
    const el = dom('This is *soft*, **loud** and `code`.');
    expect(el.querySelector('em')!.textContent).toBe('soft');
    expect(el.querySelector('strong')!.textContent).toBe('loud');
    expect(el.querySelector('code')!.textContent).toBe('code');
  });

  it('keeps the text of a fenced code block exactly, markup included', () => {
    const el = dom('```js\nconst a = "<b>";\n  if (a) {}\n```\n');
    expect(el.querySelector('pre')!.textContent!.replace(/\n$/, '')).toBe('const a = "<b>";\n  if (a) {}');
    expect(el.querySelector('pre b')).toBeNull();
  });

  it('builds a bullet list with one item per line', () => {
    const el = dom('- one\n- two\n- three\n');
    expect([...el.querySelectorAll('ul > li')].map((li) => li.textContent!.trim())).toEqual(['one', 'two', 'three']);
  });

  it('builds a numbered list as an ordered list', () => {
    const el = dom('1. first\n2. second\n');
    expect([...el.querySelectorAll('ol > li')].map((li) => li.textContent!.trim())).toEqual(['first', 'second']);
  });

  it('builds a table with header cells and body rows', () => {
    const el = dom('| Key | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n');
    expect([...el.querySelectorAll('th')].map((c) => c.textContent!.trim())).toEqual(['Key', 'Value']);
    expect([...el.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent!.trim()))).toEqual([['a', '1'], ['b', '2']]);
  });

  it('wraps quoted lines in a blockquote', () => {
    expect(dom('> take care\n').querySelector('blockquote')!.textContent!.trim()).toBe('take care');
  });

  it('passes each link through the resolver and uses the address it returns', () => {
    const seen: string[] = [];
    const r = render('See [the guide](guide.md).', (href) => { seen.push(href); return { href: `#/docs/${href}`, attrs: '' }; });
    const el = document.createElement('div');
    el.innerHTML = r.html;
    expect(seen).toEqual(['guide.md']);
    expect(el.querySelector('a')!.getAttribute('href')).toBe('#/docs/guide.md');
    expect(el.querySelector('a')!.textContent).toBe('the guide');
  });

  it('builds no link with a javascript address', () => {
    const el = dom('[x](javascript:alert(1))');
    const a = el.querySelector('a');
    expect(a === null || !/^\s*javascript:/i.test(a.getAttribute('href') ?? '')).toBe(true);
  });

  it('separates paragraphs at a blank line', () => {
    expect([...dom('first\n\nsecond\n').querySelectorAll('p')].map((p) => p.textContent!.trim())).toEqual(['first', 'second']);
  });

  it('returns the plain text of the page for search without markup', () => {
    const r = render('# Title\n\nSome **bold** words.');
    expect(r.text).toContain('Some bold words.');
    expect(r.text).not.toContain('<');
  });
});
