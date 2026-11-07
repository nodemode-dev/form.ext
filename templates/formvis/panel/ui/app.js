import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#layers');

function flatten(layers, depth = 0, out = []) {
  for (const layer of layers ?? []) {
    out.push({ ...layer, depth });
    if (layer.children) flatten(layer.children, depth + 1, out);
  }
  return out;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('document');
    if (!doc.open) {
      fill($('#sub'), 'No document open');
      fill(list, '<li class="empty">Open a picture in FormVis</li>');
      return;
    }
    const tree = await formext.readDocument('layers');
    const layers = flatten(tree?.layers ?? doc.layers).reverse();
    fill($('#sub'), `${esc(doc.name)}, ${doc.width} x ${doc.height}, ${plural(layers.length, 'layer')}`);
    fill(
      list,
      layers
        .map(
          (l) => `<li class="pick${l.visible ? '' : ' off'}" data-id="${esc(l.id)}" aria-selected="${l.id === doc.activeLayerId}">
            <button class="small" data-eye="${esc(l.id)}" data-visible="${l.visible}" title="Show or hide">${l.visible ? 'Hide' : 'Show'}</button>
            <span class="name" style="padding-left:${l.depth * 12}px">${l.id === doc.activeLayerId ? '<b>' : ''}${esc(l.name)}${l.id === doc.activeLayerId ? '</b>' : ''}</span>
            <span class="meta">${esc(l.kind)} ${Math.round((l.opacity ?? 1) * 100)}%</span>
          </li>`,
        )
        .join('') || '<li class="empty">The document has no layers</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const eye = event.target.closest('[data-eye]');
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  try {
    if (eye) {
      const visible = eye.dataset.visible !== 'true';
      await formext.apply('Layer visibility', [{ command: 'tool:set_layer', args: { id: eye.dataset.eye, visible } }]);
      status(visible ? 'Layer shown' : 'Layer hidden');
    } else {
      await formext.run('tool:set_layer', { id: row.dataset.id, active: true });
    }
    refresh();
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'layer.activated' || name === 'document.switched') later();
});

await formext.hello();
fitHeight();
refresh();
