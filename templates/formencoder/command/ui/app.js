import { formext } from './formext.js';
import { headless, plural } from './kit.js';

headless(async () => {
  const q = await formext.readDocument('queue');
  const refs = (q.items ?? []).flatMap((item) => (item.outputs ?? []).filter((o) => o.status === 'failed' || o.status === 'stopped').map((o) => o.id));
  if (!refs.length) {
    await formext.notify('No failed or stopped outputs', 'info');
    return { reset: 0 };
  }
  await formext.apply('Retry failed outputs', [{ command: 'queue.resetStatus', args: { refs } }]);
  await formext.notify(`${plural(refs.length, 'output')} ready to encode again`, 'success');
  return { reset: refs.length };
});

await formext.hello();
