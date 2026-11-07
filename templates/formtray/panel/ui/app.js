import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#tiles');
const SIZES = ['s', 'm', 'l'];

function title(tile, apps) {
  if (tile.kind === 'app') return apps.find((a) => a.id === tile.app)?.name ?? tile.app;
  if (tile.kind === 'group') return `${tile.name} (${(tile.apps ?? []).length} apps)`;
  if (tile.kind === 'extension') return `Extension ${tile.extension}: ${tile.panel}`;
  return tile.tile;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('all');
    const apps = doc.apps ?? [];
    const board = doc.board ?? [];
    fill($('#sub'), `${plural(board.length, 'tile')}, view ${esc(doc.view ?? '')}`);
    fill(
      list,
      board
        .map(
          (t, i) => `<li data-tile="${esc(t.tile)}" data-index="${i}">
            <span class="name">${esc(title(t, apps))}</span>
            ${SIZES.map((s) => `<button class="small${t.size === s ? ' primary' : ''}" data-size="${s}" type="button">${s.toUpperCase()}</button>`).join('')}
            <button class="small" data-move="-1" type="button"${i === 0 ? ' disabled' : ''}>Up</button>
            <button class="small" data-move="1" type="button"${i === board.length - 1 ? ' disabled' : ''}>Down</button>
            <button class="small" data-remove type="button">Remove</button>
          </li>`,
        )
        .join('') || '<li class="empty">The board is empty</li>',
    );
    const off = apps.filter((a) => a.installed && !a.onBoard && !a.hidden);
    fill($('#app'), off.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('') || '<option value="">Every app is on the board</option>');
    $('#add').disabled = !off.length;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-tile]');
  const b = event.target.closest('button');
  if (!row || !b) return;
  const tile = row.dataset.tile;
  try {
    if (b.dataset.size) await formext.apply('Resize tile', [{ command: 'board.resize', args: { tile, size: b.dataset.size } }]);
    else if (b.dataset.move) await formext.apply('Move tile', [{ command: 'board.move', args: { tile, index: Number(row.dataset.index) + Number(b.dataset.move) } }]);
    else if (b.dataset.remove !== undefined) await formext.apply('Remove tile', [{ command: 'board.remove', args: { tile } }]);
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#add').addEventListener('click', async () => {
  const app = $('#app').value;
  if (!app) return;
  try {
    await formext.apply('Add tile', [{ command: 'board.add', args: { app, size: 'm' } }]);
    status(`${app} is on the board`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'apps.changed' || name === 'selection.changed') later();
});

await formext.hello();
fitHeight();
refresh();
