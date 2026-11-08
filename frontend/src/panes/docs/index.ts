import './docs.css';
import { icon, esc, setText, storage, HOSTS, appIcon, productName } from '../../shell';
import type { PaneDef, ShellContext, ProjectRef } from '../../shell';
import { render, slug } from './markdown';
import type { Rendered } from './markdown';

interface DocDef { id: string; title: string; group: 'formext' | 'contract' | 'apps'; glyph: string; source?: string; file: string }

const SOURCES = import.meta.glob<string>(['../../../../contract/CONTRACT.md', '../../../../sdk/README.md', '../../../../docs/MANUAL.md', '../../../../docs/apps/*.md'], { query: '?raw', import: 'default', eager: true });

const ROOT = '../../../../';
const DOC_KEY = 'formext.docs.doc';
const GROUPS: { id: DocDef['group']; label: string }[] = [
  { id: 'formext', label: 'form.ext' },
  { id: 'contract', label: 'Contract' },
  { id: 'apps', label: 'App APIs' },
];

const DOCS: DocDef[] = ([
  { id: 'manual', title: 'Manual', group: 'formext', glyph: 'docs', file: 'docs/MANUAL.md' },
  { id: 'contract', title: 'Extension Contract', group: 'contract', glyph: 'shield', file: 'contract/CONTRACT.md' },
  { id: 'sdk', title: 'SDK reference', group: 'contract', glyph: 'code', file: 'sdk/README.md' },
  ...HOSTS.map((p) => ({ id: p.id, title: p.name, group: 'apps' as const, glyph: '', file: `docs/apps/${p.id}.md` })),
] as DocDef[]).map((d) => ({ ...d, source: SOURCES[ROOT + d.file] }));

const APP_IDS = new Set<string>(HOSTS.map((p) => p.id));
const COPY_BUTTON = '<button class="md-copy" type="button" title="Copy" aria-label="Copy"></button>';

function docById(id: string | undefined | null): DocDef | undefined {
  return DOCS.find((d) => d.id === id && d.source !== undefined);
}

function resolver(current: string) {
  return (href: string) => {
    if (/^(https?:|mailto:)/i.test(href)) return { href, attrs: ' data-external="1" target="_blank" rel="noopener noreferrer"' };
    const [path, hash = ''] = href.split('#');
    const anchor = hash ? slug(decodeURIComponent(hash)) : '';
    let target = '';
    if (!path) target = current;
    else {
      const base = path.split('/').pop()!.toLowerCase();
      const stem = base.replace(/\.md$/, '');
      if (base === 'contract.md') target = 'contract';
      else if (base === 'manual.md') target = 'manual';
      else if (base === 'readme.md' && /(^|\/)sdk\//i.test(path)) target = 'sdk';
      else if (base.endsWith('.md') && APP_IDS.has(stem)) target = stem;
    }
    if (!target || !docById(target)) return null;
    return { href: `#${anchor}`, attrs: ` data-doc="${esc(target)}"${anchor ? ` data-anchor="${esc(anchor)}"` : ''}` };
  };
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  const navGroups = GROUPS.map((g) => {
    const rows = DOCS.filter((d) => d.group === g.id)
      .map((d) => {
        const lead = d.group === 'apps' ? appIcon(d.id) : `<span class="docs-glyph">${icon(d.glyph)}</span>`;
        const missing = d.source === undefined;
        return `<button class="list-row docs-nav-row" type="button" data-doc="${d.id}" aria-selected="false"${missing ? ' disabled title="Not in this build"' : ''}>${lead}<span class="docs-nav-name">${esc(d.title)}</span><span class="meta docs-hits"></span></button>`;
      })
      .join('');
    return `<div class="docs-nav-group"><div class="section-title">${g.label}</div><div class="list">${rows}</div></div>`;
  }).join('');

  el.innerHTML = `
    <div class="pane-fill docs-pane">
      <header class="pane-head">
        <span class="docs-mark">${icon('docs', 18)}</span>
        <div class="docs-title">
          <h1>Docs</h1>
          <div class="sub docs-sub">&nbsp;</div>
        </div>
        <div class="actions">
          <button class="btn docs-project" type="button" disabled>${icon('puzzle')}<span class="docs-project-label">Your app's API</span></button>
        </div>
      </header>
      <div class="docs-grid">
        <nav class="docs-nav" aria-label="Documents">
          <div class="docs-search">
            <label class="docs-search-field">${icon('search', 14)}<input class="input docs-query" type="search" placeholder="Search the docs" aria-label="Search the docs" spellcheck="false" /></label>
            <div class="docs-search-meta"><span class="docs-search-count">&nbsp;</span><span class="docs-search-step"><button class="btn ghost sm icon docs-prev" type="button" title="Previous match (Shift+Enter)" aria-label="Previous match" disabled>${icon('chevron-left', 14)}</button><button class="btn ghost sm icon docs-next" type="button" title="Next match (Enter)" aria-label="Next match" disabled>${icon('chevron-right', 14)}</button></span></div>
          </div>
          ${navGroups}
        </nav>
        <div class="docs-main">
          <article class="docs-article md"></article>
        </div>
        <aside class="docs-toc" aria-label="On this page">
          <div class="section-title">On this page</div>
          <div class="docs-toc-list"></div>
          <div class="docs-file"><span class="docs-file-path">&nbsp;</span></div>
        </aside>
      </div>
    </div>`;

  const sub = el.querySelector<HTMLElement>('.docs-sub')!;
  const projectBtn = el.querySelector<HTMLButtonElement>('.docs-project')!;
  const projectLabel = el.querySelector<HTMLElement>('.docs-project-label')!;
  const query = el.querySelector<HTMLInputElement>('.docs-query')!;
  const count = el.querySelector<HTMLElement>('.docs-search-count')!;
  const prevBtn = el.querySelector<HTMLButtonElement>('.docs-prev')!;
  const nextBtn = el.querySelector<HTMLButtonElement>('.docs-next')!;
  const main = el.querySelector<HTMLElement>('.docs-main')!;
  const article = el.querySelector<HTMLElement>('.docs-article')!;
  const tocList = el.querySelector<HTMLElement>('.docs-toc-list')!;
  const filePath = el.querySelector<HTMLElement>('.docs-file-path')!;
  const rows = new Map<string, HTMLButtonElement>();
  el.querySelectorAll<HTMLButtonElement>('.docs-nav-row').forEach((b) => rows.set(b.dataset.doc!, b));

  const cache = new Map<string, Rendered>();
  const scrolls = new Map<string, number>();
  let current = '';
  let hits: HTMLElement[] = [];
  let hitIndex = -1;
  let tocLinks: { id: string; a: HTMLElement; h: HTMLElement | null }[] = [];
  let spyFrame = 0;
  let searchTimer = 0;
  let projectProduct = '';

  function rendered(id: string): Rendered {
    let r = cache.get(id);
    if (!r) {
      const d = docById(id)!;
      r = render(d.source!, resolver(id));
      r = { ...r, html: r.html.split(COPY_BUTTON).join(`<button class="md-copy" type="button" title="Copy" aria-label="Copy">${icon('copy', 14)}</button>`) };
      cache.set(id, r);
    }
    return r;
  }

  function show(id: string, anchor?: string): void {
    const d = docById(id) ?? docById('contract') ?? DOCS.find((x) => x.source !== undefined);
    if (!d) return;
    if (d.id !== current) {
      if (current) scrolls.set(current, main.scrollTop);
      const r = rendered(d.id);
      article.innerHTML = r.html;
      for (const [rid, b] of rows) b.setAttribute('aria-selected', String(rid === d.id));
      setText(sub, d.group === 'apps' ? `${d.title} extension API` : d.title);
      setText(filePath, d.file);
      tocLinks = r.headings
        .filter((x) => x.level === 2 || x.level === 3)
        .map((x) => {
          const a = document.createElement('a');
          a.className = `docs-toc-link l${x.level}`;
          a.href = `#${x.id}`;
          a.dataset.anchor = x.id;
          a.textContent = x.text;
          return { id: x.id, a, h: null };
        });
      tocList.replaceChildren(...tocLinks.map((t) => t.a));
      for (const t of tocLinks) t.h = article.querySelector<HTMLElement>(`[id="${CSS.escape(t.id)}"]`);
      current = d.id;
      storage.set(DOC_KEY, d.id);
      main.scrollTop = anchor ? 0 : (scrolls.get(d.id) ?? 0);
      highlight();
    }
    if (anchor) goTo(anchor);
    spy();
  }

  function goTo(anchor: string): void {
    const target = article.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
    if (!target) return;
    main.scrollTop = target.offsetTop - 12;
    target.classList.remove('docs-flash');
    void target.offsetWidth;
    target.classList.add('docs-flash');
  }

  function spy(): void {
    let active = '';
    const y = main.scrollTop + 24;
    for (const t of tocLinks) {
      if (t.h && t.h.offsetTop <= y) active = t.id;
      else if (t.h) break;
    }
    if (!active && tocLinks.length) active = tocLinks[0].id;
    for (const t of tocLinks) {
      const on = t.id === active;
      if ((t.a.getAttribute('aria-current') === 'true') !== on) {
        if (on) t.a.setAttribute('aria-current', 'true');
        else t.a.removeAttribute('aria-current');
      }
    }
  }

  function clearMarks(): void {
    const marks = article.querySelectorAll('mark.docs-hit');
    if (!marks.length) return;
    const parents = new Set<Node>();
    marks.forEach((m) => {
      const p = m.parentNode!;
      p.replaceChild(document.createTextNode(m.textContent ?? ''), m);
      parents.add(p);
    });
    parents.forEach((p) => p.normalize());
  }

  function highlight(): void {
    clearMarks();
    hits = [];
    hitIndex = -1;
    const q = query.value.trim().toLowerCase();
    if (q.length >= 2) {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement?.closest('.md-anchor, .md-copy') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const node of nodes) {
        const text = node.data;
        const lower = text.toLowerCase();
        let at = lower.indexOf(q);
        if (at < 0) continue;
        const frag = document.createDocumentFragment();
        let from = 0;
        while (at >= 0) {
          if (at > from) frag.append(text.slice(from, at));
          const m = document.createElement('mark');
          m.className = 'docs-hit';
          m.textContent = text.slice(at, at + q.length);
          frag.append(m);
          hits.push(m);
          from = at + q.length;
          at = lower.indexOf(q, from);
        }
        if (from < text.length) frag.append(text.slice(from));
        node.parentNode!.replaceChild(frag, node);
      }
    }
    prevBtn.disabled = nextBtn.disabled = hits.length === 0;
    setText(count, q.length < 2 ? ' ' : hits.length ? `${hits.length} on this page` : 'Not on this page');
  }

  function step(dir: 1 | -1): void {
    if (!hits.length) return;
    hits[hitIndex]?.classList.remove('current');
    hitIndex = (hitIndex + dir + hits.length) % hits.length;
    const m = hits[hitIndex];
    m.classList.add('current');
    let top = 0;
    for (let n: HTMLElement | null = m; n && n !== main; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    main.scrollTop = top - main.clientHeight / 3;
    setText(count, `${hitIndex + 1} of ${hits.length} on this page`);
  }

  function countAll(): void {
    const q = query.value.trim().toLowerCase();
    for (const d of DOCS) {
      const row = rows.get(d.id)!;
      const meta = row.querySelector<HTMLElement>('.docs-hits')!;
      if (d.source === undefined) continue;
      if (q.length < 2) {
        setText(meta, '');
        row.classList.remove('docs-dim');
        continue;
      }
      const text = rendered(d.id).text.toLowerCase();
      let n = 0;
      for (let at = text.indexOf(q); at >= 0; at = text.indexOf(q, at + q.length)) n++;
      setText(meta, n ? String(n) : '');
      row.classList.toggle('docs-dim', n === 0);
    }
  }

  function search(): void {
    countAll();
    highlight();
    const q = query.value.trim().toLowerCase();
    if (q.length >= 2 && !hits.length) {
      const first = DOCS.find((d) => d.source !== undefined && rendered(d.id).text.toLowerCase().includes(q));
      if (first) {
        show(first.id);
        step(1);
      }
    }
  }

  function openExternal(href: string): void {
    const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
    if (w.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/core').then((m) => m.invoke('plugin:shell|open', { path: href })).catch(() => window.open(href, '_blank', 'noopener'));
    } else window.open(href, '_blank', 'noopener');
  }

  function onProject(p: ProjectRef | null): void {
    projectProduct = p && APP_IDS.has(p.product) && docById(p.product) ? p.product : '';
    projectBtn.disabled = !projectProduct;
    setText(projectLabel, projectProduct ? `${productName(projectProduct)} API` : "Your app's API");
    projectBtn.title = projectProduct ? `The API of ${productName(projectProduct)}, the app ${p!.name} is made for` : 'Open a project to jump to the API of its app';
  }

  el.querySelector('.docs-nav')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.docs-nav-row');
    if (b && !b.disabled) show(b.dataset.doc!);
  });

  tocList.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('.docs-toc-link');
    if (!a) return;
    e.preventDefault();
    goTo(a.dataset.anchor!);
  });

  article.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const copy = target.closest<HTMLButtonElement>('.md-copy');
    if (copy) {
      const code = copy.parentElement?.querySelector('code')?.textContent ?? '';
      navigator.clipboard?.writeText(code).then(
        () => ctx.notify('Copied', 'success'),
        () => ctx.notify('Could not copy', 'error'),
      );
      return;
    }
    const a = target.closest<HTMLAnchorElement>('a');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.external) return openExternal(a.href);
    if (a.classList.contains('md-anchor')) return goTo(a.getAttribute('href')!.slice(1));
    if (a.dataset.doc) show(a.dataset.doc, a.dataset.anchor);
  });

  main.addEventListener('scroll', () => {
    if (spyFrame) return;
    spyFrame = requestAnimationFrame(() => {
      spyFrame = 0;
      spy();
    });
  }, { passive: true });

  query.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(search, 140);
  });
  query.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchTimer);
      if (!hits.length) search();
      else step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape' && query.value) {
      e.stopPropagation();
      query.value = '';
      search();
    }
  });
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  projectBtn.addEventListener('click', () => projectProduct && show(projectProduct));

  const offOpen = ctx.events.on('pane.open', (e: { id: string; args?: { doc?: string; anchor?: string; query?: string } }) => {
    if (e.id !== 'docs' || !e.args) return;
    const { doc, anchor, query: q } = e.args;
    if (typeof q === 'string') {
      query.value = q;
      search();
    }
    if (doc) show(doc === 'project' && projectProduct ? projectProduct : doc, anchor);
  });
  const offProject = ctx.project.onChange(onProject);

  ctx.commands.register({ id: 'docs.contract', title: 'Docs: Extension Contract', run: () => ctx.openPane('docs', { doc: 'contract' }) });
  ctx.commands.register({ id: 'docs.sdk', title: 'Docs: SDK reference', run: () => ctx.openPane('docs', { doc: 'sdk' }) });
  ctx.commands.register({ id: 'docs.manual', title: 'Docs: form.ext Manual', run: () => ctx.openPane('docs', { doc: 'manual' }) });
  ctx.commands.register({ id: 'docs.search', title: 'Docs: Search', run: () => { ctx.openPane('docs'); query.focus(); query.select(); } });
  for (const p of HOSTS) {
    if (docById(p.id)) ctx.commands.register({ id: `docs.app.${p.id}`, title: `Docs: ${p.name} API`, run: () => ctx.openPane('docs', { doc: p.id }) });
  }

  onProject(ctx.project.current());
  show(storage.get(DOC_KEY) ?? 'contract');

  return () => {
    offOpen();
    offProject();
    clearTimeout(searchTimer);
    if (spyFrame) cancelAnimationFrame(spyFrame);
  };
}

export const pane: PaneDef = { id: 'docs', title: 'Docs', icon: 'docs', order: 10, group: 'learn', view: 'start', mount };
