import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight } from './kit.js';

const list = $('#apps');
let agent = '';

async function refresh() {
  try {
    const doc = await formext.readDocument('all');
    agent = doc.selection?.agent ?? agent;
    $('#mcp').checked = doc.selection?.filter === 'mcp';
    fill($('#agent'), (doc.agents ?? []).map((a) => `<option value="${esc(a.client)}"${a.client === agent ? ' selected' : ''}>${esc(a.label)}${a.state ? ` (${esc(a.state)})` : ''}</option>`).join(''));
    const apps = (doc.apps ?? []).filter((a) => !$('#mcp').checked || a.mcp);
    const on = apps.filter((a) => a.on_for_agent).length;
    fill($('#sub'), doc.live ? `${on} of ${apps.length} apps offered to this agent` : 'Preview without the app: switches are read only');
    fill(
      list,
      apps
        .map(
          (a) => `<li class="${a.installed === false ? 'off' : ''}">
            <span class="name">${esc(a.name)}<br /><span class="meta">${esc(a.summary ?? a.kind ?? '')}</span></span>
            <span class="meta">${esc(a.start ?? '')}</span>
            <label class="inline"><input type="checkbox" data-app="${esc(a.id)}"${a.on_for_agent ? ' checked' : ''}${doc.live && a.mcp ? '' : ' disabled'} /></label>
          </li>`,
        )
        .join('') || '<li class="empty">No apps</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#agent').addEventListener('change', async () => {
  try {
    await formext.run('select_agent', { agent: $('#agent').value });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

$('#mcp').addEventListener('change', async () => {
  try {
    await formext.run('select_filter', { filter: $('#mcp').checked ? 'mcp' : 'all' });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

list.addEventListener('change', async (event) => {
  const box = event.target.closest('input[data-app]');
  if (!box) return;
  try {
    await formext.apply(box.checked ? 'Offer app' : 'Stop offering app', [{ command: 'set_for', args: { client: agent, id: box.dataset.app, on: box.checked } }]);
    status(`${box.dataset.app} ${box.checked ? 'on' : 'off'} for ${agent}`, 'success');
  } catch (err) {
    box.checked = !box.checked;
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
fitHeight();
refresh();
