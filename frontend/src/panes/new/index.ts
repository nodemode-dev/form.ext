import './new.css';
import { icon, appIcon, HOSTS, esc, setText, lastArgs, storage, errorMessage } from '../../shell';
import type { PaneDef, ShellContext } from '../../shell';

interface Starter {
  product: string;
  starter: string;
  title: string;
  name: string;
  summary: string;
  uses: string[];
  description: string;
  permissions: string[];
  panels: { id: string; title: string; location: string }[];
  commands: { id: string; title: string; panel?: string }[];
}

interface Catalogue {
  starters: { id: string; title: string; summary: string }[];
  products: { id: string; name: string; docs: string | null; starters: Starter[] }[];
}

const STARTERS = [
  { id: 'panel', title: 'Panel', summary: 'A panel that reads the open document, follows its events and changes it.' },
  { id: 'command', title: 'Command', summary: 'A command that runs without a panel, changes the document in one step and finishes.' },
  { id: 'panel-commands', title: 'Panel with commands', summary: 'A panel, a command that opens it, and a headless command that shares its code.' },
];

const STARTER_ICON: Record<string, string> = { panel: 'panel', command: 'command', 'panel-commands': 'layers' };
const PRODUCT_KEY = 'formext.new.product';
const STARTER_KEY = 'formext.new.starter';
const PLAIN: Record<string, string> = {
  document: 'read and change the open document',
  'files-read': 'open files you choose',
  'files-write': 'save files where you choose',
  network: 'reach the internet',
  models: 'use local models',
};

function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? '' : 's'}`;
}

function mount(el: HTMLElement, ctx: ShellContext): () => void {
  let catalogue: Catalogue | null = null;
  let product = String(storage.get(PRODUCT_KEY) ?? HOSTS[0].id);
  let starter = String(storage.get(STARTER_KEY) ?? 'panel');
  let nameTouched = false;
  let busy = false;
  if (!HOSTS.some((p) => p.id === product)) product = HOSTS[0].id;
  if (!STARTERS.some((s) => s.id === starter)) starter = 'panel';

  el.innerHTML = `
    <div class="pane-fill new-pane">
      <header class="pane-head">
        <span class="new-mark">${icon('new', 18)}</span>
        <div>
          <h1>New Extension</h1>
          <div class="sub">Pick the app, pick a starter, name it. form.ext writes a project that works from the first run.</div>
        </div>
      </header>
      <div class="pane-body new-body">
        <section class="section new-step">
          <div class="section-title"><span class="new-num">1</span>App</div>
          <div class="new-apps" role="radiogroup" aria-label="App">
            ${HOSTS.map((p) => `<button class="card interactive new-app" type="button" role="radio" data-product="${p.id}" aria-checked="false">${appIcon(p.id, true)}<span class="new-app-text"><strong>${esc(p.name)}</strong><span>${esc(p.blurb)}</span></span></button>`).join('')}
          </div>
        </section>
        <section class="section new-step">
          <div class="section-title"><span class="new-num">2</span>Starter</div>
          <div class="new-starters" role="radiogroup" aria-label="Starter">
            ${STARTERS.map((s) => `<button class="card interactive new-starter" type="button" role="radio" data-starter="${s.id}" aria-checked="false">
              <span class="new-starter-head">${icon(STARTER_ICON[s.id])}<strong>${esc(s.title)}</strong></span>
              <span class="new-starter-name">&nbsp;</span>
              <span class="new-starter-summary">${esc(s.summary)}</span>
              <span class="new-starter-chips"><span class="chip">&nbsp;</span></span>
            </button>`).join('')}
          </div>
        </section>
        <section class="section new-step">
          <div class="section-title"><span class="new-num">3</span>Name</div>
          <form class="new-form" novalidate>
            <div class="new-fields">
              <div class="field">
                <label for="new-name">Name</label>
                <input class="input" id="new-name" name="name" maxlength="64" autocomplete="off" spellcheck="false" required />
                <div class="hint new-id">&nbsp;</div>
              </div>
              <div class="field">
                <label for="new-desc">Description</label>
                <textarea class="textarea" id="new-desc" name="description" maxlength="400" rows="3" placeholder="One sentence that says what it does. Leave it empty to keep the starter's."></textarea>
              </div>
              <div class="new-actions">
                <button class="btn primary lg new-create" type="submit">${icon('plus')}<span>Create Extension</span></button>
                <span class="new-msg">&nbsp;</span>
              </div>
            </div>
            <aside class="new-detail card">
              <div class="new-detail-head"><span class="new-detail-icon">${appIcon(product)}</span><div><strong class="new-detail-title">&nbsp;</strong><div class="new-detail-sub">&nbsp;</div></div></div>
              <div class="new-detail-group"><div class="section-title">Asks for</div><ul class="new-perms"><li>&nbsp;</li></ul></div>
              <div class="new-detail-group"><div class="section-title">Adds</div><ul class="new-adds"><li>&nbsp;</li></ul></div>
              <div class="new-detail-group"><div class="section-title">Uses</div><div class="new-uses"><span class="chip">&nbsp;</span></div></div>
            </aside>
          </form>
        </section>
      </div>
    </div>`;

  const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const nameInput = q<HTMLInputElement>('#new-name');
  const descInput = q<HTMLTextAreaElement>('#new-desc');
  const createBtn = q<HTMLButtonElement>('.new-create');

  function current(): Starter | null {
    return catalogue?.products.find((p) => p.id === product)?.starters.find((s) => s.starter === starter) ?? null;
  }

  function slugOf(text: string): string {
    let out = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
    if (out.length < 2) out = `${out}-extension`.replace(/^-+/, '');
    return out;
  }

  function updateId(): void {
    const name = nameInput.value.trim();
    setText(q('.new-id'), name ? `Id ${slugOf(name)} (a number is added if a project has it already)` : 'The id is made from the name.');
    createBtn.disabled = busy || !name || !current();
  }

  function render(): void {
    for (const b of el.querySelectorAll<HTMLElement>('.new-app')) b.setAttribute('aria-checked', String(b.dataset.product === product));
    for (const b of el.querySelectorAll<HTMLElement>('.new-starter')) {
      b.setAttribute('aria-checked', String(b.dataset.starter === starter));
      const s = catalogue?.products.find((p) => p.id === product)?.starters.find((x) => x.starter === b.dataset.starter);
      setText(b.querySelector('.new-starter-name'), s ? s.name : ' ');
      const chips = b.querySelector('.new-starter-chips')!;
      const html = s
        ? [s.panels.length ? `<span class="chip">${plural(s.panels.length, 'panel')}</span>` : '', s.commands.length ? `<span class="chip">${plural(s.commands.length, 'command')}</span>` : '', ...s.permissions.map((p) => `<span class="chip hue" data-product="${product}">${esc(p)}</span>`)].join('')
        : '<span class="chip">&nbsp;</span>';
      if (chips.innerHTML !== html) chips.innerHTML = html;
    }
    const s = current();
    const host = HOSTS.find((p) => p.id === product)!;
    const iconSlot = q('.new-detail-icon');
    const iconHtml = appIcon(product);
    if (iconSlot.innerHTML !== iconHtml) iconSlot.innerHTML = iconHtml;
    setText(q('.new-detail-title'), s ? `${s.name} for ${host.name}` : host.name);
    setText(q('.new-detail-sub'), s ? s.description : ' ');
    const perms = s ? s.permissions.map((p) => `<li><span class="chip hue" data-product="${product}">${esc(p)}</span><span>${esc(PLAIN[p] ?? p)}</span></li>`).join('') || '<li>Nothing that needs consent</li>' : '<li>&nbsp;</li>';
    const adds = s
      ? [...s.panels.map((p) => `<li>${icon('panel')}<span>Panel <b>${esc(p.title)}</b>, ${p.location === 'dialog' ? 'a dialog' : 'docked'}</span></li>`), ...s.commands.map((c) => `<li>${icon('command')}<span>Command <b>${esc(c.title)}</b>${c.panel ? ', opens the panel' : ', runs headless'}</span></li>`)].join('')
      : '<li>&nbsp;</li>';
    const uses = s ? s.uses.map((u) => `<span class="chip"><code>${esc(u)}</code></span>`).join('') : '<span class="chip">&nbsp;</span>';
    const permsEl = q('.new-perms');
    if (permsEl.innerHTML !== perms) permsEl.innerHTML = perms;
    const addsEl = q('.new-adds');
    if (addsEl.innerHTML !== adds) addsEl.innerHTML = adds;
    const usesEl = q('.new-uses');
    if (usesEl.innerHTML !== uses) usesEl.innerHTML = uses;
    if (!nameTouched && s) nameInput.value = s.name;
    updateId();
  }

  function choose(p?: string, s?: string): void {
    if (p && HOSTS.some((h) => h.id === p)) {
      product = p;
      storage.set(PRODUCT_KEY, p);
    }
    if (s && STARTERS.some((x) => x.id === s)) {
      starter = s;
      storage.set(STARTER_KEY, s);
    }
    render();
  }

  function arrows(group: string, attr: string, pick: (v: string) => void) {
    q(group).addEventListener('keydown', (ev: KeyboardEvent) => {
      const items = [...el.querySelectorAll<HTMLElement>(`${group} [${attr}]`)];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      const step = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      const next = items[(i + step + items.length) % items.length];
      next.focus();
      pick(next.getAttribute(attr)!);
    });
  }

  q('.new-apps').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-product]');
    if (b) choose(b.dataset.product);
  });
  q('.new-starters').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-starter]');
    if (b) choose(undefined, b.dataset.starter);
  });
  arrows('.new-apps', 'data-product', (v) => choose(v));
  arrows('.new-starters', 'data-starter', (v) => choose(undefined, v));

  nameInput.addEventListener('input', () => {
    nameTouched = nameInput.value.trim() !== '' && nameInput.value !== current()?.name;
    updateId();
  });

  q<HTMLFormElement>('.new-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (!name || busy || !current()) return;
    busy = true;
    updateId();
    setText(q('.new-msg'), 'Writing the project');
    try {
      const made = await ctx.api.post<{ id: string; name: string }>('/api/templates/create', {
        product,
        starter,
        name,
        description: descInput.value.trim() || undefined,
      });
      await ctx.project.open(made.id);
      ctx.notify(`${made.name} is ready. Preview runs it, Check looks it over.`, 'success');
      nameTouched = false;
      descInput.value = '';
      setText(q('.new-msg'), ' ');
      ctx.openPane('edit', { path: `package/ui/app.js`, from: 'new' });
    } catch (err) {
      setText(q('.new-msg'), errorMessage(err));
      ctx.notify(errorMessage(err), 'error');
    } finally {
      busy = false;
      updateId();
    }
  });

  ctx.commands.register({ id: 'new.extension', title: 'New Extension', keys: 'Mod+N', run: () => ctx.openPane('new') });

  const off = ctx.events.on('pane.open', (d: { id: string; args?: { product?: string; starter?: string; name?: string } }) => {
    if (d?.id !== 'new') return;
    const a = d.args ?? {};
    if (a.name) {
      nameInput.value = a.name;
      nameTouched = true;
    }
    choose(a.product, a.starter);
    nameInput.focus();
  });

  const first = lastArgs('new') as { product?: string; starter?: string } | undefined;
  if (first) choose(first.product, first.starter);
  else render();

  ctx.api
    .get<Catalogue>('/api/templates')
    .then((c) => {
      catalogue = c;
      render();
    })
    .catch((err) => {
      setText(q('.new-msg'), `The starters could not be read: ${errorMessage(err)}`);
    });

  return off;
}

export const pane: PaneDef = { id: 'new', title: 'New', icon: 'new', order: 10, group: 'make', mount };
