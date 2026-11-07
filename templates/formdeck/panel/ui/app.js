import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#slides');
let slides = [];
let chosen = null;
let dirty = false;

function show(id) {
  chosen = slides.find((s) => s.id === id) ?? null;
  for (const li of list.querySelectorAll('li[data-id]')) li.setAttribute('aria-selected', String(li.dataset.id === chosen?.id));
  $('#notes').disabled = !chosen;
  $('#save').disabled = !chosen;
  $('#notes').value = chosen?.notes ?? '';
  dirty = false;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('deck');
    slides = doc.slides ?? [];
    const empty = slides.filter((s) => !s.notes?.trim()).length;
    fill($('#sub'), `${esc(doc.deck?.title ?? 'Deck')}, ${plural(slides.length, 'slide')}, ${empty} without notes`);
    fill(
      list,
      slides
        .map(
          (s) => `<li class="pick${s.hidden ? ' off' : ''}" data-id="${esc(s.id)}">
            <span class="meta">${s.n}</span>
            <span class="name">${esc(s.title || 'Untitled slide')}</span>
            <span class="meta">${s.notes?.trim() ? plural(s.notes.trim().split(/\s+/).length, 'word') : 'no notes'}</span>
          </li>`,
        )
        .join('') || '<li class="empty">The deck has no slides</li>',
    );
    if (!dirty) show(chosen?.id ?? doc.current?.slide);
  } catch (err) {
    fill(list, `<li class="empty">${esc(errorText(err))}</li>`);
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  show(row.dataset.id);
  try {
    await formext.run('go-to-slide', { number: chosen.n });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#notes').addEventListener('input', () => (dirty = true));

$('#save').addEventListener('click', async () => {
  if (!chosen) return;
  try {
    await formext.apply('Edit speaker notes', [{ command: 'apply-ops', args: { ops: [{ op: 'set', path: ['slides', { id: chosen.id }, 'notes'], value: $('#notes').value }] } }]);
    dirty = false;
    status(`Notes saved for slide ${chosen.n}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'deck.opened') later();
});

await formext.hello();
fitHeight();
refresh();
