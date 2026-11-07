import { formext, textToBase64 } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

async function outline(withNotes) {
  const doc = await formext.readDocument('deck');
  const lines = [`# ${doc.deck?.title || 'Deck'}`, ''];
  for (const s of doc.slides ?? []) {
    if (s.hidden) continue;
    lines.push(`## ${s.n}. ${s.title || 'Untitled slide'}`, '');
    const detail = await formext.readDocument(`slide:${s.id}`);
    for (const el of detail.elements ?? []) {
      if (!el.text || el.ph === 'title' || el.ph === 'ctrTitle') continue;
      for (const line of el.text.split('\n')) if (line.trim()) lines.push(`- ${line.trim()}`);
    }
    if (withNotes && s.notes?.trim()) lines.push('', `> ${s.notes.trim().replace(/\n/g, '\n> ')}`);
    lines.push('');
  }
  return { title: doc.deck?.title || 'Deck', count: doc.slides?.length ?? 0, text: lines.join('\n') };
}

async function save(withNotes) {
  const o = await outline(withNotes);
  const name = `${o.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck'} outline.md`;
  const r = (await formext.saveFile(name, 'text/markdown', textToBase64(o.text))) ?? {};
  return { name: r.name ?? name, slides: o.count };
}

async function refresh() {
  try {
    const o = await outline($('#notes').checked);
    fill($('#sub'), `${esc(o.title)}, ${plural(o.count, 'slide')}`);
    if ($('#outline').value !== o.text) $('#outline').value = o.text;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#notes').addEventListener('change', refresh);

$('#save').addEventListener('click', async () => {
  try {
    const r = await save($('#notes').checked);
    status(`Saved ${r.name}`, 'success');
  } catch (err) {
    status(errorText(err), err.code === -32002 ? 'info' : 'error');
  }
});

headless(async () => {
  const r = await save(true);
  await formext.notify(`Saved ${r.name}`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 400);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'deck.opened') later();
});

await formext.hello();
refresh();
