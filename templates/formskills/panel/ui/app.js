import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, fitHeight, plural } from './kit.js';

const list = $('#skills');
let library = null;
let reading = null;

function draw() {
  const only = $('#issues').checked;
  const rows = [];
  let count = 0;
  for (const app of library?.apps ?? []) {
    const skills = (app.skills ?? []).filter((s) => !only || s.check?.errors || s.check?.warnings);
    count += skills.length;
    for (const s of skills) {
      const open = reading && reading.app === app.id && reading.folder === s.folder;
      const check = s.check?.errors ? plural(s.check.errors, 'error') : s.check?.warnings ? plural(s.check.warnings, 'warning') : 'ok';
      rows.push(`<li class="pick" data-app="${esc(app.id)}" data-skill="${esc(s.folder)}" aria-selected="${!!open}">
        <span class="name">${open ? '<b>' : ''}${esc(s.name)}${open ? '</b>' : ''}<br /><span class="meta">${esc(app.name)}, ${plural(s.files?.length ?? 0, 'file')}</span></span>
        <span class="meta">${check}</span>
      </li>`);
    }
  }
  fill($('#sub'), `${plural(count, 'skill')} from ${plural(library?.apps?.length ?? 0, 'app')}${library?.dev ? ', dev mode' : ''}`);
  fill(list, rows.join('') || '<li class="empty">No skills to show</li>');
}

async function refresh() {
  try {
    library = await formext.readDocument('library');
    const view = await formext.readDocument('selection');
    reading = view.reading ?? null;
    draw();
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#issues').addEventListener('change', draw);

list.addEventListener('click', async (event) => {
  const row = event.target.closest('li[data-skill]');
  if (!row) return;
  try {
    await formext.run('open-skill', { app: row.dataset.app, skill: row.dataset.skill });
  } catch (err) {
    status(errorText(err), 'error');
  }
});

const later = debounce(refresh, 150);
formext.onActivate(() => null);
formext.onEvent(({ name, data }) => {
  if (name === 'selection.changed') {
    reading = data?.reading ?? null;
    draw();
  } else if (name === 'document.changed') later();
});

await formext.hello();
fitHeight();
refresh();
