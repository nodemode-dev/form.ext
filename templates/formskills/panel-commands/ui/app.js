import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const list = $('#hits');
let hits = [];

async function search() {
  const query = $('#query').value.trim();
  if (query.length < 2) {
    hits = [];
    fill(list, '<li class="empty">Type two letters or more</li>');
    fill($('#sub'), '&nbsp;');
    return;
  }
  try {
    const found = await formext.run('search', { query });
    if (query !== $('#query').value.trim()) return;
    hits = Array.isArray(found) ? found : (found?.hits ?? []);
    fill($('#sub'), plural(hits.length, 'hit'));
    fill(
      list,
      hits
        .map(
          (h, i) => `<li class="pick" data-i="${i}">
            <span class="name">${esc(h.name)} <span class="meta">${esc(h.app)}${h.path ? `, ${esc(h.path)}` : ''}</span><br /><span class="meta">${esc(h.snippet || h.description || '')}</span></span>
          </li>`,
        )
        .join('') || '<li class="empty">Nothing matches</li>',
    );
    await formext.storageSet('query', query);
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-i]');
  if (!row) return;
  const h = hits[Number(row.dataset.i)];
  try {
    await formext.run('open-skill', { app: h.app, skill: h.folder });
    if (h.path) await formext.run('open-file', { path: h.path.replace(new RegExp(`^${h.folder}/`), '') });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#query').addEventListener('input', debounce(search, 250));

headless(async () => {
  const view = await formext.readDocument('selection');
  const r = view.reading;
  if (!r) throw new Error('Open a skill in the reader first.');
  const saved = (await formext.run('download', { app: r.app, skill: r.folder })) ?? {};
  await formext.notify(`Saved ${saved.name ?? r.name} in Downloads`, 'success');
  return saved;
});

await formext.hello();
const last = await formext.storageGet('query').catch(() => null);
if (last) {
  $('#query').value = last;
  search();
}
