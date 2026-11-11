import { utf8 } from './bytes';
import { bad, notFound } from './errors';
import { PLAIN, type Json } from './kit';
import { settings } from './settings';
import { slug, workspace } from './workspace';

const RAW = import.meta.glob<string>('../../../../templates/**/*', { query: '?raw', import: 'default', eager: true });
const EXAMPLES = import.meta.glob<string>('../../../../contract/examples/**/*', { query: '?raw', import: 'default', eager: true });
const DOCS = import.meta.glob<string>('../../../../docs/apps/*.md', { query: '?raw', import: 'default', eager: true });

const HOSTS: [string, string, string][] = [
  ['formvis', 'FormVis', 'formvis'],
  ['formcut', 'FormCut', 'formcut'],
  ['formwav', 'FormWav', 'formwav'],
  ['formpdf', 'FormPDF', 'formpdf'],
  ['formdeck', 'FormDeck', 'formdeck'],
  ['formlit', 'FormLit', 'formlit'],
  ['formmd', 'Form.md', 'form.md'],
  ['formencoder', 'FormEncoder', 'formencoder'],
  ['formvfx', 'FormVFX', 'formvfx'],
  ['formmcp', 'FormMCP', 'formMCP'],
  ['formtray', 'FormTray', 'formtray'],
  ['formskills', 'FormSkills', 'formskills'],
];
const STARTERS: [string, string, string][] = [
  ['panel', 'Panel', 'A panel that reads the open document, follows its events and changes it.'],
  ['command', 'Command', 'A command that runs without a panel, changes the document in one step and finishes.'],
  ['panel-commands', 'Panel with commands', 'A panel, a command that opens it, and a headless command that shares its code.'],
];
const NAMES = Object.fromEntries(HOSTS.map(([p, n]) => [p, n]));
const NAMED = ['.html', '.htm', '.md'];
const MAX_NAME = 64;

function tree(source: Record<string, string>, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(source)) {
    const at = k.indexOf(prefix);
    if (at >= 0) out.set(k.slice(at + prefix.length), v);
  }
  return out;
}

const templates = tree(RAW, '/templates/');
const examplesTree = tree(EXAMPLES, '/contract/examples/');

function folder(product: string, starter: string): Map<string, string> {
  if (!(product in NAMES)) throw notFound(`no templates for ${product}`);
  if (!STARTERS.some(([s]) => s === starter)) throw notFound(`no starter named ${starter}`);
  const prefix = `${product}/${starter}/`;
  const out = new Map<string, string>();
  for (const [k, v] of templates) if (k.startsWith(prefix)) out.set(k.slice(prefix.length), v);
  if (!out.has('manifest.json')) throw notFound(`the ${starter} starter for ${product} is missing`);
  return out;
}

function json(t: string | undefined): Json {
  try {
    const d = JSON.parse(t ?? '');
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  } catch {
    return {};
  }
}

function files(product: string, starter: string): Map<string, string> {
  const out = new Map<string, string>();
  const src = folder(product, starter);
  for (const rel of [...src.keys()].sort()) if (rel !== 'template.json' && !rel.startsWith('.') && !rel.includes('/.')) out.set(rel, src.get(rel)!);
  for (const [k, v] of [...templates].sort()) if (k.startsWith('_shared/')) out.set(k.slice('_shared/'.length), v);
  return out;
}

function docs(product: string): string | null {
  return Object.keys(DOCS).some((k) => k.endsWith(`/${product}.md`)) ? `docs/apps/${product}.md` : null;
}

function summary(product: string, starter: string, title: string, blurb: string): Json {
  const f = folder(product, starter);
  const meta = json(f.get('template.json'));
  const manifest = json(f.get('manifest.json'));
  const contributes = manifest.contributes && typeof manifest.contributes === 'object' ? manifest.contributes : {};
  return {
    product,
    starter,
    title: meta.title || title,
    name: meta.name || manifest.name || '',
    summary: meta.summary || blurb,
    uses: meta.uses || [],
    description: manifest.description ?? '',
    permissions: manifest.permissions ?? [],
    panels: contributes.panels ?? [],
    commands: contributes.commands ?? [],
    id: manifest.id ?? '',
  };
}

export function catalogue(): Json {
  return {
    starters: STARTERS.map(([id, title, s]) => ({ id, title, summary: s })),
    products: HOSTS.map(([id, name, repo]) => ({
      id,
      name,
      repo,
      docs: docs(id),
      starters: STARTERS.flatMap(([s, t, b]) => {
        try {
          return [summary(id, s, t, b)];
        } catch {
          return [];
        }
      }),
    })),
    examples: examples(),
  };
}

export function detail(product: string, starter: string): Json {
  const [, title, blurb] = STARTERS.find(([s]) => s === starter) ?? ['', '', ''];
  const info = summary(product, starter, title, blurb);
  info.files = [...files(product, starter)].map(([path, t]) => ({ path, size: utf8(t).length, text: t }));
  info.product_name = NAMES[product];
  info.docs = docs(product);
  return info;
}

function cleanName(name: string): string {
  const n = String(name ?? '').split(/\s+/).filter(Boolean).join(' ');
  if (!n) throw bad('a project needs a name');
  if (n.length > MAX_NAME) throw bad(`the name is longer than ${MAX_NAME} characters`);
  return n;
}

function readme(product: string, name: string, info: Json): string {
  const perms: string[] = (info.permissions || []).filter((p: unknown) => typeof p === 'string');
  const lines = [
    `# ${name}`,
    '',
    info.description || info.summary || '',
    '',
    `Made with form.ext from the ${String(info.title).toLowerCase()} starter for ${NAMES[product]}.`,
    '',
    '## Files',
    '',
    '- `package/` is the extension itself, what `.formpkg` holds: `manifest.json` and `ui/`.',
    "- `package/ui/app.js` is the extension's code; `formext.js` is the contract's client and `kit.js` small helpers.",
    '',
    '## What it uses',
    '',
    ...(info.uses || []).map((u: string) => `- \`${u}\``),
    '',
    '## Permissions',
    '',
    ...(perms.length ? perms.map((p) => `- \`${p}\`: ${PLAIN[p] ?? p}. Why: say here what the extension does with it.`) : ['- None: it asks for no permission.']),
    '',
    '## Screenshot',
    '',
    `![${name} in ${NAMES[product]}](docs/screenshot.png)`,
    '',
    'Save a picture of the extension running in the app as `docs/screenshot.png`; the registry asks for it.',
    '',
    '## Next',
    '',
    'Open Preview to run it against a simulated app, Check before you package, and Run in App to load it in the real app.',
    `The ${NAMES[product]} extension API is in Docs.`,
    '',
  ];
  return lines.join('\n');
}

function render(product: string, starter: string, name: string, pid: string, description?: string | null): Record<string, Uint8Array> {
  const f = folder(product, starter);
  const meta = json(f.get('template.json'));
  const info = summary(product, starter, meta.title ?? '', '');
  const original = info.name;
  const src = files(product, starter);
  const manifest = JSON.parse(src.get('manifest.json')!);
  manifest.id = pid;
  manifest.name = name;
  manifest.author = settings.value('author') || manifest.author || 'me';
  manifest.licence = settings.value('licence') || manifest.licence || 'Apache-2.0';
  if (description) manifest.description = description.trim().slice(0, 400);
  const contributes = manifest.contributes || {};
  for (const key of ['panels', 'commands']) for (const item of contributes[key] || []) if (item && item.title === original) item.title = name;
  const out: Record<string, Uint8Array> = {};
  for (const [rel, data] of src) {
    let t = data;
    if (rel === 'manifest.json') t = `${JSON.stringify(manifest, null, 2)}\n`;
    else if (original && NAMED.some((s) => rel.toLowerCase().endsWith(s))) t = t.split(original).join(name);
    out[`package/${rel}`] = utf8(t);
  }
  if (description) info.description = description;
  out['README.md'] = utf8(readme(product, name, info));
  return out;
}

export function create(product: string, starter: string, name: string, description?: string | null): Json {
  name = cleanName(name);
  folder(product, starter);
  const guess = slug(name);
  const taken = workspace.exists(guess);
  let project = workspace.create(name, product, render(product, starter, name, guess, description));
  const pid = project.id;
  if (taken || pid !== guess) {
    const rel = `${project.package_prefix || 'package'}/manifest.json`;
    const m = JSON.parse(new TextDecoder().decode(workspace.read(pid, rel)));
    m.id = pid;
    workspace.write(pid, rel, utf8(`${JSON.stringify(m, null, 2)}\n`));
    project = workspace.get(pid);
  }
  project.template = { product, starter };
  return project;
}

export function examples(): Json[] {
  const ids = [...new Set([...examplesTree.keys()].map((k) => k.split('/')[0]))].sort();
  return ids.flatMap((id) => {
    const m = json(examplesTree.get(`${id}/manifest.json`));
    if (!Object.keys(m).length) return [];
    return [{ id, name: m.name || id, product: m.product ?? '', description: m.description ?? '', permissions: m.permissions ?? [] }];
  });
}

export function exampleFiles(example: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of examplesTree) if (k.startsWith(`${example}/`)) out.set(k.slice(example.length + 1), v);
  return out;
}

export function createExample(example: string, name?: string | null): Json {
  const src = exampleFiles(example);
  if (!src.has('manifest.json')) throw notFound(`no example named ${example}`);
  const manifest = json(src.get('manifest.json'));
  const title = cleanName(name || manifest.name || example);
  const out: Record<string, Uint8Array> = {};
  for (const [rel, t] of [...src].sort()) out[`package/${rel}`] = utf8(t);
  const guess = slug(title);
  manifest.id = guess;
  manifest.name = title;
  out['package/manifest.json'] = utf8(`${JSON.stringify(manifest, null, 2)}\n`);
  let project = workspace.create(title, manifest.product || 'formvis', out);
  if (project.id !== guess) {
    manifest.id = project.id;
    workspace.write(project.id, 'package/manifest.json', utf8(`${JSON.stringify(manifest, null, 2)}\n`));
    project = workspace.get(project.id);
  }
  project.example = example;
  return project;
}
