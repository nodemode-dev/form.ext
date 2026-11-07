import { formext } from './formext.js';
import { headless } from './kit.js';

headless(async () => {
  const doc = await formext.readDocument('document');
  if (!doc.open) throw new Error('Open a picture first.');
  const size = Math.max(12, Math.round(Math.min(doc.width, doc.height) / 30));
  const margin = Math.round(size * 1.2);
  const text = `${doc.name}  ${doc.width} x ${doc.height}`;
  const result = await formext.apply('Stamp Document Name', [
    { command: 'tool:add_text', args: { text, x: margin, y: doc.height - margin - size, size, color: '#ffffff', bold: true } },
  ]);
  await formext.notify(`Stamped "${text}"`, 'success');
  return { applied: result.applied, layer: result.results?.[0]?.id ?? null };
});

await formext.hello();
