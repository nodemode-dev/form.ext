import { fromB64, strictText, toB64, utf8 } from './bytes';
import { bad, HttpError, notFound } from './errors';
import type { Json } from './kit';
import { keys } from './keys';
import * as library from './library';
import { packages } from './package';
import * as portal from './portal';
import * as preview from './preview';
import * as publish from './publish';
import { settings } from './settings';
import * as templates from './templates';
import { RULES, validateProject } from './validate';
import { DATA, cleanRel, workspace } from './workspace';

const TEXT_TYPES = new Set(['.html', '.js', '.mjs', '.ts', '.css', '.json', '.svg', '.txt', '.md', '.cube', '.py', '.toml', '.yml', '.yaml', '.xml', '.csv', '.gitignore', '.sh']);

export interface Req {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export interface Res {
  status: number;
  body: unknown;
}

type Handler = (m: RegExpMatchArray, r: Req) => unknown;

const routes: [string, RegExp, Handler][] = [];
const on = (method: string, pattern: string, fn: Handler) => routes.push([method, new RegExp(`^${pattern}$`), fn]);
const seg = '([^/]+)';
const d = decodeURIComponent;

function json(r: Req): Json {
  const b = r.body;
  if (b && typeof b === 'object' && !(b instanceof Blob) && !(b instanceof ArrayBuffer) && !ArrayBuffer.isView(b) && !(b instanceof FormData)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

async function raw(r: Req): Promise<Uint8Array | null> {
  const b = r.body;
  if (b instanceof Blob) return new Uint8Array(await b.arrayBuffer());
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  if (typeof b === 'string') return utf8(b);
  return null;
}

const flag = (v: unknown) => ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

function isText(rel: string, data: Uint8Array): boolean {
  const name = rel.split('/').pop() ?? '';
  const s = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
  if (TEXT_TYPES.has(s) || ['LICENSE', 'README', 'NOTICE'].includes(name)) return strictText(data) !== null;
  if (data.subarray(0, 8192).includes(0)) return false;
  return strictText(data) !== null && data.length < 2 * 1024 * 1024;
}

function decodeFiles(rawFiles: Json): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [rel, v] of Object.entries(rawFiles ?? {})) {
    if (typeof v === 'string') out[rel] = utf8(v);
    else if (v && typeof v === 'object' && 'base64' in (v as Json)) out[rel] = fromB64((v as Json).base64);
    else if (v && typeof v === 'object' && 'text' in (v as Json)) out[rel] = utf8(String((v as Json).text));
    else throw bad(`file ${rel} needs text or base64`);
  }
  return out;
}

on('GET', '/api/health', () => ({ ok: true, app: 'formext', version: '0.4.1 in this page', api: '1', pid: 0, python: null, frozen: false, home: DATA, contract: 'bundled', uptime: Math.round(performance.now() / 100) / 10, live_clients: 0, routers: ['health', 'settings', 'projects', 'live', 'library', 'package', 'preview', 'publish', 'runapp', 'templates', 'validate'], router_errors: {}, frontend: 'demo', demo: true }));
on('GET', '/api/settings', () => ({ ...settings.get(), home: DATA }));
on('PUT', '/api/settings', (_m, r) => {
  const patch = { ...json(r) };
  delete patch.home;
  return { ...settings.update(patch), home: DATA };
});

on('GET', '/api/projects', () => ({ projects: workspace.projects() }));
on('GET', '/api/projects/recent', (_m, r) => ({ projects: workspace.recent(Number(r.query.get('limit') ?? 12)) }));
on('POST', '/api/projects', (_m, r) => {
  const b = json(r);
  if (b.import || b.path) return workspace.importFolder(b.import || b.path, Boolean(b.link), b.name);
  return workspace.create(b.name ?? '', b.product ?? '', decodeFiles(b.files));
});
on('POST', '/api/projects/import', (_m, r) => {
  const b = json(r);
  return workspace.importFolder(b.path ?? '', Boolean(b.link), b.name);
});
on('GET', `/api/projects/${seg}`, (m, r) => {
  const p = workspace.get(d(m[1]));
  if (r.query.get('touch') !== 'false') workspace.touch(p.id);
  return p;
});
on('DELETE', `/api/projects/${seg}`, (m) => workspace.remove(d(m[1])));
on('GET', `/api/projects/${seg}/files`, (m) => ({ id: d(m[1]), package_prefix: workspace.packagePrefix(d(m[1])), files: workspace.listFiles(d(m[1])) }));
on('POST', `/api/projects/${seg}/move`, (m, r) => {
  const b = json(r);
  return workspace.move(d(m[1]), b.from ?? '', b.to ?? '');
});
on('GET', `/api/projects/${seg}/files/(.+)`, (m, r) => {
  const pid = d(m[1]);
  const clean = cleanRel(m[2].split('/').map(d).join('/'));
  const data = workspace.read(pid, clean);
  if (r.query.get('raw')) return { __raw: data };
  const info: Json = { path: clean, size: data.length, modified: workspace.mtime(pid, clean) };
  if (isText(clean, data)) Object.assign(info, { encoding: 'utf-8', text: strictText(data) });
  else Object.assign(info, { encoding: 'base64', base64: toB64(data) });
  return info;
});
on('PUT', `/api/projects/${seg}/files/(.+)`, async (m, r) => {
  const rel = m[2].split('/').map(d).join('/');
  let data: Uint8Array;
  if (r.query.get('raw')) data = (await raw(r)) ?? new Uint8Array();
  else {
    const b = json(r);
    if ('text' in b) data = utf8(String(b.text));
    else if ('base64' in b) data = fromB64(b.base64);
    else throw bad('send JSON with text or base64, or use ?raw=1');
  }
  return workspace.write(d(m[1]), rel, data);
});
on('DELETE', `/api/projects/${seg}/files/(.+)`, (m) => workspace.delete(d(m[1]), m[2].split('/').map(d).join('/')));

on('GET', '/api/templates', () => templates.catalogue());
on('GET', '/api/templates/examples', () => ({ examples: templates.examples() }));
on('POST', `/api/templates/examples/${seg}`, (m, r) => templates.createExample(d(m[1]), json(r).name));
on('POST', '/api/templates/create', (_m, r) => {
  const b = json(r);
  return templates.create(String(b.product ?? ''), String(b.starter ?? ''), String(b.name ?? ''), b.description);
});
on('GET', `/api/templates/${seg}/${seg}`, (m) => templates.detail(d(m[1]), d(m[2])));

on('POST', `/api/projects/${seg}/validate`, (m) => {
  const pid = d(m[1]);
  return validateProject(pid, workspace.folder(pid), workspace.packagePrefix(pid));
});
on('GET', '/api/validate/rules', () => ({ rules: RULES }));

on('GET', `/api/preview/${seg}`, (m, r) => preview.record(d(m[1]), r.query.get('product'), r.query.get('app'), r.query.get('app_version')));
on('POST', '/api/preview/fetch', () => preview.fetchRelay());

on('POST', `/api/projects/${seg}/package`, (m, r) => packages.build(d(m[1]), Boolean(json(r).anyway)));
on('POST', `/api/projects/${seg}/package/reproduce`, (m) => packages.reproduce(d(m[1])));
on('GET', `/api/projects/${seg}/builds`, (m) => ({ project: d(m[1]), builds: packages.list(d(m[1])) }));
on('GET', `/api/projects/${seg}/builds/${seg}`, (m) => packages.get(d(m[1]), d(m[2])));
on('GET', `/api/projects/${seg}/builds/${seg}/file`, (m) => ({ __raw: packages.file(d(m[1]), d(m[2])).data, __name: packages.file(d(m[1]), d(m[2])).name }));
on('DELETE', `/api/projects/${seg}/builds/${seg}`, (m) => packages.remove(d(m[1]), d(m[2])));
on('POST', `/api/projects/${seg}/builds/${seg}/sign`, (m, r) => {
  const b = json(r);
  return packages.sign(d(m[1]), d(m[2]), String(b.key ?? ''), String(b.passphrase || ''));
});
on('POST', `/api/projects/${seg}/builds/${seg}/verify`, (m, r) => {
  const b = json(r);
  return packages.verify(d(m[1]), d(m[2]), Array.isArray(b.publishers) ? b.publishers : undefined);
});
on('GET', `/api/projects/${seg}/builds/${seg}/entry`, (m, r) => packages.entry(d(m[1]), d(m[2]), r.query.get('url') ?? '', r.query.get('publisher') ?? ''));
on('GET', '/api/keys', async () => ({ keys: await keys.list() }));
on('POST', '/api/keys', (_m, r) => {
  const b = json(r);
  return keys.create(String(b.id ?? ''), String(b.name ?? ''), String(b.url || ''), String(b.passphrase || ''));
});
on('GET', `/api/keys/${seg}`, (m) => keys.get(d(m[1])));
on('GET', `/api/keys/${seg}/public`, (m) => keys.export(d(m[1])));
on('DELETE', `/api/keys/${seg}`, (m) => keys.remove(d(m[1])));

on('GET', '/api/runapp', () => portal.overview());
on('GET', '/api/runapp/root', () => portal.root());
on('GET', `/api/runapp/projects/${seg}`, (m) => portal.projectStatus(d(m[1])));
on('POST', `/api/runapp/projects/${seg}`, (m) => portal.runProject(d(m[1])));
on('DELETE', `/api/runapp/projects/${seg}`, (m) => portal.stopProject(d(m[1])));
on('POST', `/api/runapp/projects/${seg}/install`, async (m) => {
  const build = await packages.build(d(m[1]));
  const f = packages.file(d(m[1]), build.sha256);
  return { ...(await portal.send(f.path, f.data)), sha256: build.sha256, bytes: build.bytes };
});
on('POST', '/api/runapp/send', () => {
  throw notFound('the demo sends packages from its own builds only; use Install in FormPortal or Send to FormPortal');
});
on('GET', `/api/runapp/apps/${seg}/dev`, (m) => portal.readDev(d(m[1])));
on('PUT', `/api/runapp/apps/${seg}/dev`, (m, r) => portal.writeDev(d(m[1]), json(r)));
on('DELETE', `/api/runapp/apps/${seg}/dev/${seg}`, (m) => portal.devRemove(d(m[1]), d(m[2])));
on('POST', `/api/runapp/apps/${seg}/reload`, (m) => portal.reload(d(m[1])));
on('POST', `/api/runapp/apps/${seg}/open`, (m, r) => portal.openApp(d(m[1]), String(json(r).channel || '')));
on('POST', `/api/runapp/apps/${seg}/manage`, (m) => portal.manage(d(m[1])));

on('GET', `/api/publish/${seg}`, (m) => publish.status(d(m[1])));
on('POST', `/api/publish/${seg}`, (m, r) => {
  const b = json(r);
  return publish.prepare(d(m[1]), String(b.url || ''), String(b.publisher || ''), String(b.passphrase || ''), b.sign !== false);
});
on('POST', `/api/publish/${seg}/send`, (m) => publish.send(d(m[1])));
on('POST', `/api/publish/${seg}/reveal`, (m) => publish.reveal(d(m[1])));
on('POST', `/api/publish/${seg}/registry`, (m) => publish.submit(d(m[1])));
on('POST', `/api/publish/${seg}/registry/reveal`, (m) => publish.revealRegistry(d(m[1])));
on('GET', `/api/publish/${seg}/registry/pull-request`, () => publish.pullRequestReady());
on('POST', `/api/publish/${seg}/registry/pull-request`, () => publish.pullRequest());

on('GET', '/api/library/registry', () => library.registryShelf());
on('GET', `/api/library/registry/${seg}`, (m) => library.inspectRegistry(d(m[1])));
on('POST', `/api/library/registry/${seg}/import`, (m, r) => {
  const b = json(r);
  return library.importRegistry(d(m[1]), b.name ?? null, flag(b.anyway));
});
on('POST', '/api/library/inspect', async (_m, r) => {
  const data = await raw(r);
  if (!data) return library.inspectPath(String(json(r).path ?? ''));
  if (!data.length) throw bad('the upload is empty');
  const out = await library.inspectBytes(data, r.query.get('name') ?? '');
  out.source = { kind: 'upload', name: r.query.get('name') || null };
  return out;
});
on('POST', '/api/library/import', async (_m, r) => {
  const data = await raw(r);
  if (!data) {
    const b = json(r);
    return library.inspectPath(String(b.path ?? ''));
  }
  if (!data.length) throw bad('the upload is empty');
  const name = r.query.get('name') ?? '';
  return library.importBytes(data, name, r.query.get('project') || null, { kind: 'upload', name: name || null }, flag(r.query.get('anyway')));
});
on('GET', `/api/library/builds/${seg}/${seg}`, (m) => library.inspectBuild(d(m[1]), d(m[2])));
on('POST', `/api/library/builds/${seg}/${seg}/import`, (m, r) => {
  const b = json(r);
  return library.importBuild(d(m[1]), d(m[2]), b.name ?? null, flag(b.anyway));
});
on('GET', `/api/library/compare/${seg}`, (m, r) => library.compare(d(m[1]), r.query.get('a') ?? '', r.query.get('b') ?? library.WORKING));
on('GET', `/api/library/compare/${seg}/file`, (m, r) => library.compareFile(d(m[1]), r.query.get('a') ?? '', r.query.get('b') ?? library.WORKING, r.query.get('path') ?? '', Number(r.query.get('context') ?? 3)));

export async function dispatch(req: Req): Promise<Res> {
  for (const [method, rx, fn] of routes) {
    if (method !== req.method) continue;
    const m = req.path.match(rx);
    if (!m) continue;
    try {
      return { status: 200, body: await fn(m, req) };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: e.body() };
      console.warn(e);
      return { status: 500, body: { detail: `the demo engine failed: ${(e as Error).message}` } };
    }
  }
  return { status: 404, body: { detail: 'Not Found' } };
}
