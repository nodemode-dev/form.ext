import { formext } from './formext.js';
import { headless } from './kit.js';

headless(async () => {
  const summary = await formext.readDocument('summary');
  if (!summary.open) throw new Error('Open a PDF first.');
  const pages = summary.pages > 1 ? '2-' : '1';
  const result = await formext.apply('Number the pages', [
    { command: 'page_numbers', args: { position: 'bottom-center', format: 'Page {n} of {total}', start: 1, size: 9, pages } },
  ]);
  await formext.notify(`Numbered ${summary.pages > 1 ? summary.pages - 1 : 1} pages`, 'success');
  return { applied: result.applied, id: result.id };
});

await formext.hello();
