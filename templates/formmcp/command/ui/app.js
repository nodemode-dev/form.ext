import { formext } from './formext.js';
import { headless, plural } from './kit.js';

headless(async () => {
  const doc = await formext.readDocument('apps');
  if (doc.live === false) throw new Error('formMCP is in preview here; open the app to change its settings.');
  const busy = (doc.apps ?? []).filter((a) => a.mcp && a.start && a.start !== 'demand');
  if (!busy.length) {
    await formext.notify('Every app already starts on demand', 'info');
    return { changed: 0 };
  }
  await formext.apply('Start every app on demand', busy.map((a) => ({ command: 'set_start', args: { id: a.id, policy: 'demand' } })));
  await formext.notify(`${plural(busy.length, 'app')} now start on demand. Undo is in the filter row.`, 'success');
  return { changed: busy.map((a) => a.id) };
});

await formext.hello();
