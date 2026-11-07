import type { AppSim, Json } from '../types';
import { refuse, invalid, need, esc, HostError, ERR } from '../util';

interface App { id: string; name: string; kind: string; summary: string; mcp: boolean; state: string; installed: boolean; version: string; reach: string; exposed: boolean; off_for: string[]; profile_off_for: string[]; start: string; hidden_tools: number; tools: { name: string; on: boolean; read_only: boolean }[] }
interface State { apps: App[]; agents: Json[]; profiles: { name: string; apps_off: string[]; used_by: string[] }[]; selection: { agent: string; filter: string }; http: Json }

const CLIENTS = ['claude', 'codex', 'cursor', 'other'];
const app = (id: string, name: string, kind: string, summary: string, version: string, tools: string[], ex: Partial<App> = {}): App => ({ id, name, kind, summary, mcp: true, state: 'live', installed: true, version, reach: 'formportal', exposed: false, off_for: [], profile_off_for: [], start: 'demand', hidden_tools: 0, tools: tools.map((t, i) => ({ name: t, on: true, read_only: i === 0 })), ...ex });

function find(s: State, id: unknown): App {
  return s.apps.find((a) => a.id === id) ?? refuse(`formMCP does not know the app ${String(id)}`);
}

function client(c: unknown): string {
  if (!CLIENTS.includes(String(c))) invalid(`client is one of ${CLIENTS.join(', ')}`);
  return String(c);
}

function pub(s: State, a: App) {
  const { tools: _t, ...rest } = a;
  void _t;
  return { ...rest, on_for_agent: !a.off_for.includes(s.selection.agent) && !a.profile_off_for.includes(s.selection.agent) };
}

function all(s: State) {
  return { app: 'formmcp', version: '0.9.0', live: true, selection: s.selection, apps: s.apps.map((a) => pub(s, a)), agents: s.agents, profiles: s.profiles.map((p) => ({ name: p.name, apps_off: p.apps_off.length, tools_off: 0, starts: 0, used_by: p.used_by })), http: s.http, source: 'bundled list from nodemode-dev/formcompiler 0.6.1 (f0e3201)' };
}

function part(key: keyof ReturnType<typeof all>) {
  return (s: State) => ({ app: 'formmcp', version: '0.9.0', live: true, [key]: all(s)[key] });
}

const sim: AppSim<State> = {
  product: 'formmcp',
  app: 'formMCP',
  appVersion: '0.9.0',
  docLabel: 'Settings',
  title: () => 'formMCP',
  initial: () => ({
    apps: [
      app('formvis', 'FormVis', 'image', 'Image editor: layers, selections, filters.', '2.1.0', ['get_document', 'add_layer', 'apply_filter', 'export']),
      app('formcut', 'FormCut', 'video', 'Video editor: cut, trim, titles and export.', '2.13.3', ['get_project', 'add_clip', 'export_video']),
      app('formwav', 'FormWav', 'audio', 'Audio editor and mixer.', '2.24.0', ['formwav_get_session', 'formwav_apply_document_commands']),
      app('formpdf', 'FormPDF', 'document', 'PDF reader and editor.', '0.59.0', ['get_context', 'pdf', 'render_pages'], { start: 'session' }),
      app('formlit', 'FormLit', 'photo', 'Photo catalog and develop.', '0.50.0', ['find_photos', 'set_keywords'], { off_for: ['codex'] }),
      app('formskills', 'FormSkills', 'skills', 'The Form apps’ released skills.', '0.9.0', [], { mcp: false, state: 'no-mcp' }),
    ],
    agents: [
      { client: 'claude', label: 'Claude Code', state: 'connected', profile: null },
      { client: 'codex', label: 'Codex', state: 'not-connected', profile: 'quiet' },
      { client: 'cursor', label: 'Cursor', state: 'no-client', profile: null },
      { client: 'other', label: 'other agents', state: null, profile: null },
    ],
    profiles: [{ name: 'quiet', apps_off: ['formlit', 'formcut', 'formvis'], used_by: ['codex'] }],
    selection: { agent: 'claude', filter: 'all' },
    http: { running: false, port: 5625, address: 'http://127.0.0.1:5625/mcp' },
  }),
  defaultRead: 'all',
  reads: { all, apps: part('apps'), agents: part('agents'), profiles: part('profiles'), http: part('http'), selection: part('selection') },
  apply: 'atomic',
  undo: true,
  unknownCommand: (id) => ({ code: ERR.REFUSED, message: `formMCP has no command ${id} for extensions` }),
  cmds: {
    set_for: { title: 'Offer an app to an agent', args: { client: 'claude|codex|cursor|other', id: 'app id', on: 'boolean' }, fn: (s, a) => { const c = client(a.client); const ap = find(s, a.id); ap.off_for = a.on ? ap.off_for.filter((x) => x !== c) : [...new Set([...ap.off_for, c])]; return !ap.off_for.includes(c); } },
    set_expose: { title: 'Always show an app’s tools', args: { id: 'app id', on: 'boolean' }, fn: (s, a) => { find(s, a.id).exposed = Boolean(a.on); return s.apps.filter((x) => x.exposed).map((x) => x.id); } },
    set_start: { title: 'Start policy', args: { id: 'app id', policy: 'demand|session|keep' }, fn: (s, a) => { if (!['demand', 'session', 'keep'].includes(a.policy)) invalid('policy is demand, session or keep'); find(s, a.id).start = a.policy; return a.policy; } },
    set_tool: { title: 'Offer one tool', args: { id: 'app id', tool: 'tool name', on: 'boolean' }, fn: (s, a) => { const ap = find(s, a.id); const t = ap.tools.find((x) => x.name === a.tool) ?? refuse(`${ap.name} has no tool ${a.tool}`); t.on = Boolean(a.on); ap.hidden_tools = ap.tools.filter((x) => !x.on).length; return t.on; } },
    tool_list: { title: 'List an app’s tools', args: { id: 'app id' }, fn: (s, a) => { const ap = find(s, a.id); return { app: ap.id, loaded: true, tools: ap.tools }; } },
    tool_load: { title: 'Load an app’s tools', args: { id: 'app id' }, fn: (s, a) => { const ap = find(s, a.id); if (!ap.mcp) refuse(`${ap.name} has no MCP server`); return { app: ap.id, loaded: true, tools: ap.tools }; } },
    profile_save: { title: 'Save a profile', args: { name: 'string', from: 'client' }, fn: (s, a) => { need(a, 'name'); const c = client(a.from); s.profiles = s.profiles.filter((p) => p.name !== a.name); s.profiles.push({ name: String(a.name), apps_off: s.apps.filter((x) => x.off_for.includes(c)).map((x) => x.id), used_by: [] }); return all(s).profiles; } },
    profile_use: { title: 'Use a profile', args: { client: 'client', name: 'string|null' }, fn: (s, a) => { const c = client(a.client); if (a.name !== null && !s.profiles.some((p) => p.name === a.name)) refuse(`there is no profile ${a.name}`); s.profiles.forEach((p) => (p.used_by = p.used_by.filter((x) => x !== c))); const ag = s.agents.find((x) => x.client === c); ag.profile = a.name; if (a.name) s.profiles.find((p) => p.name === a.name)?.used_by.push(c); return all(s).profiles; } },
    profile_delete: { title: 'Delete a profile', args: { name: 'string' }, fn: (s, a) => { s.profiles = s.profiles.filter((p) => p.name !== a.name); return all(s).profiles; } },
    select_agent: { title: 'Apps for', args: { agent: 'client' }, fn: (s, a) => ((s.selection.agent = client(a.agent)), s.selection) },
    select_filter: { title: 'Filter', args: { filter: 'all|mcp' }, fn: (s, a) => { if (!['all', 'mcp'].includes(a.filter)) invalid('filter is all or mcp'); s.selection.filter = a.filter; return s.selection; } },
    refresh: { title: 'Refresh', fn: (s) => all(s) },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify([p.apps, p.profiles, p.agents]) !== JSON.stringify([n.apps, n.profiles, n.agents])) out.push({ name: 'document.changed', data: { command: 'set' } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: n.selection });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'after any change to the settings', sample: () => ({ command: 'set_for' }) },
    { name: 'selection.changed', note: 'the Apps for picker or filter chip changed', sample: (s) => s.selection },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: false, notes: ['document.read { what: "file" } answers -32602: no open file', 'hooks, tracing, secrets and the HTTP token are not open to extensions'] },
  tokens: {},
  view: (s) => `<table class="sim-table">${s.apps.map((a) => `<tr><td>${esc(a.name)}</td><td>${a.mcp ? esc(a.start) : '<span class="sim-m">no MCP</span>'}</td><td>${pub(s, a).on_for_agent ? 'on' : '<span class="sim-m">off</span>'} for ${esc(s.selection.agent)}</td><td class="sim-m">${a.exposed ? 'exposed ' : ''}${a.hidden_tools ? `${a.hidden_tools} tools off` : ''}</td></tr>`).join('')}</table><div class="sim-m">${s.profiles.length} profiles, filter ${esc(s.selection.filter)}</div>`,
  samples: ['profile.json'],
};

export default sim;
