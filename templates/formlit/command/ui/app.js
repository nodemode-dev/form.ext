import { formext } from './formext.js';
import { headless, plural } from './kit.js';

headless(async () => {
  const summary = await formext.readDocument('summary');
  const count = summary.selectionCount ?? summary.selection?.length ?? 0;
  if (!count) throw new Error('Select photos in the Library first.');
  await formext.apply('Mark as keepers', [
    { command: 'photo.flag', args: { ids: 'selection', flag: 'pick' } },
    { command: 'photo.rate', args: { ids: 'selection', rating: 4 } },
    { command: 'photo.label', args: { ids: 'selection', label: 'green' } },
  ]);
  await formext.notify(`${plural(count, 'photo')} marked as keepers`, 'success');
  return { photos: count };
});

await formext.hello();
