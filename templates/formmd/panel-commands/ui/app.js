import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const MARK = 'min read';

function measure(markdown, wpm) {
  const text = String(markdown ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\-[\]()|]/g, ' ');
  const words = (text.match(/\S+/g) ?? []).length;
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length;
  return { words, sentences, minutes: Math.max(1, Math.round(words / wpm)) };
}

async function wpm() {
  return Number((await formext.storageGet('wpm')) ?? 230) || 230;
}

async function insert(rate) {
  const doc = await formext.readDocument('all');
  if (!doc.page) throw new Error('Open a page first.');
  if (!doc.writable) throw new Error('This page is not open for editing.');
  const m = measure(doc.markdown, rate);
  const line = `*${m.minutes} ${MARK}, ${plural(m.words, 'word')}*`;
  const old = (doc.blocks ?? []).find((b) => b.type === 'paragraph' && b.text?.endsWith(' words') && b.text.includes(MARK));
  const first = (doc.blocks ?? [])[0];
  const op = old
    ? { command: 'doc.replaceBlock', args: { block: old.id, markdown: line } }
    : first?.type === 'heading'
      ? { command: 'doc.insertMarkdown', args: { markdown: line, at: 'after', block: first.id } }
      : { command: 'doc.insertMarkdown', args: { markdown: line, at: 'start' } };
  await formext.apply('Reading time', [op]);
  return m;
}

async function refresh() {
  try {
    const doc = await formext.readDocument('all');
    const rate = Number($('#wpm').value) || 230;
    if (!doc.page) {
      fill($('#sub'), 'No page open');
      return;
    }
    const m = measure(doc.markdown, rate);
    fill($('#sub'), esc(doc.page.title || 'Untitled'));
    fill($('#words'), String(m.words));
    fill($('#sentences'), String(m.sentences));
    fill($('#minutes'), `${m.minutes} min`);
    fill($('#selection'), doc.selection && !doc.selection.empty ? plural(measure(doc.selection.text, rate).words, 'word') : 'nothing selected');
    $('#insert').disabled = !doc.writable;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#wpm').addEventListener('change', async () => {
  await formext.storageSet('wpm', Number($('#wpm').value) || 230).catch(() => undefined);
  refresh();
});

$('#insert').addEventListener('click', async () => {
  try {
    const m = await insert(Number($('#wpm').value) || 230);
    status(`Inserted: ${m.minutes} ${MARK}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const m = await insert(await wpm());
  await formext.notify(`${m.minutes} ${MARK}, ${plural(m.words, 'word')}`, 'success');
  return m;
}, refresh);

const later = debounce(refresh, 200);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
$('#wpm').value = String(await wpm().catch(() => 230));
refresh();
