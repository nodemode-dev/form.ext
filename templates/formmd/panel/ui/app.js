import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#headings');

function count(text) {
  return (String(text ?? '').match(/\S+/g) ?? []).length;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('blocks');
    if (!doc.page) {
      fill($('#sub'), 'No page open');
      fill(list, '<li class="empty">Open a page in form.md</li>');
      return;
    }
    const sections = [];
    let total = 0;
    for (const b of doc.blocks ?? []) {
      if (b.type === 'heading') sections.push({ id: b.id, level: b.level ?? 1, text: b.text, words: 0 });
      else {
        const n = count(b.text);
        total += n;
        if (sections.length) sections[sections.length - 1].words += n;
      }
    }
    fill($('#sub'), `${esc(doc.page.title || 'Untitled')}, ${plural(sections.length, 'heading')}, ${plural(total, 'word')}`);
    fill(
      list,
      sections
        .map(
          (s) => `<li class="pick" data-block="${esc(s.id)}">
            <span class="name" style="padding-left:${(s.level - 1) * 14}px">${esc(s.text || 'Untitled heading')}</span>
            <span class="meta">${s.words}</span>
          </li>`,
        )
        .join('') || '<li class="empty">The page has no headings</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-block]');
  if (!row) return;
  try {
    await formext.apply('Go to heading', [{ command: 'doc.select', args: { block: row.dataset.block } }]);
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed') later();
});

await formext.hello();
fitHeight();
refresh();
