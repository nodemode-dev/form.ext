import { emit } from '../../shell/events';
import { now, utf8 } from './bytes';
import { bad, notFound } from './errors';
import { PLAIN } from './kit';
import type { Json } from './kit';
import { keys } from './keys';
import { DEFAULT_URL, packages } from './package';
import { appName, send as portalSend } from './portal';
import { settings } from './settings';
import { registryShelf } from './library';
import { schemaErrors, validateFolder } from './validate';
import * as fs from './vfs';
import { dataDir, folderAt, readJson, workspace, writeJson } from './workspace';
import { writeZip } from './zip';
import packageSchema from '../../../../contract/schema/package.schema.json';
import extensionsSchema from '../../../../contract/schema/extensions.schema.json';

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
  const registry = { submission: registrySubmission(pid), folder: `${registryRoot()}/extensions/${m.id ?? 'id'}`, checkout: String(settings.value('registry.checkout') || ''), repo: REGISTRY_REPO };
  return { project: pid, manifest: pick, default_url: DEFAULT_URL(m.id ?? 'id', m.version ?? '0.0.0'), keys: await keys.list(), publisher: settings.value('publisher') || '', submission: latest(pid), submissions_dir: submissionsDir(), registry };
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

const REGISTRY_REPO = 'nodemode-dev/form.ext-registry';
const SKIP_ROOT = new Set(['import.json', 'dist', 'build']);
const SCREENSHOT_NAMES = ['docs/screenshot.png', 'docs/screenshot.jpg', 'docs/screenshot.webp', 'screenshot.png', 'screenshot.jpg', 'screenshot.webp'];
const registryRoot = () => `${submissionsDir()}/registry`;

function quote(s: string): string {
  return /^[A-Za-z0-9_\/.,:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\"'\"'")}'`;
}

function registryReadme(m: Json): string {
  const perms: string[] = (m.permissions ?? []).filter((p: unknown) => typeof p === 'string');
  const app = appName(String(m.product || ''));
  const name = m.name || m.id;
  return [
    `# ${name}`,
    '',
    m.description || name,
    '',
    `![${name} in ${app}](docs/screenshot.png)`,
    '',
    `${name} is an extension for ${app}, made with form.ext. It runs in ${app}'s sandboxed extension panel under the Form Extension Contract (API 1), and FormPortal installs it from the Form Extension Registry once the owners merge it.`,
    '',
    '## Permissions',
    '',
    ...(perms.length ? perms.map((p) => `- \`${p}\`: ${PLAIN[p] ?? p}. Why: say here what the extension does with it.`) : ['- None: it asks for no permission.']),
    '',
    '## Using it',
    '',
    `Open ${app}, then the Extensions panel, and choose ${name}.`,
    '',
  ].join('\n');
}

function registryLicence(m: Json): string {
  const year = new Date().getFullYear();
  return `SPDX-License-Identifier: ${m.licence || 'NOASSERTION'}\n\nCopyright ${year} ${m.author || 'the author'}\n\nReplace this file with the full text of the ${m.licence || 'chosen'} licence before the pull request.\n`;
}

function registryChangelog(m: Json): string {
  return `# Changelog\n\n## ${m.version}\n\n- ${m.description || 'First version.'}\n`;
}

function commands(m: Json, folder: string, update: boolean): Json[] {
  const name = m.name || m.id;
  const branch = `${update ? 'update' : 'add'}-${m.id}-${m.version}`;
  const title = `${update ? 'Update' : 'Add'} ${name} ${m.version}`;
  const body = `${title}: ${String(m.description || name).replace(/\.+$/, '')}. For ${appName(String(m.product || ''))}. Made and checked with form.ext.`;
  return [
    { say: 'Fork the registry and clone your fork (once).', run: `gh repo fork ${REGISTRY_REPO} --clone --remote` },
    { say: "Go into the clone and start a branch from the registry's main.", run: `cd form.ext-registry && git fetch upstream && git switch -c ${quote(branch)} upstream/main` },
    { say: 'Copy the extension folder in.', run: `rm -rf extensions/${m.id} && mkdir -p extensions && cp -R ${quote(folder)} extensions/${m.id}` },
    { say: "Run the registry's checks, as CI will.", run: `python3 tools/check.py extensions/${m.id}` },
    { say: 'Commit it.', run: `git add extensions/${m.id} && git commit -m ${quote(`feat(${m.id}): ${update ? `version ${m.version}` : `add ${name} ${m.version}`}`)}` },
    { say: 'Push the branch to your fork.', run: `git push -u origin ${quote(branch)}` },
    { say: 'Open the pull request; @nodemode-ai and @gbarnai review it.', run: `gh pr create --repo ${REGISTRY_REPO} --base main --title ${quote(title)} --body ${quote(body)}` },
  ];
}

async function ownChecks(folder: string, m: Json): Promise<Json> {
  const problems: Json[] = [];
  const check = await validateFolder(folderAt(`${folder}/package`));
  for (const p of check.problems) if (p.severity === 'error') problems.push({ level: 'error', where: `package/${p.file}${p.line ? `:${p.line}` : ''}`, message: p.message });
  if (m.api !== '1') problems.push({ level: 'error', where: 'package/manifest.json', message: 'api must be "1"' });
  if (m.native !== false) problems.push({ level: 'error', where: 'package/manifest.json', message: 'native must be false' });
  for (const name of ['README.md', 'CHANGELOG.md']) if (!fs.isFile(`${folder}/${name}`)) problems.push({ level: 'error', where: name, message: `${name} is missing` });
  if (!['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE'].some((n) => fs.isFile(`${folder}/${n}`))) problems.push({ level: 'error', where: 'LICENSE', message: 'LICENSE is missing' });
  if (!SCREENSHOT_NAMES.some((n) => fs.isFile(`${folder}/${n}`))) problems.push({ level: 'error', where: 'docs/screenshot.png', message: 'a screenshot is missing: add docs/screenshot.png (the extension in its app)' });
  const n = problems.length;
  const lines = [`form.ext Check on extensions/${m.id}: ${n ? `${n} problem${n === 1 ? '' : 's'}` : 'passed'}`, ...problems.map((p) => `  ${p.level}: ${p.where}: ${p.message}`)];
  return { by: 'formext', tool: 'form.ext Check', ok: !n, problems, report: lines.join('\n'), note: "The registry's tools/check.py was not run: set registry.checkout to a local clone of nodemode-dev/form.ext-registry to run the same checks CI runs. form.ext ran its own Check, the kit's package rules and the metadata files instead." };
}

export function registrySubmission(pid: string): Json {
  let id: unknown;
  try {
    id = workspace.manifest(pid).id;
  } catch {
    return null;
  }
  if (typeof id !== 'string') return null;
  const data = readJson(`${registryRoot()}/${id}.submission.json`);
  return data && data.project === pid ? data : null;
}

export async function submit(pid: string): Promise<Json> {
  const m = workspace.manifest(pid);
  if (typeof m.id !== 'string' || typeof m.version !== 'string') throw bad('the manifest needs an id and a version before it goes to the registry');
  const root = workspace.dir(pid);
  const prefix = workspace.packagePrefix(pid);
  const files = new Map<string, string>();
  for (const row of workspace.listFiles(pid)) {
    const rel: string = row.path;
    if (prefix && rel.startsWith(`${prefix}/`)) files.set(`package/${rel.slice(prefix.length + 1)}`, `${root}/${rel}`);
    else if (!prefix) files.set(`package/${rel}`, `${root}/${rel}`);
    else if (!SKIP_ROOT.has(rel.split('/')[0])) files.set(rel, `${root}/${rel}`);
  }
  const made = ['README.md', 'LICENSE', 'CHANGELOG.md'].filter((name) => ![...files.keys()].some((k) => k === name || (name === 'LICENSE' && ['LICENSE.md', 'LICENSE.txt', 'LICENCE'].includes(k))));
  const writers: Record<string, (m: Json) => string> = { 'README.md': registryReadme, LICENSE: registryLicence, 'CHANGELOG.md': registryChangelog };
  const folder = `${registryRoot()}/extensions/${m.id}`;
  fs.batch(() => {
    fs.remove(folder);
    for (const [rel, source] of [...files.entries()].sort()) fs.write(`${folder}/${rel}`, fs.read(source)!);
    for (const name of made) fs.write(`${folder}/${name}`, utf8(writers[name](m)));
  });
  const screenshot = SCREENSHOT_NAMES.find((n) => fs.isFile(`${folder}/${n}`)) ?? null;
  const checks = await ownChecks(folder, m);
  checks.note = "The registry's tools/check.py needs a local clone of the registry, which a browser page cannot run, so form.ext ran its own Check, the kit's package rules and the metadata files instead.";
  let listed: Json = null;
  try {
    listed = (await registryShelf()).extensions.find((e: Json) => e.id === m.id) ?? null;
  } catch {
    listed = null;
  }
  const record = {
    format: 'formext-registry-submission',
    format_version: 1,
    project: pid,
    id: m.id,
    version: m.version,
    folder,
    root: registryRoot(),
    files: fs.walk(folder).sort(),
    made,
    screenshot,
    screenshot_slot: 'docs/screenshot.png',
    checks,
    update: !!listed,
    published_version: listed?.version ?? null,
    commands: commands(m, folder, !!listed),
    prepared_at: now(),
  };
  writeJson(`${registryRoot()}/${m.id}.submission.json`, record);
  emit('publish.registry', { id: pid, folder, ok: checks.ok, by: checks.by });
  return record;
}

export async function revealRegistry(pid: string): Promise<Json> {
  const sub = registrySubmission(pid);
  if (!sub) throw notFound('submit to the registry first');
  return saveZip(sub.folder);
}

async function saveZip(folder: string): Promise<Json> {
  const name = String(folder).split('/').pop()!;
  const entries = fs.walk(folder).map((rel) => ({ path: `${name}/${rel}`, data: fs.read(`${folder}/${rel}`)! }));
  const zip = await writeZip(entries);
  const url = URL.createObjectURL(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.zip`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { opened: folder, demo: 'saved the folder as a zip' };
}

export function reveal(pid: string): Promise<Json> {
  return saveZip(submission(pid).folder);
}
