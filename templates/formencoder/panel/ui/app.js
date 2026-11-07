import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight } from './kit.js';

const list = $('#outputs');

async function refresh() {
  try {
    const q = await formext.readDocument('queue');
    const c = q.counts ?? {};
    fill($('#sub'), `${c.total ?? 0} outputs: ${c.ready ?? 0} ready, ${c.encoding ?? 0} encoding, ${c.done ?? 0} done, ${c.failed ?? 0} failed${q.paused ? ', paused' : ''}`);
    const rows = [];
    for (const item of q.items ?? []) {
      for (const o of item.outputs ?? []) {
        const pct = o.status === 'encoding' ? ` ${Math.round((o.progress ?? 0) * 100)}%` : '';
        rows.push(`<li class="pick${o.skip ? ' off' : ''}" data-output="${esc(o.id)}" title="${esc(o.error || o.summary?.video || '')}">
          <span class="meta">${item.index}</span>
          <span class="name">${esc(item.name)}<br /><span class="meta">${esc(o.presetName || o.formatLabel || o.format)}</span></span>
          <span class="meta">${esc(o.status)}${pct}</span>
        </li>`);
      }
    }
    fill(list, rows.join('') || '<li class="empty">The queue is empty. Add a source in FormEncoder.</li>');
  } catch (err) {
    status(errorText(err), 'error');
  }
}

document.querySelector('main').addEventListener('click', async (event) => {
  const run = event.target.closest('[data-run]');
  const row = event.target.closest('li[data-output]');
  try {
    if (run) {
      if (run.dataset.run === 'queue.start') await formext.run('queue.start', {});
      else if (run.dataset.run === 'queue.pause') await formext.run('queue.pause', {});
      else await formext.run('queue.stop', {});
      status(run.textContent, 'success');
    } else if (row) {
      await formext.run('queue.select', { outputs: [row.dataset.output] });
      const est = await formext.run('encode.estimate', { output: row.dataset.output });
      status(est && typeof est === 'object' ? Object.entries(est).map(([k, v]) => `${k} ${typeof v === 'number' ? Math.round(v * 10) / 10 : v}`).join(', ') : String(est));
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 250);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'encode.finished') later();
});

await formext.hello();
fitHeight();
refresh();
