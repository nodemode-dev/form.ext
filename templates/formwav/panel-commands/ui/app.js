import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const list = $('#regions');

async function regionFromSelection(label) {
  const sel = await formext.readDocument('selection');
  if (!sel.range) throw new Error('Select a time range first.');
  const { regions = [] } = await formext.readDocument('markers');
  const name = label || `Part ${regions.length + 1}`;
  await formext.apply('Region from selection', [{ command: 'add-region', args: { start: sel.range.start, end: sel.range.end, label: name } }]);
  return { label: name, start_s: sel.range.start_s, end_s: sel.range.end_s };
}

async function refresh() {
  try {
    const session = await formext.readDocument('session');
    const regions = [...(session.regions ?? [])].sort((a, b) => a.start_s - b.start_s);
    const loop = session.loop;
    fill($('#sub'), `${esc(session.name)}, ${plural(regions.length, 'region')}`);
    fill(
      list,
      regions
        .map(
          (r) => `<li class="pick" data-start="${r.start_s}" data-end="${r.end_s}" aria-selected="${!!loop && Math.abs((loop.start_s ?? -1) - r.start_s) < 0.001}">
            <span class="name">${esc(r.label || 'Region')}</span>
            <span class="meta">${r.start_s.toFixed(2)} to ${r.end_s.toFixed(2)} s</span>
            <button class="small" type="button">Loop</button>
          </li>`,
        )
        .join('') || '<li class="empty">No regions yet. Select a range and make one.</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-start]');
  if (!row) return;
  try {
    await formext.run('session.set-loop', { start_s: Number(row.dataset.start), end_s: Number(row.dataset.end) });
    status(`Looping ${row.querySelector('.name').textContent}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#make').addEventListener('click', async () => {
  try {
    const r = await regionFromSelection($('#label').value.trim());
    $('#label').value = '';
    status(`Region ${r.label} made`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const r = await regionFromSelection('');
  await formext.notify(`Region ${r.label} made`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
refresh();
