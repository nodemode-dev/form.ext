import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

async function watermark(args) {
  const summary = await formext.readDocument('summary');
  if (!summary.open) throw new Error('Open a PDF first.');
  const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== '' && v !== undefined));
  const result = await formext.apply('Watermark', [{ command: 'watermark', args: clean }]);
  return { pages: result.pages ?? summary.pages };
}

async function refresh() {
  try {
    const summary = await formext.readDocument('summary');
    fill($('#sub'), summary.open ? `${esc(summary.name)}, ${plural(summary.pages, 'page')}` : 'No PDF open');
    $('#apply').disabled = !summary.open;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#apply').addEventListener('click', async () => {
  const args = {
    text: $('#text').value.trim(),
    color: $('#color').value,
    angle: Number($('#angle').value),
    opacity: Number($('#opacity').value),
    size: 64,
    pages: $('#pages').value.trim(),
  };
  if (!args.text) return status('Type the words first.');
  try {
    await formext.storageSet('watermark', args);
    await watermark(args);
    status('Watermark added. Undo takes it back.', 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const r = await watermark({ text: 'DRAFT', color: '#888888', angle: 45, opacity: 0.18, size: 96 });
  await formext.notify(`Marked ${plural(r.pages, 'page')} as draft`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 200);
formext.onEvent(({ name }) => {
  if (name === 'document.changed') later();
});

await formext.hello();
const saved = await formext.storageGet('watermark').catch(() => null);
if (saved) {
  $('#text').value = saved.text ?? $('#text').value;
  $('#color').value = saved.color ?? $('#color').value;
  $('#angle').value = String(saved.angle ?? 45);
  $('#opacity').value = String(saved.opacity ?? 0.2);
  $('#pages').value = saved.pages ?? '';
}
refresh();
