import { formext } from './formext.js';
import { headless } from './kit.js';

headless(async () => {
  const session = await formext.readDocument('session');
  const sel = await formext.readDocument('selection');
  const rate = session.sample_rate;
  let start;
  let end;
  if (sel.range) {
    start = sel.range.start;
    end = sel.range.end;
  } else if (sel.clips?.length) {
    start = Math.round(Math.min(...sel.clips.map((c) => c.start_s)) * rate);
    end = Math.round(Math.max(...sel.clips.map((c) => c.start_s + c.length_s)) * rate);
  } else {
    throw new Error('Select a time range or a clip first.');
  }
  await formext.apply('Loop selection', [{ command: 'set-loop', args: { start, end, enabled: true } }]);
  await formext.notify(`Looping ${(start / rate).toFixed(2)} s to ${(end / rate).toFixed(2)} s`, 'success');
  return { start, end };
});

await formext.hello();
