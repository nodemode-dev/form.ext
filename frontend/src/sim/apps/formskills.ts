import type { AppSim, Json } from '../types';
import { refuse, invalid, need, esc } from '../util';

interface Skill { folder: string; name: string; description: string; license: string; files: Record<string, string> }
interface State { chosen: string; pane: string; reading: { app: string; folder: string; path: string } | null; filter: string; search: string; apps: { id: string; name: string; skills: Skill[] }[]; edits: Record<string, Record<string, string>>; own: Skill[] }

const md = (name: string, desc: string, body: string) => `---\nname: ${name}\ndescription: ${desc}\nlicense: Apache-2.0\n---\n\n# ${name}\n\n${body}\n`;
const sk = (folder: string, desc: string, body: string): Skill => ({ folder, name: folder, description: desc, license: 'Apache-2.0', files: { 'SKILL.md': md(folder, desc, body), 'references/commands.md': `# Commands\n\nSee the app's command catalogue.\n` } });

function appOf(s: State, id: unknown) {
  if (id === 'yours') return { id: 'yours', name: 'Your skills', skills: s.own };
  return s.apps.find((a) => a.id === id) ?? refuse(`formskills has no app ${String(id)}`);
}

function skillOf(s: State, app: unknown, skill: unknown): Skill {
  return appOf(s, app).skills.find((x) => x.folder === skill) ?? refuse(`${String(app)} has no skill ${String(skill)}`);
}

function key(app: unknown, skill: unknown) {
  return `${String(app)}/${String(skill)}`;
}

function check(sk: Skill, text?: string) {
  const t = text ?? sk.files['SKILL.md'] ?? '';
  const findings = [];
  if (!/^---\nname: /.test(t)) findings.push({ level: 'error', text: 'SKILL.md must start with front matter and a name' });
  if (!/\nlicense: /.test(t)) findings.push({ level: 'warning', text: 'no licence line' });
  if (!/\ndescription: .{20,}/.test(t)) findings.push({ level: 'warning', text: 'the description is short' });
  return { folder: sk.folder, name: sk.name, license: sk.license, fields: ['name', 'description', 'license'], errors: findings.filter((f) => f.level === 'error').length, warnings: findings.filter((f) => f.level === 'warning').length, findings, spec: 'agent-skills 1' };
}

function view(s: State) {
  return { what: 'view', app: 'formskills', version: '0.9.0', chosen: { id: s.chosen, name: appOf(s, s.chosen).name }, pane: s.pane, reading: s.reading && { ...s.reading, name: s.reading.folder, editing: Boolean(s.edits[key(s.reading.app, s.reading.folder)]) }, filter: s.filter, search: s.search };
}

const sim: AppSim<State> = {
  product: 'formskills',
  app: 'FormSkills',
  appVersion: '0.9.0',
  docLabel: 'Library',
  title: (s) => `FormSkills - ${appOf(s, s.chosen).name}`,
  initial: () => ({
    chosen: 'formvis',
    pane: 'reader',
    reading: { app: 'formvis', folder: 'formvis-harness', path: 'SKILL.md' },
    filter: 'all',
    search: '',
    apps: [
      { id: 'formvis', name: 'FormVis', skills: [sk('formvis-harness', 'Drive FormVis from an agent: open, layer, select, filter and export pictures.', 'Use the MCP tools get_document and list_commands first.'), sk('formvis-skillset', 'Change the FormVis codebase: engine, window and Tauri shell.', 'Read HASHOUT_LOG.md before editing.')] },
      { id: 'formpdf', name: 'FormPDF', skills: [sk('formpdf-harness', 'Do PDF work with formpdf through its MCP server.', 'Call get_context, then pdf with an action.')] },
      { id: 'formcut', name: 'FormCut', skills: [sk('formcut-driving', 'Edit a formcut timeline from an agent.', 'Read the project before every edit.')] },
    ],
    edits: {},
    own: [],
  }),
  defaultRead: 'view',
  reads: {
    view,
    selection: (s) => ({ what: 'selection', chosen: view(s).chosen, reading: view(s).reading }),
    library: (s) => ({ what: 'library', catalogue: 'dev mode: checkouts in /home/me/repos', dev: true, apps: s.apps.map((a) => ({ id: a.id, name: a.name, source: { kind: 'dev', path: `/home/me/repos/${a.id}/.claude/skills` }, releases: [], pin: null, skills: a.skills.map((x) => ({ folder: x.folder, name: x.name, description: x.description, license: x.license, check: { errors: check(x).errors, warnings: check(x).warnings }, scripts: 0, files: Object.entries(x.files).map(([path, t]) => ({ path, bytes: t.length, kind: path === 'SKILL.md' ? 'skill' : 'reference' })) })) })) }),
    skill: (s) => { if (!s.reading) return null; const x = skillOf(s, s.reading.app, s.reading.folder); return { what: 'skill', app: s.reading.app, ...x, copy: s.edits[key(s.reading.app, x.folder)] ? { files: Object.keys(s.edits[key(s.reading.app, x.folder)]) } : null }; },
    file: (s) => { if (!s.reading) return null; const r = s.reading; const ed = s.edits[key(r.app, r.folder)]; const text = ed?.[r.path] ?? skillOf(s, r.app, r.folder).files[r.path] ?? null; return { what: 'file', app: r.app, folder: r.folder, path: r.path, editing: Boolean(ed), bytes: text?.length ?? 0, text }; },
    edits: (s) => ({ what: 'edits', edits: Object.entries(s.edits).map(([k, files]) => ({ skill: k, files: Object.keys(files), original_changed: false })) }),
    own: (s) => ({ what: 'own', skills: s.own.map((x) => ({ folder: x.folder, name: x.name, description: x.description })) }),
  },
  apply: 'partial',
  undo: true,
  cmds: {
    choose: { title: 'Choose App', args: { app: 'app id or yours' }, fn: (s, a) => { appOf(s, a.app); s.chosen = String(a.app); s.pane = 'app'; return view(s); } },
    'open-skill': { title: 'Open Skill', args: { app: 'app id', skill: 'folder' }, fn: (s, a) => { skillOf(s, a.app, a.skill); s.chosen = String(a.app); s.reading = { app: String(a.app), folder: String(a.skill), path: 'SKILL.md' }; s.pane = 'reader'; return view(s); } },
    'open-file': { title: 'Open File', args: { path: 'path in the open skill' }, fn: (s, a) => { if (!s.reading) refuse('open a skill first'); if (!(a.path in skillOf(s, s.reading.app, s.reading.folder).files)) refuse(`${a.path} is not in ${s.reading.folder}`); s.reading.path = String(a.path); return view(s); } },
    filter: { title: 'Filter', args: { filter: 'all, topic:<Topic> or an app id' }, fn: (s, a) => ((s.filter = String(a.filter ?? 'all')), view(s)) },
    search: { title: 'Search', args: { query: 'two characters or more' }, fn: (s, a) => { if (String(a.query ?? '').length < 2) invalid('query needs two characters or more'); const q = String(a.query).toLowerCase(); s.search = String(a.query); return s.apps.flatMap((ap) => ap.skills.filter((x) => (x.name + x.description).toLowerCase().includes(q)).map((x) => ({ app: ap.id, folder: x.folder, name: x.name, description: x.description, score: 1, matched: ['description'], path: 'SKILL.md', snippet: x.description }))); } },
    'read-file': { title: 'Read File', args: { app: 'app id', path: 'folder/path' }, fn: (s, a) => { const [folder, ...rest] = String(a.path ?? '').split('/'); const text = skillOf(s, a.app, folder).files[rest.join('/')] ?? refuse(`${a.path} is not a file`); return { path: a.path, bytes: text.length, text, note: null }; } },
    check: { title: 'Check Format', args: { app: 'app id', skill: 'folder', copy: 'boolean?' }, fn: (s, a) => { const x = skillOf(s, a.app, a.skill); return check(x, a.copy ? s.edits[key(a.app, a.skill)]?.['SKILL.md'] : undefined); } },
    'edit-start': { title: 'Edit a Copy', args: { app: 'app id', skill: 'folder' }, fn: (s, a) => { const x = skillOf(s, a.app, a.skill); s.edits[key(a.app, a.skill)] ??= { ...x.files }; return { skill: key(a.app, a.skill), files: Object.keys(s.edits[key(a.app, a.skill)]) }; } },
    'edit-read': { title: 'Read from Copy', args: { app: 'app id', skill: 'folder', path: 'path' }, fn: (s, a) => { const ed = s.edits[key(a.app, a.skill)] ?? refuse('there is no copy; run edit-start first'); const text = ed[a.path] ?? refuse(`${a.path} is not in your copy`); return { path: a.path, bytes: text.length, text, note: null }; } },
    'edit-write': { title: 'Write to Copy', args: { app: 'app id', skill: 'folder', path: 'path', text: 'string' }, fn: (s, a) => { need(a, 'text'); const ed = a.app === 'yours' ? (s.own.find((x) => x.folder === a.skill) ?? refuse(`you have no skill ${a.skill}`)).files : s.edits[key(a.app, a.skill)] ?? refuse('there is no copy; run edit-start first'); if (!(a.path in ed)) refuse(`${a.path} is not in your copy`); ed[a.path] = String(a.text); return { skill: key(a.app, a.skill), files: Object.keys(ed) }; } },
    'own-new': { title: 'New Skill', args: { name: 'skill-name', description: 'string?' }, fn: (s, a) => { if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(a.name))) invalid('name follows the skill format: lower case, digits and hyphens'); if (s.own.some((x) => x.folder === a.name)) refuse(`you already have ${a.name}`); const x = sk(String(a.name), String(a.description ?? 'A new skill.'), 'Write what the agent should do.'); s.own.push(x); return { folder: x.folder, name: x.name }; } },
    edits: { title: 'Your Copies', fn: (s) => Object.keys(s.edits) },
    own: { title: 'Your Skills', fn: (s) => s.own.map((x) => x.folder) },
    download: { title: 'Download Zip', args: { app: 'app id', skill: 'folder?' }, fn: (s, a) => { const ap = appOf(s, a.app); const n = a.skill ? 1 : ap.skills.length; return { path: `/home/me/Downloads/${a.skill ?? ap.id}.zip`, name: `${a.skill ?? ap.id}.zip`, skills: n, files: n * 2, bytes: 4096 * n }; } },
    refresh: { title: 'Check for Releases', fn: (s) => sim.reads.library(s, {}) },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify(p.edits) !== JSON.stringify(n.edits)) out.push({ name: 'document.changed', data: { reason: 'edit' } });
    else if (JSON.stringify(p.own) !== JSON.stringify(n.own)) out.push({ name: 'document.changed', data: { reason: 'own' } });
    if (JSON.stringify([p.chosen, p.reading]) !== JSON.stringify([n.chosen, n.reading])) out.push({ name: 'selection.changed', data: { what: 'selection', chosen: view(n).chosen, reading: view(n).reading } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'library, edit, own or undo', sample: () => ({ reason: 'edit' }) },
    { name: 'selection.changed', note: 'another app, skill or file', sample: (s) => ({ what: 'selection', chosen: view(s).chosen, reading: view(s).reading }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['files.save: confirms the name in its own dialog, then saves into Downloads', 'one undo step is kept; the next replaces it'] },
  tokens: { '--float': '--panel', '--control': '--border', '--fault': '#e5484d', '--live': '#30a46c' },
  view: (s) => `<div class="sim-md">${s.apps.map((a) => `<div class="sim-block${a.id === s.chosen ? ' on' : ''}"><span class="sim-k">${esc(a.name)}</span><span>${a.skills.map((x) => `${s.reading?.folder === x.folder ? '<b>' : ''}${esc(x.folder)}${s.edits[key(a.id, x.folder)] ? ' (copy)' : ''}${s.reading?.folder === x.folder ? '</b>' : ''}`).join(', ')}</span></div>`).join('')}${s.own.length ? `<div class="sim-block"><span class="sim-k">Yours</span><span>${esc(s.own.map((x) => x.folder).join(', '))}</span></div>` : ''}</div><div class="sim-m">pane ${esc(s.pane)}${s.reading ? `, reading ${esc(s.reading.folder)}/${esc(s.reading.path)}` : ''}</div>`,
  samples: ['SKILL.md', 'notes.txt'],
};

export default sim;
