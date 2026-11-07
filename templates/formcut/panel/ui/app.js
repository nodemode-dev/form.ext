import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#markers');
let fps = 30;

function timecode(t) {
  const s = Math.max(0, t);
  const f = Math.floor((s % 1) * fps);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(Math.floor(s) % 60)}:${pad(f)}`;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('project');
    fps = doc.project?.fps || 30;
    const markers = [...(doc.timeline?.markers ?? [])].sort((a, b) => a.t - b.t);
    fill($('#sub'), `${esc(doc.timeline?.name ?? 'No timeline')}, ${plural(markers.length, 'marker')}, playhead ${timecode(doc.project?.playhead ?? 0)}`);
    fill(
      list,
      markers
        .map(
          (m) => `<li class="pick" data-id="${esc(m.id)}" data-t="${m.t}">
            <span class="meta">${timecode(m.t)}</span>
            <span class="name">${esc(m.note || 'Marker')}</span>
            <button class="small" data-rename="${esc(m.id)}" type="button">Rename</button>
            <button class="small" data-remove="${esc(m.id)}" type="button">Remove</button>
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
    const doc = await formext.readDocument('project');
    const note = $('#note').value.trim();
    await formext.apply('Add marker', [{ command: 'marker.add', args: { t: doc.project.playhead ?? 0, note } }]);
    $('#note').value = '';
    status(`Marker added at ${timecode(doc.project.playhead ?? 0)}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  const rename = event.target.closest('[data-rename]');
  const remove = event.target.closest('[data-remove]');
  try {
    if (remove) {
      await formext.apply('Remove marker', [{ command: 'marker.remove', args: { id: row.dataset.id } }]);
    } else if (rename) {
      const note = $('#note').value.trim();
      if (!note) return status('Type the new note in the field above, then choose Rename.');
      await formext.apply('Rename marker', [{ command: 'marker.update', args: { id: row.dataset.id, note } }]);
      $('#note').value = '';
    } else {
      await formext.run('transport.seek', { time: Number(row.dataset.t) });
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 120);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'transport.changed') later();
});

await formext.hello();
fitHeight();
refresh();
