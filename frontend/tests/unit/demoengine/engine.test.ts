import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/demo/engine/templates', () => {
  const absent = () => {
    throw new Error('starter files live outside the test root');
  };
  return { catalogue: absent, detail: absent, create: absent, examples: absent, exampleFiles: absent, createExample: absent };
});
import { dispatch } from '../../../src/demo/engine/router';
import type { Res } from '../../../src/demo/engine/router';
import * as vfs from '../../../src/demo/engine/vfs';
import { crc32, deflate, inflate, readInfos, unzip, writeZip } from '../../../src/demo/engine/zip';
import { fromB64, hex, iso, plural, shaHex, strictText, toB64, utf8 } from '../../../src/demo/engine/bytes';
import { lineCounts, opcodes, splitLines } from '../../../src/demo/engine/diff';
import { cleanRel, slug } from '../../../src/demo/engine/workspace';

type Rec = Record<string, any>;

async function call(method: string, target: string, body?: unknown): Promise<Res & { body: any }> {
  const url = new URL(target, 'http://engine.invalid');
  return (await dispatch({ method, path: url.pathname, query: url.searchParams, body })) as Res & { body: any };
}

async function make(name: string, product = 'formlit', files?: Rec): Promise<Rec> {
  const res = await call('POST', '/api/projects', { name, product, files });
  expect(res.status).toBe(200);
  return res.body as Rec;
}

beforeEach(() => {
  vfs.forget();
  localStorage.clear();
});

describe('projects', () => {
  it('a new project is listed under an id slugged from its name', async () => {
    const p = await make('My First Plugin');
    expect(p.id).toBe('my-first-plugin');
    const list = await call('GET', '/api/projects');
    expect(list.body.projects.map((x: Rec) => x.id)).toEqual(['my-first-plugin']);
  });

  it('a new project keeps its package root in package/ as the manual states', async () => {
    const p = await make('Layout Check');
    expect(p.package_prefix).toBe('package');
    expect(p.package_dir).toBe(`${p.dir}/package`);
    expect(p.dir.endsWith('/projects/layout-check')).toBe(true);
    const files = await call('GET', '/api/projects/layout-check/files');
    expect(files.body.files.map((f: Rec) => f.path)).toEqual(['package/manifest.json']);
  });

  it('the starter manifest carries the name, product and package format', async () => {
    const p = await make('Starter Shape', 'formcut');
    expect(p.manifest.format).toBe('formai-package');
    expect(p.manifest.name).toBe('Starter Shape');
    expect(p.manifest.product).toBe('formcut');
    expect(p.manifest.id).toBe('starter-shape');
    expect(p.manifest_error).toBeNull();
  });

  it('two projects with the same name get different ids', async () => {
    const a = await make('Twin');
    const b = await make('Twin');
    expect(a.id).toBe('twin');
    expect(b.id).toBe('twin-2');
  });

  it('a project without a name is refused with a message', async () => {
    const res = await call('POST', '/api/projects', { name: '   ', product: 'formlit' });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('a project needs a name');
  });

  it('a project for an unknown product is refused and nothing is created', async () => {
    const res = await call('POST', '/api/projects', { name: 'Nope', product: 'formnothing' });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('unknown product: formnothing');
    expect((await call('GET', '/api/projects')).body.projects).toEqual([]);
  });

  it('files sent at creation are placed under package/ and read back unchanged', async () => {
    await make('With Files', 'formlit', { 'ui/index.html': '<p>hi</p>', 'data.bin': { base64: 'AAEC/w==' } });
    const html = await call('GET', '/api/projects/with-files/files/package/ui/index.html');
    expect(html.body.text).toBe('<p>hi</p>');
    const bin = await call('GET', '/api/projects/with-files/files/package/data.bin');
    expect(bin.body.encoding).toBe('base64');
    expect(bin.body.base64).toBe('AAEC/w==');
    expect(bin.body.size).toBe(4);
  });

  it('a creation file that is neither text nor base64 is refused by name', async () => {
    const res = await call('POST', '/api/projects', { name: 'Bad File', product: 'formlit', files: { 'a.txt': 5 } });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('file a.txt needs text or base64');
  });

  it('opening an unknown project answers 404 with its id', async () => {
    const res = await call('GET', '/api/projects/ghost-project');
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('no such project: ghost-project');
  });

  it('an id that is not a legal project id is not found', async () => {
    const res = await call('GET', '/api/projects/Not%20Legal');
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('no such project');
  });

  it('opening a project puts it first in the recent list', async () => {
    await make('Alpha One');
    await make('Beta Two');
    await call('GET', '/api/projects/alpha-one');
    const recent = await call('GET', '/api/projects/recent');
    expect(recent.body.projects.map((p: Rec) => p.id)).toEqual(['alpha-one', 'beta-two']);
  });

  it('opening with touch=false leaves the recent order alone', async () => {
    await make('Alpha One');
    await make('Beta Two');
    await call('GET', '/api/projects/alpha-one?touch=false');
    const recent = await call('GET', '/api/projects/recent');
    expect(recent.body.projects.map((p: Rec) => p.id)).toEqual(['beta-two', 'alpha-one']);
  });

  it('the recent list honours its limit', async () => {
    await make('Alpha One');
    await make('Beta Two');
    await make('Gamma Three');
    const recent = await call('GET', '/api/projects/recent?limit=2');
    expect(recent.body.projects.map((p: Rec) => p.id)).toEqual(['gamma-three', 'beta-two']);
  });

  it('removing a project moves it to the trash and it is no longer listed or openable', async () => {
    await make('Short Lived');
    const res = await call('DELETE', '/api/projects/short-lived');
    expect(res.body.removed).toBe('trash');
    expect(res.body.dir).toContain('/trash/short-lived-');
    expect(vfs.isFile(`${res.body.dir}/package/manifest.json`)).toBe(true);
    expect((await call('GET', '/api/projects')).body.projects).toEqual([]);
    expect((await call('GET', '/api/projects/recent')).body.projects).toEqual([]);
    expect((await call('GET', '/api/projects/short-lived')).status).toBe(404);
  });

  it('removing an unknown project is refused', async () => {
    const res = await call('DELETE', '/api/projects/ghost-project');
    expect(res.status).toBe(404);
  });
});

describe('folders opened in place', () => {
  function folder(): string {
    const dir = `${vfs.HOME}/Work/ext-one`;
    vfs.write(`${dir}/manifest.json`, utf8(JSON.stringify({ id: 'ext-one', name: 'Ext One', product: 'formpdf', version: '1.2.3' })));
    vfs.write(`${dir}/main.js`, utf8('export {};\n'));
    return dir;
  }

  it('a linked folder is listed with its manifest values and no package prefix', async () => {
    const dir = folder();
    const res = await call('POST', '/api/projects/import', { path: dir, link: true });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ext-one');
    expect(res.body.linked).toBe(true);
    expect(res.body.dir).toBe(dir);
    expect(res.body.package_prefix).toBe('');
    expect(res.body.version).toBe('1.2.3');
    expect(res.body.product).toBe('formpdf');
  });

  it('forgetting a linked folder leaves the folder itself in place', async () => {
    const dir = folder();
    await call('POST', '/api/projects/import', { path: dir, link: true });
    const res = await call('DELETE', '/api/projects/ext-one');
    expect(res.body.removed).toBe('link');
    expect(vfs.isFile(`${dir}/main.js`)).toBe(true);
    expect((await call('GET', '/api/projects')).body.projects).toEqual([]);
  });

  it('linking the same folder twice gives the same project', async () => {
    const dir = folder();
    const a = await call('POST', '/api/projects/import', { path: dir, link: true });
    const b = await call('POST', '/api/projects/import', { path: dir, link: true });
    expect(b.body.id).toBe(a.body.id);
    expect((await call('GET', '/api/projects')).body.projects).toHaveLength(1);
  });

  it('a copied import puts a bare package folder under package/ and leaves the source untouched', async () => {
    const dir = folder();
    const res = await call('POST', '/api/projects', { import: dir });
    expect(res.body.linked).toBe(false);
    expect(res.body.package_prefix).toBe('package');
    const files = await call('GET', `/api/projects/${res.body.id}/files`);
    expect(files.body.files.map((f: Rec) => f.path).sort()).toEqual(['package/main.js', 'package/manifest.json']);
    await call('PUT', `/api/projects/${res.body.id}/files/package/main.js`, { text: 'changed' });
    expect(strictText(vfs.read(`${dir}/main.js`)!)).toBe('export {};\n');
  });

  it('importing a folder without a manifest is refused', async () => {
    vfs.write(`${vfs.HOME}/Work/empty/readme.txt`, utf8('x'));
    const res = await call('POST', '/api/projects/import', { path: `${vfs.HOME}/Work/empty` });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('the folder has no manifest.json (at its root or in package/)');
  });

  it('importing a folder that does not exist answers 404 naming it', async () => {
    const res = await call('POST', '/api/projects/import', { path: '/nowhere/at/all' });
    expect(res.status).toBe(404);
    expect(res.body.detail).toContain('no such folder: /nowhere/at/all');
  });
});

describe('project files', () => {
  it('text written is read back with its byte size', async () => {
    await make('File Trip');
    const put = await call('PUT', '/api/projects/file-trip/files/package/notes.txt', { text: 'h\u00e9llo' });
    expect(put.body).toMatchObject({ path: 'package/notes.txt', size: 6 });
    const got = await call('GET', '/api/projects/file-trip/files/package/notes.txt');
    expect(got.body.encoding).toBe('utf-8');
    expect(got.body.text).toBe('h\u00e9llo');
    expect(got.body.size).toBe(6);
  });

  it('base64 bytes written are read back identical', async () => {
    await make('File Trip');
    const bytes = new Uint8Array([0, 255, 16, 0, 200, 7]);
    await call('PUT', '/api/projects/file-trip/files/package/blob.dat', { base64: toB64(bytes) });
    const got = await call('GET', '/api/projects/file-trip/files/package/blob.dat');
    expect(got.body.encoding).toBe('base64');
    expect(Array.from(fromB64(got.body.base64))).toEqual(Array.from(bytes));
  });

  it('a raw upload stores the body bytes and raw read returns them', async () => {
    await make('File Trip');
    const bytes = new Uint8Array([9, 8, 7, 0, 1]);
    await call('PUT', '/api/projects/file-trip/files/package/raw.bin?raw=1', bytes);
    const got = await call('GET', '/api/projects/file-trip/files/package/raw.bin?raw=1');
    expect(Array.from(got.body.__raw as Uint8Array)).toEqual([9, 8, 7, 0, 1]);
  });

  it('a write with neither text nor base64 is refused with the stated message', async () => {
    await make('File Trip');
    const res = await call('PUT', '/api/projects/file-trip/files/package/x.txt', { content: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('send JSON with text or base64, or use ?raw=1');
  });

  it('a path that climbs out of the project is refused on write', async () => {
    await make('File Trip');
    const res = await dispatch({ method: 'PUT', path: '/api/projects/file-trip/files/package/..%2F..%2F..%2Fescape.txt', query: new URLSearchParams(), body: { text: 'x' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ detail: 'path leaves the project' });
    expect(vfs.walk(vfs.HOME).filter((p) => p.endsWith('escape.txt'))).toEqual([]);
  });

  it('reading a file that is not there answers 404 naming the path', async () => {
    await make('File Trip');
    const res = await call('GET', '/api/projects/file-trip/files/package/missing.js');
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('no such file: package/missing.js');
  });

  it('reading a folder as a file is refused', async () => {
    await make('File Trip');
    const res = await call('GET', '/api/projects/file-trip/files/package');
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('not a file: package');
  });

  it('writing a file where a folder is answers 409', async () => {
    await make('File Trip');
    const res = await call('PUT', '/api/projects/file-trip/files/package', { text: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.detail).toBe('a folder is at package');
  });

  it('a deleted file is gone from the listing and cannot be deleted twice', async () => {
    await make('File Trip');
    await call('PUT', '/api/projects/file-trip/files/package/a.txt', { text: 'a' });
    const del = await call('DELETE', '/api/projects/file-trip/files/package/a.txt');
    expect(del.body).toEqual({ path: 'package/a.txt', deleted: true });
    const files = await call('GET', '/api/projects/file-trip/files');
    expect(files.body.files.map((f: Rec) => f.path)).toEqual(['package/manifest.json']);
    expect((await call('DELETE', '/api/projects/file-trip/files/package/a.txt')).status).toBe(404);
  });

  it('a moved file keeps its content under the new path only', async () => {
    await make('File Trip');
    await call('PUT', '/api/projects/file-trip/files/package/a.txt', { text: 'payload' });
    const mv = await call('POST', '/api/projects/file-trip/move', { from: 'package/a.txt', to: 'package/sub/b.txt' });
    expect(mv.body).toEqual({ from: 'package/a.txt', to: 'package/sub/b.txt' });
    expect((await call('GET', '/api/projects/file-trip/files/package/sub/b.txt')).body.text).toBe('payload');
    expect((await call('GET', '/api/projects/file-trip/files/package/a.txt')).status).toBe(404);
  });

  it('a move onto an existing file is refused and both files stay as they were', async () => {
    await make('File Trip');
    await call('PUT', '/api/projects/file-trip/files/package/a.txt', { text: 'A' });
    await call('PUT', '/api/projects/file-trip/files/package/b.txt', { text: 'B' });
    const mv = await call('POST', '/api/projects/file-trip/move', { from: 'package/a.txt', to: 'package/b.txt' });
    expect(mv.status).toBe(409);
    expect(mv.body.detail).toBe('package/b.txt already exists');
    expect((await call('GET', '/api/projects/file-trip/files/package/a.txt')).body.text).toBe('A');
    expect((await call('GET', '/api/projects/file-trip/files/package/b.txt')).body.text).toBe('B');
  });

  it('a move of a missing file is refused', async () => {
    await make('File Trip');
    const mv = await call('POST', '/api/projects/file-trip/move', { from: 'package/none.txt', to: 'package/b.txt' });
    expect(mv.status).toBe(404);
    expect(mv.body.detail).toBe('no such file: package/none.txt');
  });

  it('the listing marks files outside package/ as not part of the package', async () => {
    await make('File Trip');
    await call('PUT', '/api/projects/file-trip/files/NOTES.md', { text: 'n' });
    const files = await call('GET', '/api/projects/file-trip/files');
    const by = Object.fromEntries(files.body.files.map((f: Rec) => [f.path, f.package]));
    expect(by).toEqual({ 'NOTES.md': false, 'package/manifest.json': true });
  });

  it('editing the manifest changes what the project reports', async () => {
    const p = await make('File Trip');
    const next = { ...p.manifest, name: 'Renamed', version: '2.0.0' };
    await call('PUT', '/api/projects/file-trip/files/package/manifest.json', { text: JSON.stringify(next) });
    const got = await call('GET', '/api/projects/file-trip');
    expect(got.body.name).toBe('Renamed');
    expect(got.body.version).toBe('2.0.0');
  });

  it('a broken manifest is reported on the project instead of failing the open', async () => {
    await make('File Trip');
    await call('PUT', '/api/projects/file-trip/files/package/manifest.json', { text: '{ not json' });
    const got = await call('GET', '/api/projects/file-trip');
    expect(got.status).toBe(200);
    expect(got.body.manifest).toEqual({});
    expect(got.body.manifest_error).toContain('manifest.json is not valid JSON');
  });
});

describe('validation', () => {
  it('a broken manifest fails validation with a json problem on the manifest file', async () => {
    await make('Check Me');
    await call('PUT', '/api/projects/check-me/files/package/manifest.json', { text: '{ not json' });
    const res = await call('POST', '/api/projects/check-me/validate');
    expect(res.body.ok).toBe(false);
    expect(res.body.project).toBe('check-me');
    expect(res.body.counts.error).toBeGreaterThan(0);
    const first = res.body.problems[0];
    expect(first.rule).toBe('json');
    expect(first.file).toBe('package/manifest.json');
  });

  it('the error count equals the number of error problems and ok follows it', async () => {
    await make('Check Me');
    const res = await call('POST', '/api/projects/check-me/validate');
    const errors = res.body.problems.filter((p: Rec) => p.severity === 'error').length;
    expect(res.body.counts.error).toBe(errors);
    expect(res.body.ok).toBe(errors === 0);
  });

  it('every problem cites a rule that the rules route publishes', async () => {
    await make('Check Me');
    await call('PUT', '/api/projects/check-me/files/package/ui/index.html', { text: '<script>eval("1")</script><img src="https://example.com/a.png">' });
    const rules = await call('GET', '/api/validate/rules');
    const ids = new Set(rules.body.rules.map((r: Rec) => r.id));
    const res = await call('POST', '/api/projects/check-me/validate');
    expect(res.body.problems.length).toBeGreaterThan(0);
    for (const p of res.body.problems) expect(ids.has(p.rule)).toBe(true);
  });

  it('validating an unknown project answers 404', async () => {
    const res = await call('POST', '/api/projects/ghost-project/validate');
    expect(res.status).toBe(404);
    expect(res.body.detail).toBe('no such project: ghost-project');
  });
});

describe('router refusals', () => {
  it('an unknown route answers 404 Not Found', async () => {
    const res = await call('GET', '/api/does/not/exist');
    expect(res).toEqual({ status: 404, body: { detail: 'Not Found' } });
  });

  it('a known path with the wrong method is not answered', async () => {
    const res = await call('PATCH', '/api/projects');
    expect(res.status).toBe(404);
  });

  it('health names the app and says it is the demo', async () => {
    const res = await call('GET', '/api/health');
    expect(res.body.ok).toBe(true);
    expect(res.body.app).toBe('formext');
    expect(res.body.api).toBe('1');
    expect(res.body.demo).toBe(true);
  });

  it('a settings change is read back and home cannot be overwritten', async () => {
    const before = await call('GET', '/api/settings');
    const put = await call('PUT', '/api/settings', { author: 'Test Author', home: '/elsewhere' });
    expect(put.body.author).toBe('Test Author');
    expect(put.body.home).toBe(before.body.home);
    const after = await call('GET', '/api/settings');
    expect(after.body.author).toBe('Test Author');
    expect(after.body.home).toBe(before.body.home);
  });

  it('the author setting is written into the next starter manifest', async () => {
    await call('PUT', '/api/settings', { author: 'Ada Example' });
    const p = await make('Authored');
    expect(p.manifest.author).toBe('Ada Example');
  });
});

describe('path and id rules', () => {
  it('slug lowercases and joins words with single dashes', () => {
    expect(slug('  Hello,  World! ')).toBe('hello-world');
  });

  it('slug output always fits the project id rule', () => {
    for (const s of ['', 'x', '!!!', 'A'.repeat(200), 'a - b', '-- Z --']) expect(slug(s)).toMatch(/^[a-z0-9][a-z0-9-]{1,63}$/);
  });

  it('cleanRel normalises backslashes and dot segments', () => {
    expect(cleanRel('a\\b/./c.txt')).toBe('a/b/c.txt');
  });

  it('cleanRel refuses absolute, drive, parent and empty paths', () => {
    expect(() => cleanRel('/etc/passwd')).toThrow('absolute paths are not allowed');
    expect(() => cleanRel('C:\\x')).toThrow('absolute paths are not allowed');
    expect(() => cleanRel('a/../../b')).toThrow('path leaves the project');
    expect(() => cleanRel('')).toThrow('invalid path');
  });
});

describe('bytes, zip and diff helpers', () => {
  it('crc32 of the standard check string is CBF43926', () => {
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
  });

  it('sha256 of abc matches the published digest', async () => {
    expect(await shaHex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('base64 follows RFC 4648 test vectors both ways', () => {
    expect(toB64(utf8('foobar'))).toBe('Zm9vYmFy');
    expect(toB64(utf8('fo'))).toBe('Zm8=');
    expect(strictText(fromB64('Zm9vYg=='))).toBe('foob');
  });

  it('hex prints two lowercase digits per byte', () => {
    expect(hex(new Uint8Array([0, 15, 255]))).toBe('000fff');
  });

  it('strictText refuses bytes that are not UTF-8', () => {
    expect(strictText(new Uint8Array([0xff, 0xfe]))).toBeNull();
  });

  it('iso prints seconds since the epoch as a UTC time without milliseconds', () => {
    expect(iso(0)).toBe('1970-01-01T00:00:00Z');
    expect(iso(86400 + 3661)).toBe('1970-01-02T01:01:01Z');
  });

  it('plural picks the singular only for one', () => {
    expect(plural(1, 'file')).toBe('1 file');
    expect(plural(0, 'file')).toBe('0 files');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });

  it('inflate undoes deflate', async () => {
    const data = utf8('abcabcabc'.repeat(200));
    const packed = await deflate(data);
    expect(packed.length).toBeLessThan(data.length);
    expect(strictText(await inflate(packed))).toBe('abcabcabc'.repeat(200));
  });

  it('a written zip starts with the local header signature and unzips to the same files', async () => {
    const a = utf8('hello '.repeat(50));
    const b = new Uint8Array([1, 2, 3, 0, 255]);
    const zip = await writeZip([
      { path: 'a.txt', data: a },
      { path: 'dir/b.bin', data: b },
    ]);
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const back = await unzip(zip);
    expect([...back.keys()]).toEqual(['a.txt', 'dir/b.bin']);
    expect(Array.from(back.get('a.txt')!)).toEqual(Array.from(a));
    expect(Array.from(back.get('dir/b.bin')!)).toEqual(Array.from(b));
  });

  it('zip entry records carry the true size and crc of each file', async () => {
    const a = utf8('123456789');
    const zip = await writeZip([{ path: 'check.txt', data: a }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    let eocd = zip.length - 22;
    while (view.getUint32(eocd, true) !== 0x06054b50) eocd--;
    expect(view.getUint16(eocd + 10, true)).toBe(1);
    const cd = view.getUint32(eocd + 16, true);
    expect(view.getUint32(cd, true)).toBe(0x02014b50);
    expect(view.getUint32(cd + 16, true)).toBe(0xcbf43926);
    expect(view.getUint32(cd + 24, true)).toBe(9);
    expect(readInfos(zip)).toHaveLength(1);
  });

  it('bytes that are not a zip are refused', () => {
    expect(() => readInfos(utf8('this is not a zip archive at all, just text'))).toThrow();
  });

  it('diff opcodes rebuild the second text from the first', () => {
    const a = ['one', 'two', 'three', 'four', 'five'];
    const b = ['one', 'TWO', 'three', 'five', 'six'];
    const out: string[] = [];
    for (const [tag, i0, i1, j0, j1] of opcodes(a, b)) {
      if (tag === 'equal') out.push(...a.slice(i0, i1));
      else out.push(...b.slice(j0, j1));
    }
    expect(out).toEqual(b);
  });

  it('diff of identical texts adds and removes nothing', () => {
    expect(lineCounts(['a', 'b'], ['a', 'b'])).toEqual({ added: 0, removed: 0 });
  });

  it('diff counts one added and one removed line for a single changed line', () => {
    expect(lineCounts(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual({ added: 1, removed: 1 });
    expect(lineCounts(['a'], ['a', 'b', 'c'])).toEqual({ added: 2, removed: 0 });
  });

  it('splitLines treats LF, CRLF and CR as line ends and ignores a final one', () => {
    expect(splitLines('a\r\nb\n\nc\rd\n')).toEqual(['a', 'b', '', 'c', 'd']);
  });
});
