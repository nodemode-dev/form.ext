import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#pages');
let current = 0;

function words(text) {
  return (text.match(/\S+/g) ?? []).length;
}

async function refresh() {
  try {
    const summary = await formext.readDocument('summary');
    if (!summary.open) {
      fill($('#sub'), 'No PDF open');
      fill(list, '<li class="empty">Open a PDF in formpdf</li>');
      return;
    }
    current = summary.page;
    const { pages = [] } = await formext.readDocument('text');
    const total = pages.reduce((n, p) => n + words(p.text ?? ''), 0);
    fill($('#sub'), `${esc(summary.name)}, ${plural(summary.pages, 'page')}, ${plural(total, 'word')}`);
    fill(
      list,
      pages
        .map((p) => {
          const n = words(p.text ?? '');
          const first = (p.text ?? '').trim().split('\n')[0].slice(0, 80);
          return `<li class="pick${n ? '' : ' off'}" data-page="${p.page}" aria-selected="${p.page === current}">
            <span class="meta">${p.page}</span>
            <span class="name">${esc(first || 'No text on this page')}</span>
            <span class="meta">${n}</span>
          </li>`;
        })
        .join(''),
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-page]');
  if (!row) return;
  try {
    await formext.run('pdf-go-page', { page: Number(row.dataset.page) });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 200);
formext.onActivate(() => null);
formext.onEvent(({ name, data }) => {
  if (name === 'document.changed') later();
  if (name === 'selection.changed' && data?.page !== current) {
    current = data.page;
    for (const li of list.querySelectorAll('li[data-page]')) li.setAttribute('aria-selected', String(Number(li.dataset.page) === current));
  }
});

await formext.hello();
fitHeight();
refresh();
