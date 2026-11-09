import { emit } from '../../shell/events';
import { basename, iso, now } from './bytes';
import { HttpError, notFound } from './errors';
import * as kit from './kit';
import type { Json } from './kit';
import { settings } from './settings';
import * as fs from './vfs';
import { folderAt, readJson, workspace, writeJson } from './workspace';
import { unzip } from './zip';

export const APPS: [string, string][] = [
  ['formvis', 'FormVis'],
  ['formcut', 'FormCut'],
  ['formwav', 'FormWav'],
  ['formpdf', 'FormPDF'],
  ['formdeck', 'FormDeck'],
  ['formlit', 'FormLit'],
  ['formmd', 'Form.md'],
  ['formencoder', 'FormEncoder'],
  ['formvfx', 'FormVFX'],
  ['formmcp', 'FormMCP'],
  ['formtray', 'FormTray'],
  ['formskills', 'FormSkills'],
  ['formportal', 'FormPortal'],
];
const NAMES = Object.fromEntries(APPS);
const CHANNELS = ['stable', 'beta', 'nightly'];
const DEV_FORMAT = 'formext-dev-extensions';
const ENABLED_FORMAT = 'formportal-enabled-extensions';
const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
export const PORTAL_ROOT = `${fs.HOME}/.local/share/formportal`;
const portalError = (m: string) => new HttpError(422, m);

export const appName = (p: string) => NAMES[p] ?? p;

function product(p: string): string {
  if (!(p in NAMES)) throw notFound(`unknown product: ${p}`);
  return p;
}

export function root(): Json {
  const chosen = String(settings.value('formportal_root') || '').trim();
  const path = chosen ? chosen.replace(/^~(?=\/|$)/, fs.HOME) : PORTAL_ROOT;
  return { path, source: chosen ? 'settings' : 'default', exists: fs.isDir(path) };
}

const rootDir = () => String(root().path);

function readState(path: string): Json | false | null {
  if (!fs.isFile(path)) return null;
  const d = readJson(path);
  return d === null ? false : d;
}

function launchTarget(path: string): string | null {
  if (fs.isFile(path)) return path;
  if (!fs.isDir(path)) return null;
  const all = fs.walk(path);
  const hit = all.find((r) => r.endsWith('.AppImage')) ?? all.find((r) => /(^|\/)bin\//.test(r));
  return hit ? `${path}/${hit}` : null;
}

export function installs(): Json {
  const base = rootDir();
  const state = readState(`${base}/installed.json`);
  const out: Record<string, Json[]> = {};
  const rows = state && Array.isArray(state.installs) ? state.installs : [];
  for (const row of rows) {
    if (!row || typeof row.current !== 'object') continue;
    const p = String(row.product ?? '');
    const cur = row.current;
    const path = String(cur.path ?? '');
    const target = path ? launchTarget(path) : null;
    (out[p] ??= []).push({ channel: String(row.channel ?? 'stable'), version: String(cur.version ?? ''), path, installed_at: cur.installed_at ?? null, present: Boolean(path) && fs.exists(path), target, previous: row.previous?.version ? String(row.previous.version) : null });
  }
  const rank = (c: string) => (CHANNELS.includes(c) ? CHANNELS.indexOf(c) : 9);
  for (const list of Object.values(out)) list.sort((a, b) => rank(a.channel) - rank(b.channel));
  return { installs: out, error: state === false ? "FormPortal's installed.json cannot be read" : '', mtime: fs.mtime(`${base}/installed.json`) };
}

const extDir = (p: string) => `${rootDir()}/extensions/${product(p)}`;
export const devFile = (p: string) => `${extDir(p)}/dev.json`;
const emptyDev = (p: string) => ({ format: DEV_FORMAT, format_version: 1, product: p, extensions: [] as Json[] });

function devProblems(data: Json, p: string): string[] {
  const errs: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['dev.json is not an object'];
  for (const k of ['format', 'format_version', 'product', 'extensions']) if (!(k in data)) errs.push(`${k} is required`);
  if ('format' in data && data.format !== DEV_FORMAT) errs.push(`format must be "${DEV_FORMAT}"`);
  if ('format_version' in data && data.format_version !== 1) errs.push('format_version must be 1');
  if ('product' in data && data.product !== p) errs.push(`product must be "${p}"`);
  if ('extensions' in data && !Array.isArray(data.extensions)) errs.push('extensions must be an array');
  (Array.isArray(data.extensions) ? data.extensions : []).forEach((row: Json, i: number) => {
    if (!row || typeof row !== 'object') return errs.push(`extensions[${i}] must be an object`);
    if (typeof row.id !== 'string' || !ID_RE.test(row.id)) errs.push(`extensions[${i}].id must match ^[a-z0-9][a-z0-9-]{1,63}$`);
    if (typeof row.path !== 'string' || !row.path) errs.push(`extensions[${i}].path must be a non-empty string`);
    if ('added' in row && typeof row.added !== 'string') errs.push(`extensions[${i}].added must be a string`);
  });
  return errs;
}

export function readDev(p: string): Json {
  const target = devFile(p);
  const data = readState(target);
  const out: Json = { product: p, file: target, exists: fs.isFile(target), mtime: fs.mtime(target), problems: [], dev: emptyDev(p) };
  if (data === null) return out;
  if (data === false) {
    out.problems = ['dev.json is not valid JSON'];
    return out;
  }
  out.problems = devProblems(data, p);
  if (data && typeof data === 'object') out.dev = { ...data, extensions: Array.isArray(data.extensions) ? data.extensions.filter((r: Json) => r && typeof r === 'object') : [] };
  return out;
}

export function writeDev(p: string, data: Json): Json {
  p = product(p);
  const errs = devProblems(data, p);
  if (errs.length) throw portalError(`dev.json would not follow the contract: ${errs.join('; ')}`);
  const clean = emptyDev(p);
  const seen = new Set<string>();
  for (const row of data.extensions) {
    if (seen.has(row.id)) throw portalError(`dev.json lists ${row.id} twice`);
    seen.add(row.id);
    clean.extensions.push({ id: row.id, path: row.path, ...('added' in row ? { added: row.added } : {}) });
  }
  writeJson(devFile(p), clean);
  emit('runapp.changed', { product: p, kind: 'dev' });
  return readDev(p);
}

function devAdd(p: string, id: string, path: string): Json {
  p = product(p);
  if (!ID_RE.test(id || '')) throw portalError('the extension id must match ^[a-z0-9][a-z0-9-]{1,63}$ (set it in the manifest)');
  if (!fs.isFile(`${path}/manifest.json`)) throw portalError(`${path} has no manifest.json`);
  const current = readDev(p);
  if (current.problems.length && current.exists) throw portalError(`${current.file} does not follow the contract (${current.problems.join('; ')}); fix or remove it first`);
  const rows = current.dev.extensions.filter((r: Json) => r.id !== id);
  rows.push({ id, path, added: iso(now()) });
  return writeDev(p, { ...emptyDev(p), extensions: rows });
}

export function devRemove(p: string, id: string): Json {
  p = product(p);
  const rows = readDev(p).dev.extensions;
  const kept = rows.filter((r: Json) => r.id !== id);
  if (kept.length === rows.length) throw notFound(`${id} is not in ${appName(p)}'s dev.json`);
  return writeDev(p, { ...emptyDev(p), extensions: kept });
}

export function reload(p: string): Json {
  const cur = readDev(p);
  if (!cur.exists) throw notFound(`${appName(p)} has no dev.json yet`);
  if (cur.problems.length) throw portalError(`dev.json does not follow the contract: ${cur.problems.join('; ')}`);
  return writeDev(p, cur.dev);
}

function enabled(p: string): Json {
  const target = `${extDir(p)}/enabled.json`;
  const data = readState(target);
  const rows = data && data.format === ENABLED_FORMAT && Array.isArray(data.extensions) ? data.extensions.filter((r: Json) => r && typeof r === 'object').map((r: Json) => ({ id: String(r.id ?? ''), version: String(r.version ?? ''), source: String(r.source ?? 'catalogue'), path: String(r.path ?? '') })) : [];
  return { file: target, exists: fs.isFile(target), mtime: fs.mtime(target), extensions: rows, readable: data !== false };
}

function installedExtensions(): Record<string, Json[]> {
  const data = readState(`${rootDir()}/extensions/installed.json`);
  const out: Record<string, Json[]> = {};
  for (const r of data && Array.isArray(data.extensions) ? data.extensions : []) {
    if (!r || typeof r !== 'object') continue;
    (out[String(r.product ?? '')] ??= []).push({ id: String(r.id ?? ''), name: String(r.name ?? ''), version: String(r.version ?? ''), source: String(r.source ?? ''), enabled: Boolean(r.enabled), signed_by: r.signed_by ?? null });
  }
  return out;
}

function appVersion(p: string, found = installs()): string {
  const rows = found.installs[p] ?? [];
  return rows[0]?.version ?? '';
}

function hostView(p: string, id: string, folder: string, version = ''): Json {
  const e = kit.extension(id, '0.0.0', 'development', folder);
  kit.check(e, fs.isDir(folder) ? folderAt(folder) : null, p, version || '999.0.0', appName(p));
  return { state: e.state, reason: e.reason, name: e.name, version: e.version, panels: e.panels, commands: e.commands, permissions: e.permissions, app_version: version || null };
}

export function cliInfo(found = installs()): Json {
  for (const row of found.installs.formportal ?? []) {
    if (!row.present) continue;
    const hit = fs.walk(row.path).find((r) => basename(r) === 'formportal-cli');
    if (hit) return { found: true, command: [`${row.path}/${hit}`], source: 'FormPortal install' };
  }
  return { found: false, command: [], source: '' };
}

export function overview(): Json {
  const found = installs();
  const owned = installedExtensions();
  const byPath = new Map(workspace.projects().map((p) => [p.package_dir, { id: p.id, name: p.name }]));
  const apps = APPS.map(([p, name]) => {
    const dev = readDev(p);
    const version = appVersion(p, found);
    const rows = dev.dev.extensions.map((row: Json) => {
      const path = String(row.path ?? '');
      return { id: row.id, path, added: row.added ?? null, project: byPath.get(path) ?? null, host: path ? hostView(p, String(row.id ?? ''), path, version) : { state: 'refused', reason: 'no path' } };
    });
    return { product: p, name, installs: found.installs[p] ?? [], version: version || null, launchable: (found.installs[p] ?? []).some((i: Json) => i.target), dev: { file: dev.file, exists: dev.exists, mtime: dev.mtime, problems: dev.problems, extensions: rows }, enabled: enabled(p), extensions: owned[p] ?? [] };
  });
  return { root: root(), state_error: found.error, state_mtime: found.mtime, cli: cliInfo(found), apps, checked_at: now() };
}

export function projectStatus(pid: string): Json {
  const project = workspace.get(pid);
  const p = project.product;
  const id = String(project.manifest.id || '');
  const folder = project.package_dir;
  const out: Json = { project: pid, product: p, id, package_dir: folder, listed: false, entry: null, other_path: null, host: null, app: null };
  if (!(p in NAMES)) return out;
  const found = installs();
  const dev = readDev(p);
  for (const row of dev.dev.extensions) {
    if (row.id === id) {
      const same = String(row.path ?? '') === folder;
      out.listed = same;
      out.entry = row;
      if (!same) out.other_path = row.path;
    }
  }
  const version = appVersion(p, found);
  out.host = hostView(p, id || 'missing-id', folder, version);
  out.app = { name: appName(p), version: version || null, installs: found.installs[p] ?? [], launchable: (found.installs[p] ?? []).some((i: Json) => i.target) };
  out.dev = { file: dev.file, exists: dev.exists, mtime: dev.mtime, problems: dev.problems, count: dev.dev.extensions.length };
  return out;
}

export function runProject(pid: string): Json {
  const project = workspace.get(pid);
  if (!(project.product in NAMES)) throw portalError("set the manifest's product to a Form app first");
  if (project.manifest_error) throw portalError(project.manifest_error);
  devAdd(project.product, String(project.manifest.id || ''), project.package_dir);
  const status = projectStatus(pid);
  emit('runapp.running', { id: pid, product: project.product, state: status.host?.state ?? null });
  return status;
}

export function stopProject(pid: string): Json {
  const project = workspace.get(pid);
  devRemove(project.product, String(project.manifest.id || ''));
  return projectStatus(pid);
}

export function openApp(p: string, channel = ''): Json {
  p = product(p);
  const rows: Json[] = installs().installs[p] ?? [];
  const row = channel ? rows.find((r) => r.channel === channel) : rows.find((r) => r.target);
  if (!row) throw notFound(`FormPortal has not installed ${appName(p)}${channel ? ` (${channel})` : ''} on this computer`);
  if (!row.target) throw portalError(`nothing to open in ${row.path}`);
  emit('runapp.opened', { product: p, channel: row.channel, pid: 0 });
  return { product: p, channel: row.channel, opened: `${row.target} (the browser demo starts no program)`, pid: 0 };
}

export function manage(p: string): Json {
  return { opened: `formai://extensions?product=${product(p)}` };
}

export async function send(path: string, data: Uint8Array): Promise<Json> {
  if (!path.toLowerCase().endsWith('.formpkg')) throw notFound(`no .formpkg at ${path}`);
  const found = installs();
  const cli = cliInfo(found);
  if (!cli.found) throw portalError('FormPortal is not installed in the simulated folder');
  const files = await unzip(data);
  const raw = files.get('manifest.json');
  const m = raw ? JSON.parse(new TextDecoder().decode(raw)) : null;
  if (!m || !kit.ID_RE.test(String(m.id ?? '')) || !(m.product in NAMES)) throw portalError('FormPortal refused the package: it has no usable manifest.json');
  const base = rootDir();
  const folder = `${base}/extensions/${m.product}/${m.id}/${m.version}`;
  fs.batch(() => {
    fs.remove(folder);
    for (const [rel, body] of files) fs.write(`${folder}/${rel}`, body);
  });
  const listFile = `${base}/extensions/installed.json`;
  const list = readJson(listFile) ?? { format: 'formportal-installed-extensions', format_version: 1, extensions: [] };
  list.extensions = (list.extensions ?? []).filter((r: Json) => !(r.id === m.id && r.product === m.product));
  list.extensions.push({ id: m.id, name: m.name, product: m.product, version: m.version, source: 'sideload', enabled: true, signed_by: null, path: folder, installed_at: iso(now()) });
  writeJson(listFile, list);
  const enabledFile = `${base}/extensions/${m.product}/enabled.json`;
  const en = readJson(enabledFile) ?? { format: ENABLED_FORMAT, format_version: 1, product: m.product, extensions: [] };
  en.extensions = (en.extensions ?? []).filter((r: Json) => r.id !== m.id);
  en.extensions.push({ id: m.id, kind: m.kind, version: m.version, path: folder, permissions: m.permissions ?? [], native: Boolean(m.native), source: 'sideload' });
  writeJson(enabledFile, en);
  const command = [...cli.command, 'extension-install', '--path', path];
  emit('runapp.sent', { package: path, method: 'cli' });
  emit('runapp.changed', { product: m.product, kind: 'enabled' });
  return { method: 'cli', command: command.join(' '), package: path, answer: { installed: { id: m.id, name: m.name, version: m.version } }, installed: { id: m.id, name: m.name, version: m.version, product: m.product }, note: `(The demo's FormPortal is simulated: the package is unpacked into ${folder} and listed in enabled.json.)` };
}
