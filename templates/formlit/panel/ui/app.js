import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#photos');

function exposure(p) {
  const parts = [];
  if (p.focal) parts.push(`${p.focal} mm`);
  if (p.aperture) parts.push(`f/${p.aperture}`);
  if (p.shutter) parts.push(p.shutter < 1 ? `1/${Math.round(1 / p.shutter)} s` : `${p.shutter} s`);
  if (p.iso) parts.push(`ISO ${p.iso}`);
  return parts.join(', ');
}

async function refresh() {
  try {
    const sel = await formext.readDocument('selection');
    const photos = sel.photos ?? [];
    fill($('#sub'), `${plural(sel.count ?? photos.length, 'photo')} selected${sel.truncated ? ', showing the first 500' : ''}`);
    fill(
      list,
      photos
        .map(
          (p) => `<li class="${p.flag === 'reject' ? 'off' : ''}">
            <span class="name">${esc(p.file)}<br /><span class="meta">${esc([p.camera, exposure(p)].filter(Boolean).join(', ') || p.captureTime || '')}</span></span>
            <span class="meta">${'*'.repeat(p.rating || 0) || '-'}</span>
            <span class="meta">${p.flag === 'none' ? '' : esc(p.flag)}</span>
          </li>`,
        )
        .join('') || '<li class="empty">Select photos in the Library</li>',
    );
    for (const b of document.querySelectorAll('#actions button')) b.disabled = !photos.length;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#actions').addEventListener('click', async (event) => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.rating !== undefined) {
      await formext.apply('Rate photos', [{ command: 'photo.rate', args: { ids: 'selection', rating: Number(b.dataset.rating) } }]);
      status(`Rated ${b.dataset.rating}`, 'success');
    } else {
      await formext.apply('Flag photos', [{ command: 'photo.flag', args: { ids: 'selection', flag: b.dataset.flag } }]);
      status(b.dataset.flag === 'none' ? 'Flags cleared' : `Flagged ${b.dataset.flag}`, 'success');
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
fitHeight();
refresh();
