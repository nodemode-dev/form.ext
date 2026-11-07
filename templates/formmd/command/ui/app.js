import { formext } from './formext.js';
import { headless } from './kit.js';

headless(async () => {
  const doc = await formext.readDocument('page');
  if (!doc.page) throw new Error('Open a page first.');
  if (!doc.writable) throw new Error('This page is not open for editing.');
  const hello = await formext.hello();
  const day = new Date().toLocaleDateString(hello.locale || undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const result = await formext.apply('Dated entry', [{ command: 'doc.insertMarkdown', args: { markdown: `## ${day}\n\n- [ ] \n`, at: 'end' } }]);
  const blocks = result.results?.[0]?.blocks ?? [];
  if (blocks.length) await formext.apply('Go to entry', [{ command: 'doc.select', args: { block: blocks[blocks.length - 1] } }]);
  await formext.notify(`Added ${day}`, 'success');
  return { blocks };
});

await formext.hello();
