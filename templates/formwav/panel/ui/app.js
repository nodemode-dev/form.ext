import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#markers');

function clock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
}

async function refresh() {
  try {
    const session = await formext.readDocument('session');
    const { markers = [] } = await formext.readDocument('markers');
    fill($('#sub'), `${esc(session.name)}, ${session.sample_rate} Hz, ${plural(markers.length, 'marker')}, playhead ${clock(session.playhead_s ?? 0)}`);
    fill(
      list,
      [...markers]
        .sort((a, b) => a.at - b.at)
        .map(
          (m) => `<li data-id="${esc(m.id)}">
            <span class="meta">${m.number ?? ''}</span>
            <span class="meta">${clock(m.at_s)}</span>
            <span class="name">${esc(m.label || 'Marker')}</span>
            <button class="small" data-rename type="button">Rename</button>
            <button class="small" data-remove type="button">Remove</button>
          </li>`,
        )
        .join('') || '<li class="empty">No markers yet</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#add').addEventListener('click', async () => {
  try {
    const session = await formext.readDocument('session');
    const at = Math.round((session.playhead_s ?? 0) * session.sample_rate);
    const label = $('#label').value.trim() || `Marker ${(session.markers?.length ?? 0) + 1}`;
    await formext.apply('Add marker', [{ command: 'add-marker', args: { at, label } }]);
    $('#label').value = '';
    status(`Added ${label} at ${clock(session.playhead_s ?? 0)}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  try {
    if (event.target.closest('[data-remove]')) {
      await formext.apply('Remove marker', [{ command: 'remove-marker', args: { markerId: row.dataset.id } }]);
    } else if (event.target.closest('[data-rename]')) {
      const label = $('#label').value.trim();
      if (!label) return status('Type the new label in the field above, then choose Rename.');
      await formext.apply('Rename marker', [{ command: 'set-marker', args: { markerId: row.dataset.id, label } }]);
      $('#label').value = '';
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'transport.changed') later();
});

await formext.hello();
fitHeight();
refresh();
