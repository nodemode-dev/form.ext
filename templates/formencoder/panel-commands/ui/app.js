import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const list = $('#presets');
let presets = [];

async function selectedCount() {
  const sel = await formext.readDocument('selection');
  return sel.outputs?.length ?? 0;
}

async function applyPreset(preset) {
  const n = await selectedCount();
  if (!n) throw new Error('Select outputs in the Queue panel first.');
  await formext.apply('Change preset', [{ command: 'queue.setPreset', args: { refs: 'selected', preset: preset.id } }]);
  await formext.storageSet('last', { id: preset.id, name: preset.name });
  return { preset: preset.id, outputs: n };
}

function draw() {
  const words = $('#search').value.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = presets.filter((p) => words.every((w) => `${p.name} ${p.category} ${p.format} ${p.id}`.toLowerCase().includes(w))).slice(0, 80);
  fill(
    list,
    shown
      .map(
        (p) => `<li class="pick" data-id="${esc(p.id)}">
          <span class="name">${esc(p.name)}<br /><span class="meta">${esc([p.category, p.format, p.size ?? p.frameSize, p.rate ?? p.frameRate].filter(Boolean).join(', '))}</span></span>
        </li>`,
      )
      .join('') || '<li class="empty">No preset matches</li>',
  );
}

async function refresh() {
  try {
    const r = await formext.readDocument('presets');
    presets = r.presets ?? (Array.isArray(r) ? r : []);
    const n = await selectedCount();
    fill($('#sub'), `${plural(presets.length, 'preset')}, ${plural(n, 'output')} selected`);
    draw();
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#search').addEventListener('input', draw);

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-id]');
  if (!row) return;
  const preset = presets.find((p) => p.id === row.dataset.id);
  try {
    const r = await applyPreset(preset);
    status(`${preset.name} on ${plural(r.outputs, 'output')}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const last = await formext.storageGet('last');
  if (!last) throw new Error('Choose a preset in the Preset Switch panel first.');
  const r = await applyPreset(last);
  await formext.notify(`${last.name} on ${plural(r.outputs, 'output')}`, 'success');
  return r;
}, refresh);

const later = debounce(async () => fill($('#sub'), `${plural(presets.length, 'preset')}, ${plural(await selectedCount(), 'output')} selected`), 150);
formext.onEvent(({ name }) => {
  if (name === 'selection.changed' || name === 'document.changed') later();
});

await formext.hello();
refresh();
