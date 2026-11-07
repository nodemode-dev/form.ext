import { formext } from './formext.js';
import { headless, plural } from './kit.js';

const FADE = 0.5;

headless(async () => {
  const doc = await formext.readDocument('summary');
  const chosen = (doc.layers ?? []).filter((l) => l.selected);
  if (!chosen.length) throw new Error('Select layers in the timeline first.');
  const ops = [];
  for (const l of chosen) {
    const inT = l.in - l.start;
    const outT = l.out - l.start;
    const fade = Math.min(FADE, (outT - inT) / 2);
    ops.push(
      { command: 'prop.addKey', args: { layer: l.id, path: 'transform/opacity', time: inT, value: 0 } },
      { command: 'prop.addKey', args: { layer: l.id, path: 'transform/opacity', time: inT + fade, value: 100 } },
      { command: 'prop.addKey', args: { layer: l.id, path: 'transform/opacity', time: outT - fade, value: 100 } },
      { command: 'prop.addKey', args: { layer: l.id, path: 'transform/opacity', time: outT, value: 0 } },
    );
  }
  await formext.apply('Fade in and out', ops);
  await formext.notify(`${plural(chosen.length, 'layer')} fade in and out`, 'success');
  return { layers: chosen.map((l) => l.id) };
});

await formext.hello();
