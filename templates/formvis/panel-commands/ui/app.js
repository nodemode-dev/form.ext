import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless } from './kit.js';

const DEFAULTS = { color: '#ffffff', width: 4 };

async function settings() {
  return { ...DEFAULTS, ...((await formext.storageGet('frame')) ?? {}) };
}

async function addFrame(opts) {
  const doc = await formext.readDocument('document');
  if (!doc.open) throw new Error('Open a picture first.');
  const t = Math.max(1, Math.round((Math.min(doc.width, doc.height) * opts.width) / 100));
  const { width: w, height: h } = doc;
  const bar = (x, y, width, height) => ({ command: 'tool:draw_shape', args: { kind: 'rectangle', x, y, width, height, fill: opts.color } });
  const result = await formext.apply('Add Frame', [bar(0, 0, w, t), bar(0, h - t, w, t), bar(0, t, t, h - 2 * t), bar(w - t, t, t, h - 2 * t)]);
  return { applied: result.applied, thickness: t };
}

async function refresh() {
  try {
    const doc = await formext.readDocument('document');
    fill($('#sub'), doc.open ? `${esc(doc.name)}, ${doc.width} x ${doc.height}` : 'No document open');
    $('#add').disabled = !doc.open;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#add').addEventListener('click', async () => {
  const opts = { color: $('#color').value, width: Number($('#width').value) || DEFAULTS.width };
  try {
    await formext.storageSet('frame', opts);
    const r = await addFrame(opts);
    status(`Frame added, ${r.thickness} px wide`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const r = await addFrame(await settings());
  await formext.notify(`Frame added, ${r.thickness} px wide`, 'success');
  return r;
});

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'document.switched') later();
});

await formext.hello();
const saved = await settings().catch(() => DEFAULTS);
$('#color').value = saved.color;
$('#width').value = String(saved.width);
refresh();
