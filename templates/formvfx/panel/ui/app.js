import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#layers');
let time = 0;

async function refresh() {
  try {
    const doc = await formext.readDocument('summary');
    time = doc.time ?? 0;
    if (!doc.comp) {
      fill($('#sub'), 'No composition open');
      fill(list, '<li class="empty">Open a composition in FormVFX</li>');
      return;
    }
    const c = doc.comp;
    fill($('#sub'), `${esc(c.name)}, ${c.width} x ${c.height}, ${c.frameRate} fps, ${plural(doc.layers.length, 'layer')}, at ${time.toFixed(2)} s`);
    fill(
      list,
      doc.layers
        .map(
          (l) => `<li class="pick" data-id="${l.id}" aria-selected="${l.selected}">
            <span class="meta">${l.index}</span>
            <span class="name">${l.selected ? '<b>' : ''}${esc(l.name)}${l.selected ? '</b>' : ''}<br /><span class="meta">${esc(l.type)}${l.effects?.length ? `, ${plural(l.effects.length, 'effect')}` : ''}${l.masks ? `, ${plural(l.masks, 'mask')}` : ''}</span></span>
            <span class="meta">${l.in.toFixed(2)} to ${l.out.toFixed(2)} s</span>
          </li>`,
        )
        .join('') || '<li class="empty">The composition is empty</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  try {
    await formext.run('layer.select', { layers: [Number(row.dataset.id)], toggle: event.shiftKey || event.metaKey || event.ctrlKey });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#marker').addEventListener('click', async () => {
  try {
    const doc = await formext.readDocument('summary');
    const chosen = doc.layers.filter((l) => l.selected);
    if (!chosen.length) return status('Select a layer first.');
    const comment = $('#comment').value.trim();
    await formext.apply('Layer markers', chosen.map((l) => ({ command: 'layer.addMarker', args: { layer: l.id, time: doc.time - l.start, comment } })));
    $('#comment').value = '';
    status(`${plural(chosen.length, 'marker')} added at ${doc.time.toFixed(2)} s`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed' || name === 'comp.changed' || name === 'time.changed') later();
});

await formext.hello();
fitHeight();
refresh();
