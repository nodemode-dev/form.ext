import { formext } from './formext.js';
import { headless, plural } from './kit.js';

headless(async () => {
  const { apps = [] } = await formext.readDocument('apps');
  const pin = apps.filter((a) => a.running && !a.pinned && !a.hidden);
  if (!pin.length) {
    await formext.notify('Every running app is already pinned', 'info');
    return { pinned: [] };
  }
  await formext.apply('Pin the running apps', pin.map((a) => ({ command: 'stack.pin', args: { app: a.id } })));
  await formext.notify(`Pinned ${plural(pin.length, 'app')}: ${pin.map((a) => a.name).join(', ')}`, 'success');
  return { pinned: pin.map((a) => a.id) };
});

await formext.hello();
