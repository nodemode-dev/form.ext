import { emit } from '../../../frontend/src/shell/events';
import { now, shaHex } from './bytes';
import { bad, notFound, refused } from './errors';
import * as kit from './kit';
import type { Folder, Json } from './kit';
import { checkSignature, keys } from './keys';
import { validateFolder } from './validate';
import * as fs from './vfs';
import { dataDir, readJson, workspace, writeJson } from './workspace';
import { readEntry, readInfos } from './zip';

const SHA_RE = /^[0-9a-f]{64}$/;
const RECORD = 'build.json';
const CONTRACT_RULES = new Set(['json', 'package', 'schema', 'host', 'missing-entry']);
export const DEFAULT_URL = (id: string, version: string) => `https://formai.studio/extensions/packages/${id}-${version}.formpkg`;

export async function entriesOf(data: Uint8Array): Promise<Json[]> {
  const out: Json[] = [];
  for (const i of readInfos(data)) out.push({ path: i.filename, size: i.file_size, packed: i.compress_size, sha256: await shaHex(await readEntry(data, i)) });
  return out;
}

async function kitBuild(folder: Folder) {
  try {
    return await kit.build(folder);
  } catch (e) {
    if (e instanceof kit.KitRefused) throw refused(e.message);
    throw e;
  }
}

class Packages {
  root(pid: string): string {
    if (typeof pid !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(pid)) throw notFound('no such project');
    return `${dataDir('builds')}/${pid}`;
  }

  dir(pid: string, sha: string): string {
    if (typeof sha !== 'string' || !SHA_RE.test(sha)) throw notFound('no such build');
    const folder = `${this.root(pid)}/${sha}`;
    if (!fs.isFile(`${folder}/${RECORD}`)) throw notFound(`no build ${sha.slice(0, 12)} of ${pid}`);
    return folder;
  }

  private read(folder: string): Json {
    return readJson(`${folder}/${RECORD}`);
  }

  private publicOf(folder: string, record: Json): Json {
    return { ...record, path: `${folder}/${record.file}` };
  }

  get(pid: string, sha: string): Json {
    const folder = this.dir(pid, sha);
    return this.publicOf(folder, this.read(folder));
  }

  file(pid: string, sha: string): { path: string; name: string; data: Uint8Array } {
    const folder = this.dir(pid, sha);
    const record = this.read(folder);
    const data = fs.read(`${folder}/${record.file}`);
    if (!data) throw notFound('the package file of this build is gone');
    return { path: `${folder}/${record.file}`, name: record.file, data };
  }

  list(pid: string): Json[] {
    const root = this.root(pid);
    const out: Json[] = [];
    for (const name of fs.children(root)) {
      if (!SHA_RE.test(name) || !fs.isFile(`${root}/${name}/${RECORD}`)) continue;
      const r = this.read(`${root}/${name}`);
      if (r) out.push(this.publicOf(`${root}/${name}`, r));
    }
    return out.sort((a, b) => (b.last_built_at ?? 0) - (a.last_built_at ?? 0));
  }

  check(pid: string): Promise<Json> {
    return validateFolder(workspace.folder(pid), workspace.packagePrefix(pid));
  }

  async build(pid: string, anyway = false): Promise<Json> {
    const folder = workspace.folder(pid);
    const result = await this.check(pid);
    const counts = result.counts;
    const errors = result.problems.filter((p: Json) => p.severity === 'error');
    const blocking = errors.filter((p: Json) => CONTRACT_RULES.has(p.rule));
    if (blocking.length) {
      const n = blocking.length;
      throw refused(`${n} contract error${n !== 1 ? 's' : ''}: every host would refuse this package. Fix ${n !== 1 ? 'them' : 'it'} first (Check lists where).`, { check: result });
    }
    if (errors.length && !anyway) {
      const n = errors.length;
      throw refused(`Check found ${n} code error${n !== 1 ? 's' : ''} (parts of the extension may not run). Fix ${n !== 1 ? 'them' : 'it'}, or package anyway.`, { check: result });
    }
    const built = await kitBuild(folder);
    const final = `${this.root(pid)}/${built.sha256}`;
    const at = now();
    let record: Json;
    let fresh: boolean;
    if (fs.isFile(`${final}/${RECORD}`)) {
      record = this.read(final);
      record.last_built_at = at;
      record.times_built = Number(record.times_built ?? 1) + 1;
      record.check = counts;
      fresh = false;
    } else {
      fs.remove(final);
      fs.write(`${final}/${built.file}`, built.data);
      const m = built.manifest;
      record = {
        format: 'formext-build',
        format_version: 1,
        sha256: built.sha256,
        bytes: built.bytes,
        file: built.file,
        project: pid,
        id: m.id,
        name: m.name,
        product: m.product,
        version: m.version,
        manifest: m,
        entries: await entriesOf(built.data),
        built_at: at,
        last_built_at: at,
        times_built: 1,
        check: counts,
        signatures: [],
      };
      fresh = true;
    }
    writeJson(`${final}/${RECORD}`, record);
    const out = this.publicOf(final, record);
    out.fresh = fresh;
    out.warnings = result.problems.filter((p: Json) => p.severity === 'warning' || p.severity === 'error');
    out.anyway = errors.length > 0;
    emit('package.built', { id: pid, sha256: built.sha256, bytes: built.bytes, fresh, version: record.version });
    return out;
  }

  async reproduce(pid: string): Promise<Json> {
    const folder = workspace.folder(pid);
    const started = now();
    const t0 = performance.now();
    const a = await kitBuild(folder);
    const b = await kitBuild(workspace.folder(pid));
    const runs = [
      { how: 'engine in this page (formpkg rules)', sha256: a.sha256, bytes: a.bytes },
      { how: 'second build in this page, from a fresh read of the files', sha256: b.sha256, bytes: b.bytes },
    ];
    const same = runs.every((r) => r.sha256 === a.sha256 && r.bytes === a.bytes);
    const differences: Json[] = [];
    const entries = await entriesOf(a.data);
    if (!same) {
      const left = new Map(entries.map((e) => [e.path, e]));
      const right = new Map((await entriesOf(b.data)).map((e) => [e.path, e]));
      for (const name of [...new Set([...left.keys(), ...right.keys()])].sort()) if (left.get(name)?.sha256 !== right.get(name)?.sha256) differences.push({ path: name, first: left.get(name)?.sha256 ?? null, second: right.get(name)?.sha256 ?? null });
      if (!differences.length) differences.push({ path: '(zip headers)', first: a.sha256, second: b.sha256 });
    }
    const builds = this.list(pid).filter((x) => x.version === a.manifest.version);
    const stored = builds.find((x) => x.sha256 === a.sha256);
    const latest = builds[0];
    if (stored) {
      const bf = this.dir(pid, a.sha256);
      const r = this.read(bf);
      r.reproduced_at = started;
      writeJson(`${bf}/${RECORD}`, r);
    }
    emit('package.reproduced', { id: pid, reproducible: same, sha256: a.sha256 });
    return { project: pid, reproducible: same, sha256: a.sha256, bytes: a.bytes, version: a.manifest.version, runs, differences, entries, matches_build: stored?.sha256 ?? null, latest_build: latest?.sha256 ?? null, source_changed: Boolean(latest && latest.sha256 !== a.sha256), checked_at: started, ms: Math.round(performance.now() - t0) };
  }

  remove(pid: string, sha: string): Json {
    fs.remove(this.dir(pid, sha));
    emit('package.removed', { id: pid, sha256: sha });
    return { project: pid, sha256: sha, removed: true };
  }

  async sign(pid: string, sha: string, kid: string, passphrase = ''): Promise<Json> {
    const target = this.file(pid, sha);
    if ((await shaHex(target.data)) !== sha) throw refused('the package file no longer matches its SHA-256; build it again');
    const block = await keys.sign(kid, target.data, passphrase);
    const publisher = (await keys.export(kid)).publisher;
    const signedBy = await checkSignature(target.data, block, [publisher]);
    const folder = this.dir(pid, sha);
    const record = this.read(folder);
    const sigs = (record.signatures ?? []).filter((s: Json) => s.publisher !== block.publisher);
    sigs.push({ ...block, signed_at: now(), fingerprint: (await keys.get(kid)).fingerprint });
    record.signatures = sigs;
    writeJson(`${folder}/${RECORD}`, record);
    emit('package.signed', { id: pid, sha256: sha, publisher: signedBy });
    return { project: pid, sha256: sha, signature: block, publisher, verified: true, entry: (await this.entry(pid, sha, '', kid)).entry };
  }

  private async publishers(record: Json, extra: Json[] = []): Promise<Json[]> {
    const found = [...extra];
    for (const s of record.signatures ?? []) {
      if (found.some((p) => p.id === s.publisher)) continue;
      try {
        found.push((await keys.export(s.publisher)).publisher);
      } catch {
        continue;
      }
    }
    return found;
  }

  async verify(pid: string, sha: string, publishers?: Json[]): Promise<Json> {
    const target = this.file(pid, sha);
    const record = this.read(this.dir(pid, sha));
    const listed = await this.publishers(record, publishers ?? []);
    const results: Json[] = [];
    for (const s of record.signatures ?? []) {
      try {
        results.push({ publisher: await checkSignature(target.data, { publisher: s.publisher, algorithm: s.algorithm, value: s.value }, listed), ok: true, reason: '' });
      } catch (e) {
        results.push({ publisher: s.publisher, ok: false, reason: (e as Error).message });
      }
    }
    return { project: pid, sha256: sha, signed: results.length > 0, ok: results.length > 0 && results.every((r) => r.ok), results };
  }

  async entry(pid: string, sha: string, url = '', publisher = ''): Promise<Json> {
    const record = this.read(this.dir(pid, sha));
    const m = record.manifest;
    const address = (url || '').trim() || DEFAULT_URL(m.id, m.version);
    if (!address.startsWith('https://')) throw bad('The package address in the index must start with https://.');
    const e = kit.entry(m, address, record.sha256, record.bytes);
    const sigs: Json[] = record.signatures ?? [];
    const chosen = publisher ? sigs.find((s) => s.publisher === publisher) : sigs[sigs.length - 1];
    if (publisher && !chosen) throw notFound(`this build is not signed by ${publisher}`);
    const publishers: Json[] = [];
    if (chosen) {
      e.signature = { publisher: chosen.publisher, algorithm: chosen.algorithm, value: chosen.value };
      try {
        publishers.push((await keys.export(chosen.publisher)).publisher);
      } catch {
        publishers.length = 0;
      }
    }
    return { project: pid, sha256: record.sha256, entry: e, publishers, url_default: !(url || '').trim() };
  }
}

export const packages = new Packages();
