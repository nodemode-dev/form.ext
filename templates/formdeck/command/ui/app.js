import { formext } from './formext.js';
import { headless } from './kit.js';

headless(async () => {
  const doc = await formext.readDocument('deck');
  const here = doc.current?.slide;
  if (!here) throw new Error('Open a deck first.');
  const titles = (doc.slides ?? []).filter((s) => !s.hidden && s.id !== here).map((s) => `${s.n}. ${s.title || 'Untitled slide'}`);
  const notes = ['Agenda', ...titles].join('\n');
  await formext.apply('Agenda notes', [{ command: 'apply-ops', args: { ops: [{ op: 'set', path: ['slides', { id: here }, 'notes'], value: notes }] } }]);
  await formext.notify(`Agenda of ${titles.length} slides written into the notes of slide ${doc.current.n}`, 'success');
  return { slide: here, lines: titles.length };
});

await formext.hello();
