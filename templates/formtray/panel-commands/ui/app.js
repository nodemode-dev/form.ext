import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

const list = $('#apps');

async function makeGroup(name, apps, size = 'm') {
  if (!apps.length) throw new Error('Choose at least one app.');
  const result = await formext.apply(`Group ${name}`, [{ command: 'group.create', args: { name, apps, size } }]);
  return { tile: result.results?.[0]?.tile ?? result.results?.[0] ?? null, apps: apps.length };
}

async function refresh() {
  try {
    const { apps = [] } = await formext.readDocument('apps');
    const ticked = new Set([...list.querySelectorAll('input:checked')].map((i) => i.value));
    const shown = apps.filter((a) => a.installed && !a.hidden);
    fill($('#sub'), `${plural(shown.length, 'app')} installed, ${apps.filter((a) => a.running).length} running`);
    fill(
      list,
      shown
        .map(
          (a) => `<li>
            <label class="inline grow"><input type="checkbox" value="${esc(a.id)}"${ticked.has(a.id) ? ' checked' : ''} /> <span class="name">${esc(a.name)}</span></label>
            <span class="meta">${a.running ? 'running' : ''}</span>
          </li>`,
        )
        .join('') || '<li class="empty">No Form apps found</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#make').addEventListener('click', async () => {
  const name = $('#name').value.trim() || 'Group';
  const apps = [...list.querySelectorAll('input:checked')].map((i) => i.value);
  try {
    const r = await makeGroup(name, apps, $('#size').value);
    for (const i of list.querySelectorAll('input:checked')) i.checked = false;
    status(`${name} made with ${plural(r.apps, 'app')}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const { apps = [] } = await formext.readDocument('apps');
  const running = apps.filter((a) => a.running && !a.hidden).map((a) => a.id);
  const r = await makeGroup('Running', running);
  await formext.notify(`Running group made with ${plural(r.apps, 'app')}`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'apps.changed' || name === 'document.changed') later();
});

await formext.hello();
refresh();
