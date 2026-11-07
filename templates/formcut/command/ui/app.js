import { formext } from './formext.js';
import { headless, plural } from './kit.js';

headless(async () => {
  const doc = await formext.readDocument('project');
  const time = doc.project?.playhead ?? 0;
  const clips = (doc.timeline?.tracks ?? []).flatMap((track) => track.clips ?? []);
  const chosen = (doc.selection?.clipIds ?? []).map((id) => clips.find((c) => c.id === id)).filter(Boolean);
  const inside = chosen.filter((c) => time > c.start && time < c.start + c.duration);
  if (!inside.length) throw new Error('Select clips that the playhead crosses, then run Split Here.');
  const result = await formext.apply('Split at playhead', [
    { command: 'clips.split', args: { clipIds: inside.map((c) => c.id), time } },
    { command: 'marker.add', args: { t: time, note: 'Split' } },
  ]);
  await formext.notify(`Split ${plural(inside.length, 'clip')} at ${time.toFixed(2)} s`, 'success');
  return { split: inside.length, tails: result.results?.[0]?.clipIds ?? [] };
});

await formext.hello();
