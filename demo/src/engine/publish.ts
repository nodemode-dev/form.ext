import { emit } from '../../../frontend/src/shell/events';
import { now, utf8 } from './bytes';
import { bad, notFound } from './errors';
import { PLAIN } from './kit';
import type { Json } from './kit';
import { keys } from './keys';
import { DEFAULT_URL, packages } from './package';
import { appName, send as portalSend } from './portal';
import { settings } from './settings';
import { schemaErrors } from './validate';
import * as fs from './vfs';
import { dataDir, readJson, workspace, writeJson } from './workspace';
import { writeZip } from './zip';
import packageSchema from '../../../contract/schema/package.schema.json';
import extensionsSchema from '../../../contract/schema/extensions.schema.json';

const SITE = 'https://formai.studio/extensions/';
const EXT_PREFIX = 'package.schema.json#/$defs/';

function indexSchema(): Json {
  const index: Json = JSON.parse(JSON.stringify(extensionsSchema));
  index.$defs = index.$defs ?? {};
  for (const [k, v] of Object.entries((packageSchema as Json).$defs ?? {})) index.$defs[`pkg-${k}`] = v;
  const local = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(local);
    if (node && typeof node === 'object') {
      let n = node as Json;
      if (typeof n.$ref === 'string' && n.$ref.startsWith(EXT_PREFIX)) n = { ...n, $ref: `#/$defs/pkg-${n.$ref.slice(EXT_PREFIX.length)}` };
      return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, local(v)]));
    }
    return node;
  };
  return local(index);
}

function indexProblems(index: Json): string[] {
  const schema = indexSchema();
  const found = schemaErrors(schema, schema, index).map(([, m]) => (m.startsWith('manifest') ? m.replace('manifest', 'index') : m));
  (index.packages ?? []).forEach((e: Json, i: number) => {
    if (e?.native === true && !('signature' in e)) found.push(`packages[${i}].signature is required for a native package`);
    const sig = e?.signature;
    if (sig && !(index.publishers ?? []).some((p: Json) => p?.id === sig.publisher)) found.push(`packages[${i}] is signed by ${sig.publisher}, which publishers does not list`);
  });
  return found;
}

const submissionsDir = () => dataDir('submissions');

async function pickKey(kid: string): Promise<Json> {
  const listed = await keys.list();
  if (kid) return listed.find((k) => k.id === kid) ?? (await keys.get(kid));
  const preferred = String(settings.value('publisher') || '');
  return listed.find((k) => k.id === preferred) ?? listed[listed.length - 1] ?? null;
}

function readme(e: Json, publishers: Json[], pkg: string): string {
  const perms: string[] = e.permissions ?? [];
  const sig = e.signature;
  const pub = sig ? publishers.find((p) => p.id === sig.publisher) ?? {} : {};
  return [
    `# ${e.name} ${e.version}`,
    '',
    e.description || '',
    '',
    'A Form extension submitted to formai.studio, made with form.ext.',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Id | \`${e.id}\` |`,
    `| App | ${appName(e.product)} (\`${e.product}\`) |`,
    `| Kind | \`${e.kind}\` |`,
    `| Version | ${e.version} |`,
    `| Author | ${e.author} |`,
    `| Licence | ${e.licence} |`,
    `| Extension API | ${e.api ?? 'not stated'} |`,
    `| Minimum app version | ${e.minimum_app ?? 'any'} |`,
    `| Package | \`${pkg}\` |`,
    `| Size | ${e.bytes} bytes |`,
    `| SHA-256 | \`${e.sha256}\` |`,
    `| Address in the index | ${e.url} |`,
    '',
    '## What it may do',
    '',
    ...(perms.length ? perms.map((p) => `- \`${p}\`: ${PLAIN[p] ?? p}`) : ['- Nothing beyond its own panel: it asks for no permission.']),
    '',
    '## Signature',
    '',
    ...(sig
      ? [`Signed with Ed25519 by \`${sig.publisher}\` (${pub.name ?? sig.publisher}). The signature is over the package file's exact bytes.`, '', `Public key (base64): \`${pub.public_key ?? ''}\``]
      : ["Not signed. FormPortal installs it as a script extension; a publisher key in form.ext's Package pane signs the next submission."]),
    '',
    '## Files in this folder',
    '',
    `- \`${pkg}\`: the deterministic package; the same source always gives the same SHA-256.`,
    "- `entry.json`: the package's entry for the `packages` list of `extensions.json`.",
    '- `extensions.json`: a one-package index (with its publisher when signed) that passes `extensions.schema.json`, for trying the entry with FormPortal or a local copy of the site.',
    '- `README.md`: this file.',
    "- `submission.json`: form.ext's own record of the submission (project, build, when it was prepared); the site does not need it.",
    '',
    '## Submitting',
    '',
    `Send the folder to formai.studio (${SITE}). The site serves the package at the address above and adds \`entry.json\` to its extension index; FormPortal then lists it for ${appName(e.product)} and checks the SHA-256${sig ? ' and the signature' : ''} before it installs it.`,
    '',
  ].join('\n');
}

function latest(pid: string): Json {
  const m = workspace.manifest(pid);
  if (!m.id || !m.version) return null;
  const folder = `${submissionsDir()}/${m.id}-${m.version}`;
  const data = readJson(`${folder}/submission.json`);
  if (!data) return null;
  data.folder = folder;
  data.files = fs.children(folder).filter((n) => !n.startsWith('.') && fs.isFile(`${folder}/${n}`)).sort();
  let built: Json[] = [];
  try {
    built = packages.list(pid);
  } catch {
    built = [];
  }
  data.stale = Boolean(built[0] && built[0].sha256 !== data.sha256);
  return data;
}

export async function status(pid: string): Promise<Json> {
  const project = workspace.get(pid);
  const m = project.manifest;
  const pick: Json = {};
  for (const k of ['id', 'name', 'product', 'version', 'kind', 'author', 'licence', 'permissions', 'description', 'minimum_app', 'api', 'native', 'homepage', 'support']) pick[k] = m[k] ?? null;
  return { project: pid, manifest: pick, default_url: DEFAULT_URL(m.id ?? 'id', m.version ?? '0.0.0'), keys: await keys.list(), publisher: settings.value('publisher') || '', submission: latest(pid), submissions_dir: submissionsDir() };
}

export async function prepare(pid: string, url = '', publisher = '', passphrase = '', sign = true): Promise<Json> {
  const build = await packages.build(pid);
  const sha = build.sha256;
  let signedBy = '';
  const key = sign ? await pickKey(publisher) : null;
  if (key) {
    if (!(build.signatures ?? []).some((s: Json) => s.publisher === key.id)) await packages.sign(pid, sha, key.id, passphrase);
    signedBy = key.id;
  }
  const made = await packages.entry(pid, sha, url, signedBy);
  const e = made.entry;
  let publishers = made.publishers;
  if (!signedBy) {
    delete e.signature;
    publishers = [];
  }
  const manifest = packages.get(pid, sha).manifest;
  const index = { format: 'formai-extensions', format_version: 1, name: `${e.name} (submission)`, description: `One package submitted from form.ext for ${appName(e.product)}.`, publishers, packages: [e] };
  const problems = indexProblems(index);
  if (problems.length) throw bad(`the index entry would not pass extensions.schema.json: ${problems.join('; ')}`);
  const source = packages.file(pid, sha);
  const folder = `${submissionsDir()}/${manifest.id}-${manifest.version}`;
  const record = { format: 'formext-submission', format_version: 1, project: pid, id: e.id, version: e.version, product: e.product, sha256: sha, bytes: e.bytes, package: source.name, url: e.url, url_default: made.url_default, signed_by: signedBy || null, prepared_at: now(), entry: e, publishers };
  fs.batch(() => {
    fs.remove(folder);
    fs.write(`${folder}/${source.name}`, source.data);
    writeJson(`${folder}/entry.json`, e);
    writeJson(`${folder}/extensions.json`, index);
    fs.write(`${folder}/README.md`, utf8(readme(e, publishers, source.name)));
    writeJson(`${folder}/submission.json`, record);
  });
  emit('publish.ready', { id: pid, sha256: sha, folder, signed_by: signedBy || null });
  const out = latest(pid) ?? { ...record, folder };
  out.warnings = build.warnings ?? [];
  out.fresh = build.fresh ?? false;
  return out;
}

function submission(pid: string): Json {
  const sub = latest(pid);
  if (!sub) throw notFound('prepare a submission first');
  return sub;
}

export function send(pid: string): Promise<Json> {
  const sub = submission(pid);
  const path = `${sub.folder}/${sub.package}`;
  return portalSend(path, fs.read(path)!);
}

export async function reveal(pid: string): Promise<Json> {
  const sub = submission(pid);
  const name = String(sub.folder).split('/').pop()!;
  const entries = fs.walk(sub.folder).map((rel) => ({ path: `${name}/${rel}`, data: fs.read(`${sub.folder}/${rel}`)! }));
  const zip = await writeZip(entries);
  const url = URL.createObjectURL(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.zip`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { opened: sub.folder, demo: 'saved the folder as a zip' };
}
