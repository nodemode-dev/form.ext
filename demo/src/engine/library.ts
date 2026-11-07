import { emit } from '../../../frontend/src/shell/events';
import { basename, ext as suffix, fromB64, now, plural, shaHex, strictText, utf8 } from './bytes';
import { grouped, lineCounts, splitLines } from './diff';
import { HttpError, bad, notFound, refused } from './errors';
import * as kit from './kit';
import type { Folder, Json } from './kit';
import { packages } from './package';
import { validateFolder } from './validate';
import { workspace } from './workspace';
import { readEntry, readInfos, type ZipInfo } from './zip';

const MAX_FILE_UNPACKED = 50 * 1024 * 1024;
const MAX_UNPACKED = 200 * 1024 * 1024;
const MAX_RATIO = 200;
const TEXT_TYPES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.md', '.cube']);
const DIFF_LINES = 4000;
const IMPORT_RECORD = 'import.json';
export const WORKING = 'current';
const REGISTRY_RELEASES = 'https://github.com/nodemode-dev/form.ext-registry/releases/download/';
const REGISTRY_INDEX = `${REGISTRY_RELEASES}index/extensions.json`;
const REGISTRY_SOURCE = 'https://github.com/nodemode-dev/form.ext-registry/tree/main/extensions/{id}';
const SHA_RE = /^[0-9a-f]{64}$/;
const PACKAGE_RE = /^[a-z0-9][a-z0-9-]{1,63}-[0-9]+\.[0-9]+\.[0-9]+$/;
const WORDS = kit.PERMISSION_WORDS;

function entryProblem(info: ZipInfo): string | null {
  const name = info.filename;
  if (!name || name.includes('\x00')) return 'the entry has no usable name';
  if (name.includes('\\')) return 'the path uses a backslash; package paths use /';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return 'absolute paths are not allowed';
  const trimmed = name.replace(/\/+$/, '');
  if (trimmed.split('/').includes('..')) return 'the path climbs out of the package (it has a .. segment)';
  if (trimmed.split('/').some((p) => p === '' || p === '.')) return 'the path has an empty or . segment';
  const mode = (info.external_attr >>> 16) & 0xffff;
  if (info.create_system === 3 && (mode & 0o170000) === 0o120000) return 'symlinks are not allowed';
  if (info.flag_bits & 1) return 'the entry is encrypted';
  if (info.is_dir) return null;
  if (name.length > 200) return 'the path is longer than 200 characters';
  if (!(suffix(name) in kit.TYPES)) return `the file type ${suffix(name) || '(none)'} is not allowed`;
  if (info.file_size > MAX_FILE_UNPACKED) return `the file unpacks to ${info.file_size} bytes; form.ext takes at most ${MAX_FILE_UNPACKED}`;
  if (info.compress_size && info.file_size / info.compress_size > MAX_RATIO && info.file_size > 1024 * 1024) return 'the file is packed suspiciously tightly (a zip bomb?)';
  return null;
}

function determinism(infos: ZipInfo[]): Json {
  const names = infos.filter((i) => !i.is_dir).map((i) => i.filename);
  const notes: string[] = [];
  if (JSON.stringify(names) !== JSON.stringify([...names].sort())) notes.push('entries are not sorted by path');
  if (infos.some((i) => i.date_time.join() !== '1980,1,1,0,0,0')) notes.push('timestamps are not 1980-01-01 00:00:00');
  if (infos.some((i) => !i.is_dir && ![0, 0o644].includes((i.external_attr >>> 16) & 0o777))) notes.push('file modes are not 0644');
  if (infos.some((i) => !i.is_dir && i.compress_type !== 8)) notes.push('not every entry is deflated');
  if (infos.some((i) => i.is_dir)) notes.push('the zip holds folder entries');
  return { kit_layout: !notes.length, notes };
}

function summary(m: Json): Json {
  const c = m.contributes && typeof m.contributes === 'object' && !Array.isArray(m.contributes) ? m.contributes : {};
  const e = m.entry && typeof m.entry === 'object' && !Array.isArray(m.entry) ? m.entry : {};
  const perms = Array.isArray(m.permissions) ? m.permissions : [];
  const objs = (x: unknown) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);
  return {
    id: m.id ?? null,
    name: m.name ?? null,
    product: m.product ?? null,
    kind: m.kind ?? null,
    version: m.version ?? null,
    author: m.author ?? null,
    licence: m.licence ?? null,
    api: m.api ?? null,
    native: m.native ?? null,
    minimum_app: m.minimum_app ?? null,
    description: m.description || '',
    homepage: m.homepage || '',
    entry: typeof e.ui === 'string' ? e.ui : null,
    panels: objs(c.panels),
    commands: objs(c.commands),
    permissions: perms.map((p: unknown) => ({ id: String(p), words: WORDS[String(p)] ?? 'a permission API 1 does not know' })),
  };
}

async function rebuild(folder: Folder): Promise<Json> {
  try {
    const b = await kit.build(folder);
    return { ok: true, sha256: b.sha256, bytes: b.bytes, reason: '' };
  } catch (e) {
    return { ok: false, sha256: null, bytes: null, reason: String((e as Error).message).replace(/^refused: /, '') };
  }
}

function importRecord(pid: string): Json {
  try {
    const d = JSON.parse(strictText(workspace.read(pid, IMPORT_RECORD)) ?? '');
    return d && typeof d === 'object' ? d : null;
  } catch {
    return null;
  }
}

function known(digest: string): Json[] {
  const out: Json[] = [];
  for (const p of workspace.projects()) {
    try {
      if (packages.list(p.id).some((b) => b.sha256 === digest)) out.push({ kind: 'build', project: p.id });
    } catch {
      continue;
    }
  }
  for (const p of workspace.projects()) {
    const rec = importRecord(p.id);
    if (rec && rec.sha256 === digest) out.push({ kind: 'import', project: p.id, name: p.name });
  }
  return out;
}

export async function readPackage(data: Uint8Array): Promise<[Json, Map<string, Uint8Array>]> {
  const errors: Json[] = [];
  const warnings: Json[] = [];
  const files = new Map<string, Uint8Array>();
  const listing: Json[] = [];
  const head = { sha256: await shaHex(data), bytes: data.length };
  if (data.length > kit.MAX_BYTES) {
    errors.push({ file: '', message: `the package is ${data.length} bytes; at most ${kit.MAX_BYTES} (20 MB)` });
    return [{ ...head, errors, warnings, files: [], manifest: null }, files];
  }
  let infos: ZipInfo[];
  try {
    infos = readInfos(data);
  } catch (e) {
    errors.push({ file: '', message: `this is not a zip file (${(e as Error).message})` });
    return [{ ...head, errors, warnings, files: [], manifest: null }, files];
  }
  const seen = new Set<string>();
  const real = infos.filter((i) => !i.is_dir);
  if (real.length > kit.MAX_FILES) errors.push({ file: '', message: `${real.length} files; at most ${kit.MAX_FILES}` });
  let total = 0;
  for (const info of infos) {
    const name = info.filename;
    const problem = entryProblem(info);
    const row: Json = { path: name, size: info.file_size, packed: info.compress_size, sha256: null, type: suffix(name), text: TEXT_TYPES.has(suffix(name)), ok: problem === null };
    if (info.is_dir && !problem) continue;
    const fail = (msg: string) => {
      row.ok = false;
      row.problem = msg;
      errors.push({ file: name, message: msg });
      listing.push(row);
    };
    if (problem) {
      fail(problem);
      continue;
    }
    if (seen.has(name.toLowerCase())) {
      fail('the same path appears twice (or differs only in letter case)');
      continue;
    }
    seen.add(name.toLowerCase());
    total += info.file_size;
    if (total > MAX_UNPACKED) {
      errors.push({ file: name, message: `the package unpacks to more than ${MAX_UNPACKED / (1024 * 1024)} MB` });
      break;
    }
    let body: Uint8Array;
    try {
      body = await readEntry(data, info);
    } catch (e) {
      fail(`the entry cannot be read (${(e as Error).message})`);
      continue;
    }
    if (body.length !== info.file_size) {
      fail("the entry's real size differs from what the zip says");
      continue;
    }
    row.sha256 = await shaHex(body);
    files.set(name, body);
    listing.push(row);
  }
  const layout = determinism(infos);
  listing.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  let manifest: Json = null;
  if (!files.has('manifest.json')) {
    const nested = [...files.keys()].filter((n) => n.endsWith('/manifest.json'));
    errors.push({ file: 'manifest.json', message: `there is no manifest.json at the root of the package${nested.length ? ` (found ${nested[0]}; the manifest must be at the root, with no enclosing folder)` : ''}` });
  } else {
    try {
      const parsed = JSON.parse(strictText(files.get('manifest.json')!) ?? '\u0000');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed;
      else errors.push({ file: 'manifest.json', message: 'manifest.json must hold one JSON object' });
    } catch (e) {
      errors.push({ file: 'manifest.json', message: `manifest.json is not valid JSON (${(e as Error).message})` });
    }
  }
  if (!layout.kit_layout) warnings.push({ file: '', message: `not laid out as the kit's formpkg build writes it: ${layout.notes.join('; ')}. It still installs; the SHA-256 will differ from a rebuild.` });
  return [{ ...head, errors, warnings, files: listing, manifest, layout }, files];
}

function kitProblems(folder: Folder): string[] {
  try {
    return [...kit.problems(folder)[0], ...kit.filesOf(folder)[1]];
  } catch (e) {
    return [`manifest.json: the manifest is malformed (${(e as Error).message})`];
  }
}

export async function inspectBytes(data: Uint8Array, name = ''): Promise<Json> {
  const t0 = performance.now();
  const [report, files] = await readPackage(data);
  report.name = basename(name || '') || null;
  report.summary = report.manifest ? summary(report.manifest) : null;
  report.check = null;
  report.rebuild = null;
  if (files.size && report.manifest !== null) {
    const seen = new Set(report.errors.map((e: Json) => e.message));
    for (const msg of kitProblems(files)) {
      const i = msg.indexOf(': ');
      const file = i >= 0 ? msg.slice(0, i) : msg;
      const t = i >= 0 ? msg.slice(i + 2) : '';
      if (t && !seen.has(t)) report.errors.push({ file, message: t, kit: true });
    }
    const check = await validateFolder(files);
    report.check = { ok: check.ok, counts: check.counts, problems: check.problems };
    report.rebuild = await rebuild(files);
    if (report.rebuild.ok) report.rebuild.same = report.rebuild.sha256 === report.sha256;
  }
  report.known = known(report.sha256);
  report.ok = !report.errors.length;
  report.can_import = report.manifest !== null && !report.errors.some((e: Json) => !e.kit);
  report.kit_refuses = report.errors.some((e: Json) => e.kit);
  report.product = report.manifest?.product ?? null;
  report.ms = Math.round(performance.now() - t0);
  return report;
}

export async function importBytes(data: Uint8Array, name = '', projectName: string | null = null, source: Json = null, anyway = false): Promise<Json> {
  const report = await inspectBytes(data, name);
  if (!report.can_import) {
    const blocking = report.errors.filter((e: Json) => !e.kit);
    const first = blocking.length ? blocking[0].message : 'the package has no readable manifest.json';
    throw refused(`Not imported: the package is unsafe or unreadable (${first}${blocking.length < 2 ? '' : `, and ${plural(blocking.length - 1, 'more problem')}`}).`, { report });
  }
  if (report.kit_refuses && !anyway) {
    const k = report.errors.filter((e: Json) => e.kit);
    throw refused(`The kit refuses this package (${plural(k.length, 'problem')}, first: ${k[0].message}). Import it anyway to fix it in form.ext.`, { report });
  }
  const [, files] = await readPackage(data);
  const m = report.manifest;
  const title = (projectName || '').trim() || String(m.name || m.id || 'Imported extension');
  const record = { format: 'formext-import', format_version: 1, sha256: report.sha256, bytes: report.bytes, file: report.name ?? null, id: m.id ?? null, version: m.version ?? null, imported_at: now(), source: source ?? { kind: 'upload' } };
  const tree: Record<string, Uint8Array> = {};
  for (const [rel, body] of files) tree[`package/${rel}`] = body;
  tree[IMPORT_RECORD] = utf8(`${JSON.stringify(record, null, 2)}\n`);
  const project = workspace.create(title, m.product, tree);
  emit('library.imported', { id: project.id, sha256: report.sha256, package: m.id, version: m.version });
  return { project, report, record };
}

declare global {
  interface Window {
    __FORMEXT_PACKAGES__?: Record<string, string>;
  }
}

function bundledFiles(): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const [file, b64] of Object.entries(window.__FORMEXT_PACKAGES__ ?? {}).sort()) {
    const stem = file.replace(/\.formpkg$/, '');
    if (PACKAGE_RE.test(stem)) out.set(stem, fromB64(b64));
  }
  return out;
}

let bundledIndex: { at: number; entries: Json[]; files: Map<string, Uint8Array> } | null = null;

async function readIndex(): Promise<{ at: number; entries: Json[]; files: Map<string, Uint8Array> }> {
  if (bundledIndex) return bundledIndex;
  const files = new Map<string, Uint8Array>();
  const newest = new Map<string, Json>();
  for (const [key, data] of bundledFiles()) {
    const [report] = await readPackage(data);
    const m = report.manifest;
    if (!m || report.errors.length || typeof m.id !== 'string') continue;
    const have = newest.get(m.id);
    if (have && cmpVersion(versionKey(have.version), versionKey(m.version)) >= 0) continue;
    const e = kit.entry(m, `${REGISTRY_RELEASES}ext-${m.id}-v${m.version}/${key}.formpkg`, report.sha256, report.bytes);
    e.verified = true;
    e.source = REGISTRY_SOURCE.replace('{id}', m.id);
    newest.set(m.id, e);
    files.set(e.url, data);
  }
  bundledIndex = { at: now(), entries: [...newest.values()], files };
  return bundledIndex;
}

function versionKey(v: unknown): number[] {
  const parts = String(v).split('.').map(Number);
  return parts.some((p) => !Number.isInteger(p)) ? [0] : parts;
}

function cmpVersion(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export async function registryShelf(): Promise<Json> {
  const imported = new Map<string, string[]>();
  for (const p of workspace.projects()) {
    const rec = importRecord(p.id);
    if (rec?.sha256) imported.set(rec.sha256, [...(imported.get(rec.sha256) ?? []), p.id]);
  }
  const index = await readIndex();
  const rows = index.entries.map((e) => ({
    id: e.id,
    name: e.name || e.id,
    product: e.product || '',
    version: e.version,
    kind: e.kind,
    author: e.author || '',
    licence: e.licence || '',
    description: e.description || '',
    permissions: (e.permissions || []).filter((p: unknown) => typeof p === 'string').map((p: string) => ({ id: p, words: WORDS[p] ?? p })),
    verified: true,
    listed_verified: true,
    source: e.source,
    registry_commit: null,
    url: e.url,
    sha256: e.sha256,
    bytes: e.bytes,
    signed_by: null,
    imported: imported.get(e.sha256) ?? [],
  }));
  rows.sort((a, b) => (String(a.product) + '\u0000' + String(a.name).toLowerCase() < String(b.product) + '\u0000' + String(b.name).toLowerCase() ? -1 : 1));
  return {
    url: REGISTRY_INDEX,
    url_source: 'bundled',
    name: 'Form Extension Registry',
    verified: true,
    key: null,
    keys: 0,
    note: 'the copy of the registry index bundled with this page (form.ext itself downloads the signed index and checks its signature with the registry key)',
    offline: null,
    fetched_at: index.at,
    sha256: '',
    registry_commit: null,
    publishers: [],
    extensions: rows,
  };
}

async function registryPackage(id: string): Promise<{ data: Uint8Array; entry: Json; source: Json }> {
  const index = await readIndex();
  const entry = index.entries.find((e) => e.id === id);
  if (!entry) throw notFound(`the registry index lists no extension ${id}`);
  const data = index.files.get(entry.url);
  if (!data) throw new HttpError(502, `The registry is unreachable: the package of ${id} is not bundled with this page.`, { problem: 'unreachable' });
  if ((await shaHex(data)) !== entry.sha256) throw refused(`Not imported: the package downloaded for ${id} does not match the SHA-256 the signed index gives, so it was changed on the way or on the server.`, { problem: 'sha256' });
  const source = { kind: 'registry', id, version: entry.version, sha256: entry.sha256, url: entry.url, index: REGISTRY_INDEX, repo: entry.source, repo_name: `nodemode-dev/form.ext-registry/extensions/${id}`, signed_by: null, index_verified: false };
  return { data, entry, source };
}

export async function inspectRegistry(id: string): Promise<Json> {
  const { data, entry, source } = await registryPackage(id);
  const out = await inspectBytes(data, `${id}-${entry.version}.formpkg`);
  out.source = source;
  return out;
}

export async function importRegistry(id: string, name: string | null = null, anyway = false): Promise<Json> {
  const { data, entry, source } = await registryPackage(id);
  return importBytes(data, `${id}-${entry.version}.formpkg`, name, source, anyway);
}

export async function inspectBuild(pid: string, sha: string): Promise<Json> {
  const f = packages.file(pid, sha);
  const out = await inspectBytes(f.data, f.name);
  out.source = { kind: 'build', project: pid, sha256: sha };
  return out;
}

export async function importBuild(pid: string, sha: string, name: string | null = null, anyway = false): Promise<Json> {
  const f = packages.file(pid, sha);
  return importBytes(f.data, f.name, name, { kind: 'build', project: pid, sha256: sha }, anyway);
}

export function inspectPath(path: string): never {
  if (!String(path || '').trim()) throw bad('give the path of a .formpkg file');
  throw notFound(`no such file: ${path} (the demo has no files on disk; choose a .formpkg from this computer instead)`);
}

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const isObj = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (isObj(value) && Object.keys(value).length) {
    for (const k of Object.keys(value).sort()) for (const [a, b] of flatten(value[k], prefix ? `${prefix}.${k}` : k)) out.set(a, b);
  } else if (Array.isArray(value) && value.length && value.every((v) => isObj(v) && 'id' in v)) {
    for (const v of value) for (const [a, b] of flatten(v, `${prefix}[${v.id}]`)) out.set(a, b);
  } else if (Array.isArray(value) && value.length && value.every((v) => ['string', 'number', 'boolean'].includes(typeof v))) out.set(prefix, [...value]);
  else if (Array.isArray(value) && value.length) value.forEach((v, i) => flatten(v, `${prefix}[${i}]`).forEach((b, a) => out.set(a, b)));
  else out.set(prefix, value);
  return out;
}

interface Side {
  kind: string;
  sha256: string | null;
  bytes: number;
  version: unknown;
  built_at: number | null;
  label: string;
  manifest: Json;
  files: Map<string, Uint8Array>;
}

async function side(pid: string, ref: string): Promise<Side> {
  if (ref === WORKING) {
    const folder = workspace.folder(pid);
    const [found] = kit.filesOf(folder);
    const files = new Map(found.map((r) => [r, folder.get(r)!]));
    let manifest: Json = {};
    try {
      manifest = JSON.parse(strictText(files.get('manifest.json') ?? utf8('{}')) ?? '{}');
    } catch {
      manifest = {};
    }
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) manifest = {};
    return { kind: 'working', sha256: null, bytes: [...files.values()].reduce((n, v) => n + v.length, 0), version: manifest.version ?? null, built_at: null, label: "the project's files now", manifest, files };
  }
  if (typeof ref !== 'string' || !SHA_RE.test(ref)) throw notFound('choose a build or the current files');
  const record = packages.get(pid, ref);
  const f = packages.file(pid, ref);
  const files = new Map<string, Uint8Array>();
  for (const i of readInfos(f.data)) if (!i.is_dir) files.set(i.filename, await readEntry(f.data, i));
  return { kind: 'build', sha256: ref, bytes: record.bytes, version: record.version, built_at: record.built_at ?? null, label: `${record.version} build ${ref.slice(0, 10)}`, manifest: record.manifest ?? {}, files };
}

const publicSide = (s: Side) => ({ kind: s.kind, sha256: s.sha256, bytes: s.bytes, version: s.version, built_at: s.built_at, label: s.label });

function lines(data: Uint8Array): string[] | null {
  const t = strictText(data);
  return t === null ? null : splitLines(t);
}

export async function compare(pid: string, a: string, b: string): Promise<Json> {
  workspace.dir(pid);
  const left = await side(pid, a);
  const right = await side(pid, b);
  const ma = flatten(left.manifest);
  const mb = flatten(right.manifest);
  const manifestChanges: Json[] = [];
  for (const key of [...new Set([...ma.keys(), ...mb.keys()])].sort()) {
    if (!ma.has(key)) manifestChanges.push({ path: key, change: 'added', before: null, after: mb.get(key) });
    else if (!mb.has(key)) manifestChanges.push({ path: key, change: 'removed', before: ma.get(key), after: null });
    else if (JSON.stringify(ma.get(key)) !== JSON.stringify(mb.get(key))) manifestChanges.push({ path: key, change: 'changed', before: ma.get(key), after: mb.get(key) });
  }
  const pa: string[] = (left.manifest.permissions || []).filter((p: unknown) => typeof p === 'string');
  const pb: string[] = (right.manifest.permissions || []).filter((p: unknown) => typeof p === 'string');
  const w = (p: string) => ({ id: p, words: WORDS[p] ?? p });
  const perms = { added: pb.filter((p) => !pa.includes(p)).map(w), removed: pa.filter((p) => !pb.includes(p)).map(w), kept: pb.filter((p) => pa.includes(p)).map(w) };
  const files: Json[] = [];
  const counts: Record<string, number> = { added: 0, removed: 0, changed: 0, same: 0 };
  for (const path of [...new Set([...left.files.keys(), ...right.files.keys()])].sort()) {
    const x = left.files.get(path);
    const y = right.files.get(path);
    const change = !x ? 'added' : !y ? 'removed' : (await shaHex(x)) !== (await shaHex(y)) ? 'changed' : 'same';
    counts[change]++;
    const row: Json = { path, change, before: x ? x.length : null, after: y ? y.length : null, text: TEXT_TYPES.has(suffix(path)) };
    if (change === 'changed' && row.text) {
      const la = lines(x!);
      const lb = lines(y!);
      row.lines = la && lb ? lineCounts(la, lb) : null;
    } else if ((change === 'added' || change === 'removed') && row.text) {
      const l = lines((y ?? x)!);
      if (l) row.lines = !x ? { added: l.length, removed: 0 } : { added: 0, removed: l.length };
    }
    files.push(row);
  }
  const va = left.manifest.version ?? null;
  const vb = right.manifest.version ?? null;
  return {
    project: pid,
    a: publicSide(left),
    b: publicSide(right),
    identical: !manifestChanges.length && counts.added === 0 && counts.removed === 0 && counts.changed === 0,
    version: { before: va, after: vb, changed: va !== vb },
    permissions: perms,
    consent_again: perms.added.length > 0 || va !== vb,
    manifest: manifestChanges,
    files,
    counts,
  };
}

export async function compareFile(pid: string, a: string, b: string, rel: string, context = 3): Promise<Json> {
  workspace.dir(pid);
  const left = await side(pid, a);
  const right = await side(pid, b);
  const x = left.files.get(rel);
  const y = right.files.get(rel);
  if (!x && !y) throw notFound(`neither side has ${rel}`);
  const sizes = { before: x ? x.length : null, after: y ? y.length : null };
  if (!TEXT_TYPES.has(suffix(rel))) return { path: rel, text: false, hunks: [], ...sizes };
  const la = lines(x ?? new Uint8Array());
  const lb = lines(y ?? new Uint8Array());
  if (!la || !lb) return { path: rel, text: false, hunks: [], before: (x ?? []).length, after: (y ?? []).length };
  const hunks: Json[] = [];
  let total = 0;
  let truncated = false;
  for (const g of grouped(la, lb, Math.max(0, Math.min(Math.trunc(context), 20)))) {
    const first = g[0];
    const last = g[g.length - 1];
    const hunk: Json = { a_start: first[1] + 1, a_lines: last[2] - first[1], b_start: first[3] + 1, b_lines: last[4] - first[3], lines: [] };
    for (const [tag, i1, i2, j1, j2] of g) {
      if (tag === 'equal') {
        for (let k = i1; k < i2; k++) hunk.lines.push({ t: ' ', a: k + 1, b: j1 + (k - i1) + 1, s: la[k] });
        continue;
      }
      if (tag === 'replace' || tag === 'delete') for (let k = i1; k < i2; k++) hunk.lines.push({ t: '-', a: k + 1, b: null, s: la[k] });
      if (tag === 'replace' || tag === 'insert') for (let k = j1; k < j2; k++) hunk.lines.push({ t: '+', a: null, b: k + 1, s: lb[k] });
    }
    total += hunk.lines.length;
    hunks.push(hunk);
    if (total > DIFF_LINES) {
      truncated = true;
      break;
    }
  }
  return { path: rel, text: true, hunks, truncated, ...sizes };
}
