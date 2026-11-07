import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless } from './kit.js';

const list = $('#profiles');
let agent = 'claude';

function dated() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `snapshot-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function snapshot(name) {
  const doc = await formext.readDocument('selection');
  const from = doc.selection?.agent ?? agent;
  const profile = (name || dated()).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  await formext.apply('Save profile snapshot', [{ command: 'profile_save', args: { name: profile, from } }]);
  return { profile, from };
}

async function refresh() {
  try {
    const doc = await formext.readDocument('all');
    agent = doc.selection?.agent ?? agent;
    const label = doc.agents?.find((a) => a.client === agent)?.label ?? agent;
    const using = doc.agents?.find((a) => a.client === agent)?.profile ?? null;
    fill($('#sub'), `Agent: ${esc(label)}, profile: ${esc(using ?? 'none')}`);
    fill(
      list,
      (doc.profiles ?? [])
        .map(
          (p) => `<li data-name="${esc(p.name)}" aria-selected="${p.name === using}">
            <span class="name">${esc(p.name)}<br /><span class="meta">${p.apps_off} apps off, ${p.tools_off} tools off${p.used_by?.length ? `, used by ${esc(p.used_by.join(', '))}` : ''}</span></span>
            <button class="small" data-use type="button">${p.name === using ? 'Stop Using' : 'Use'}</button>
            <button class="small" data-delete type="button">Delete</button>
          </li>`,
        )
        .join('') || '<li class="empty">No profiles yet</li>',
    );
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#save').addEventListener('click', async () => {
  try {
    const r = await snapshot($('#name').value.trim());
    $('#name').value = '';
    status(`Saved ${r.profile} from ${r.from}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-name]');
  if (!row) return;
  try {
    if (event.target.closest('[data-use]')) {
      const off = row.getAttribute('aria-selected') === 'true';
      await formext.apply('Use profile', [{ command: 'profile_use', args: { client: agent, name: off ? null : row.dataset.name } }]);
    } else if (event.target.closest('[data-delete]')) {
      await formext.apply('Delete profile', [{ command: 'profile_delete', args: { name: row.dataset.name } }]);
    }
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const r = await snapshot('');
  await formext.notify(`Saved ${r.profile} from ${r.from}`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
refresh();
