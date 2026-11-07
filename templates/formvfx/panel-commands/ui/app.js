import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless } from './kit.js';

async function build(o) {
  const doc = await formext.readDocument('summary');
  const c = doc.comp;
  if (!c) throw new Error('Open a composition first.');
  const w = Math.round(c.width * 0.42);
  const h = Math.round(c.height * 0.12);
  const x = Math.round(c.width * 0.06 + w / 2);
  const y = Math.round(c.height * 0.84);
  const big = Math.round(h * 0.38);
  const small = Math.round(h * 0.24);
  const left = Math.round(c.width * 0.06 + h * 0.3);
  const result = await formext.apply('Lower third', [
    { command: 'layer.newShape', args: { kind: 'rect', name: `${o.name} bar`, size: [w, h], fill: o.bar, position: [x, y] } },
    { command: 'layer.newText', args: { text: o.name, name: o.name, position: [left, y - h * 0.08], size: big, fill: o.ink, justify: 'left' } },
    { command: 'layer.newText', args: { text: o.role, name: `${o.name} role`, position: [left, y + h * 0.3], size: small, fill: o.ink, justify: 'left' } },
    { command: 'layer.setParent', args: { layers: ['$2.layer', '$3.layer'], parent: '$1.layer' } },
  ]);
  return { applied: result.applied, comp: c.name };
}

function fields() {
  return { name: $('#name').value.trim() || 'Name', role: $('#role').value.trim(), bar: $('#bar').value, ink: $('#ink').value };
}

async function refresh() {
  try {
    const doc = await formext.readDocument('summary');
    fill($('#sub'), doc.comp ? `${esc(doc.comp.name)}, ${doc.comp.width} x ${doc.comp.height}` : 'No composition open');
    $('#add').disabled = !doc.comp;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#add').addEventListener('click', async () => {
  const o = fields();
  try {
    await formext.storageSet('last', o);
    await build(o);
    status(`Lower third for ${o.name} added`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const o = (await formext.storageGet('last')) ?? fields();
  const r = await build(o);
  await formext.notify(`Lower third for ${o.name} added to ${r.comp}`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'comp.changed' || name === 'document.changed') later();
});

await formext.hello();
const last = await formext.storageGet('last').catch(() => null);
if (last) {
  $('#name').value = last.name;
  $('#role').value = last.role;
  $('#bar').value = last.bar;
  $('#ink').value = last.ink;
}
refresh();
