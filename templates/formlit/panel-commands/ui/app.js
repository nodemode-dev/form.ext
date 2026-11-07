import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const list = $('#favourites');
let favourites = [];
let onPhotos = new Map();

async function stamp(keyword) {
  const summary = await formext.readDocument('summary');
  const count = summary.selectionCount ?? 0;
  if (!count) throw new Error('Select photos in the Library first.');
  await formext.apply(`Keyword ${keyword}`, [{ command: 'photo.addKeywords', args: { ids: 'selection', keywords: [keyword] } }]);
  favourites = [keyword, ...favourites.filter((k) => k !== keyword)].slice(0, 12);
  await formext.storageSet('favourites', favourites);
  return { keyword, photos: count };
}

async function refresh() {
  try {
    const sel = await formext.readDocument('selection');
    const photos = sel.photos ?? [];
    onPhotos = new Map();
    for (const p of photos) for (const k of p.keywords ?? []) onPhotos.set(k, (onPhotos.get(k) ?? 0) + 1);
    fill($('#sub'), `${plural(photos.length, 'photo')} selected`);
    const keys = [...new Set([...favourites, ...onPhotos.keys()])];
    fill(
      list,
      keys
        .map(
          (k) => `<li data-key="${esc(k)}">
            <span class="name">${esc(k)}</span>
            <span class="meta">${onPhotos.get(k) ?? 0} of ${photos.length}</span>
            <button class="small" data-add type="button">Add</button>
            <button class="small" data-remove type="button"${onPhotos.get(k) ? '' : ' disabled'}>Remove</button>
          </li>`,
        )
        .join('') || '<li class="empty">Type a keyword and stamp it</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#stamp').addEventListener('click', async () => {
  const keyword = $('#keyword').value.trim();
  if (!keyword) return status('Type a keyword first.');
  try {
    const r = await stamp(keyword);
    $('#keyword').value = '';
    status(`${r.keyword} added to ${plural(r.photos, 'photo')}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-key]');
  if (!row) return;
  const keyword = row.dataset.key;
  try {
    if (event.target.closest('[data-add]')) {
      const r = await stamp(keyword);
      status(`${r.keyword} added to ${plural(r.photos, 'photo')}`, 'success');
    } else if (event.target.closest('[data-remove]')) {
      await formext.apply('Remove keyword', [{ command: 'photo.removeKeywords', args: { ids: 'selection', keywords: [keyword] } }]);
      status(`${keyword} removed`, 'success');
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const saved = (await formext.storageGet('favourites')) ?? [];
  if (!saved.length) throw new Error('Stamp a keyword from the Keyword Stamp panel first.');
  favourites = saved;
  const r = await stamp(saved[0]);
  await formext.notify(`${r.keyword} added to ${plural(r.photos, 'photo')}`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
favourites = (await formext.storageGet('favourites').catch(() => null)) ?? [];
refresh();
