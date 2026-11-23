import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionHost, PERMISSION_WORDS } from '../../../../contract/host/host-bridge';
import type { HostHandlers, Permission } from '../../../../contract/host/host-bridge';
import { makeExt, fakeWindow, attach, ask, fromFrame, flush } from './wire';

function handlers(over: Partial<HostHandlers> = {}): HostHandlers {
  return {
    product: 'formwav',
    app: 'form.wav',
    appVersion: '9.9.9',
    locale: () => 'en-GB',
    theme: () => ({ mode: 'dark', tokens: { '--bg': '#000000' } }),
    notify: vi.fn(),
    consent: vi.fn(async () => true),
    ...over,
  };
}

async function granted(host: ExtensionHost, perms: Permission[]) {
  const ext = makeExt({ permissions: perms });
  await host.ensureConsent(ext);
  const container = document.createElement('div');
  const handle = host.mount(ext, container);
  const fake = fakeWindow();
  attach(handle, fake);
  return { ext, handle, fake, container };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('host bridge frame', () => {
  it('builds the sandboxed frame the contract describes', () => {
    const host = new ExtensionHost(handlers());
    const box = document.createElement('div');
    const h = host.mount(makeExt(), box);
    expect(h.frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(h.frame.getAttribute('allow')).toBe('');
    expect(h.frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(h.frame.getAttribute('title')).toBe('Beat Markers');
    expect(box.querySelector('iframe')).toBe(h.frame);
    h.dispose();
    expect(box.querySelector('iframe')).toBeNull();
  });

  it('answers host.hello with api 1, the extension identity and the theme', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    const reply = await ask(fake, 1, 'host.hello');
    expect(reply.formext).toBe(1);
    expect(reply.jsonrpc).toBe('2.0');
    expect(reply.result).toEqual({
      product: 'formwav',
      app: 'form.wav',
      appVersion: '9.9.9',
      api: '1',
      extension: { id: 'org.example.beats', version: '1.0.0', source: 'sideload' },
      permissions: [],
      theme: { mode: 'dark', tokens: { '--bg': '#000000' } },
      locale: 'en-GB',
    });
    handle.dispose();
  });

  it('ignores messages that do not come from the extension frame', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    fromFrame(window, { formext: 1, jsonrpc: '2.0', id: 5, method: 'host.hello', params: {} });
    fromFrame({ postMessage() {} }, { formext: 1, jsonrpc: '2.0', id: 6, method: 'host.hello', params: {} });
    await flush();
    expect(fake.sent).toEqual([]);
    handle.dispose();
  });

  it('ignores messages without the formext marker or the json-rpc version', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    fromFrame(fake.win, { jsonrpc: '2.0', id: 1, method: 'host.hello', params: {} });
    fromFrame(fake.win, { formext: 1, jsonrpc: '1.0', id: 2, method: 'host.hello', params: {} });
    await flush();
    expect(fake.sent).toEqual([]);
    handle.dispose();
  });

  it('refuses a method outside API 1 with -32601', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    const reply = await ask(fake, 3, 'shell.exec', { cmd: 'ls' });
    expect(reply.error.code).toBe(-32601);
    handle.dispose();
  });

  it('refuses document.read with -32001 when the extension did not ask for document', async () => {
    const readDocument = vi.fn(() => ({ title: 'x' }));
    const host = new ExtensionHost(handlers({ readDocument }));
    const { fake, handle } = await granted(host, ['files-read']);
    const reply = await ask(fake, 1, 'document.read');
    expect(reply.error.code).toBe(-32001);
    expect(readDocument).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('refuses a permissioned call with -32001 when consent was never given and never prompts mid-call', async () => {
    const consent = vi.fn(async () => true);
    const host = new ExtensionHost(handlers({ consent, readDocument: () => ({}) }));
    const ext = makeExt({ permissions: ['document'] });
    const handle = host.mount(ext, document.createElement('div'));
    const fake = fakeWindow();
    attach(handle, fake);
    const hello = await ask(fake, 1, 'host.hello');
    expect(hello.result.permissions).toEqual([]);
    const reply = await ask(fake, 2, 'document.read');
    expect(reply.error.code).toBe(-32001);
    expect(consent).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('hands document.read to the app once document is granted and reports the permission in hello', async () => {
    const host = new ExtensionHost(handlers({ readDocument: (_e, p) => ({ what: p.what ?? 'all', bpm: 120 }) }));
    const { fake, handle } = await granted(host, ['document']);
    expect((await ask(fake, 1, 'host.hello')).result.permissions).toEqual(['document']);
    expect((await ask(fake, 2, 'document.read', { what: 'markers' })).result).toEqual({ what: 'markers', bpm: 120 });
    handle.dispose();
  });

  it('answers -32003 for a granted method the app does not offer', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, ['network']);
    const reply = await ask(fake, 1, 'net.fetch', { url: 'https://example.org/' });
    expect(reply.error.code).toBe(-32003);
    handle.dispose();
  });

  it('refuses net.fetch to an address that is not https with -32602', async () => {
    const fetcher = vi.fn(async () => ({ status: 200, headers: {}, body: '' }));
    const host = new ExtensionHost(handlers({ fetch: fetcher }));
    const { fake, handle } = await granted(host, ['network']);
    const reply = await ask(fake, 1, 'net.fetch', { url: 'http://example.org/' });
    expect(reply.error.code).toBe(-32602);
    expect(fetcher).not.toHaveBeenCalled();
    const ok = await ask(fake, 2, 'net.fetch', { url: 'https://example.org/' });
    expect(ok.result.status).toBe(200);
    handle.dispose();
  });

  it('refuses document.apply ops without a command name with -32602', async () => {
    const applyDocument = vi.fn(async () => ({ applied: 0, results: [] }));
    const host = new ExtensionHost(handlers({ applyDocument }));
    const { fake, handle } = await granted(host, ['document']);
    const reply = await ask(fake, 1, 'document.apply', { label: 'x', ops: [{ args: {} }] });
    expect(reply.error.code).toBe(-32602);
    expect(applyDocument).not.toHaveBeenCalled();
    handle.dispose();
  });

  it('refuses ui.notify without text with -32602 and passes a valid level through', async () => {
    const notify = vi.fn();
    const host = new ExtensionHost(handlers({ notify }));
    const { fake, handle } = await granted(host, []);
    expect((await ask(fake, 1, 'ui.notify', { message: 42 })).error.code).toBe(-32602);
    expect((await ask(fake, 2, 'ui.notify', { message: 'Saved', level: 'success' })).result).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ id: 'org.example.beats' }), 'Saved', 'success');
    handle.dispose();
  });

  it('refuses files.save without data and files.open without files-read', async () => {
    const host = new ExtensionHost(handlers({ saveFile: async (_e, name) => ({ saved: true, name }), openFiles: async () => [] }));
    const { fake, handle } = await granted(host, ['files-write']);
    expect((await ask(fake, 1, 'files.save', { name: 'a.txt' })).error.code).toBe(-32602);
    expect((await ask(fake, 2, 'files.save', { name: 'a.txt', type: 'text/plain', data: 'aGk=' })).result).toEqual({ saved: true, name: 'a.txt' });
    expect((await ask(fake, 3, 'files.open', { accept: ['.wav'] })).error.code).toBe(-32001);
    handle.dispose();
  });

  it('stores values per extension and returns null for a key never set', async () => {
    const host = new ExtensionHost(handlers());
    const a = await granted(host, []);
    const other = makeExt({ id: 'org.example.other' });
    const hb = host.mount(other, document.createElement('div'));
    const b = fakeWindow();
    attach(hb, b);
    expect((await ask(a.fake, 1, 'storage.get', { key: 'bpm' })).result).toBeNull();
    await ask(a.fake, 2, 'storage.set', { key: 'bpm', value: { n: 128, tags: ['x'] } });
    expect((await ask(a.fake, 3, 'storage.get', { key: 'bpm' })).result).toEqual({ n: 128, tags: ['x'] });
    expect((await ask(b, 4, 'storage.get', { key: 'bpm' })).result).toBeNull();
    a.handle.dispose();
    hb.dispose();
  });

  it('refuses storage past 256 KB per extension with -32004', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    const small = await ask(fake, 1, 'storage.set', { key: 'a', value: 'x'.repeat(200 * 1024) });
    expect(small.error).toBeUndefined();
    const big = await ask(fake, 2, 'storage.set', { key: 'b', value: 'y'.repeat(100 * 1024) });
    expect(big.error.code).toBe(-32004);
    expect((await ask(fake, 3, 'storage.get', { key: 'b' })).result).toBeNull();
    handle.dispose();
  });

  it('caps a resize request at 4000 and ignores a non-positive height', async () => {
    const host = new ExtensionHost(handlers());
    const onResize = vi.fn();
    const handle = host.mount(makeExt(), document.createElement('div'), { onResize });
    const fake = fakeWindow();
    attach(handle, fake);
    await ask(fake, 1, 'ui.resize', { height: 9000 });
    await ask(fake, 2, 'ui.resize', { height: -5 });
    await ask(fake, 3, 'ui.resize', { height: 320 });
    expect(onResize.mock.calls).toEqual([[4000], [320]]);
    handle.dispose();
  });

  it('sends ext.deactivate on dispose and cancels waiting requests with -32002', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    await ask(fake, 1, 'host.hello');
    const waiting = handle.activate({ reason: 'panel', panel: 'main' });
    await flush();
    expect(fake.sent.some((m) => m.method === 'ext.activate' && m.params.panel === 'main')).toBe(true);
    handle.dispose();
    await expect(waiting).rejects.toMatchObject({ code: -32002 });
    expect(fake.sent.at(-1)).toMatchObject({ method: 'ext.deactivate', params: {} });
  });

  it('holds host requests until the extension has said hello', async () => {
    const host = new ExtensionHost(handlers());
    const { fake, handle } = await granted(host, []);
    void handle.send('ext.event', { name: 'x', data: 1 }).catch(() => undefined);
    await flush();
    expect(fake.sent).toEqual([]);
    await ask(fake, 1, 'host.hello');
    await flush();
    expect(fake.sent.some((m) => m.method === 'ext.event')).toBe(true);
    handle.dispose();
  });

  it('names every permission in plain words as the contract lists them', () => {
    expect(PERMISSION_WORDS.document.toLowerCase()).toBe('read and change the open document');
    expect(PERMISSION_WORDS['files-read'].toLowerCase()).toBe('open files you choose');
    expect(PERMISSION_WORDS['files-write'].toLowerCase()).toBe('save files where you choose');
    expect(PERMISSION_WORDS.network.toLowerCase()).toBe('reach the internet');
    expect(PERMISSION_WORDS.models.toLowerCase()).toBe('use local models');
  });
});

describe('host bridge consent', () => {
  it('asks before creating a frame and creates none when the person says Not Now', async () => {
    const consent = vi.fn(async () => false);
    const host = new ExtensionHost(handlers({ consent }));
    const box = document.createElement('div');
    const out = await host.open(makeExt({ permissions: ['document'] }), box);
    expect(out).toBeNull();
    expect(box.querySelector('iframe')).toBeNull();
    await host.open(makeExt({ permissions: ['document'] }), box);
    expect(consent).toHaveBeenCalledTimes(2);
  });

  it('remembers Allow for the same id, version and permissions', async () => {
    const consent = vi.fn(async () => true);
    const host = new ExtensionHost(handlers({ consent }));
    const box = document.createElement('div');
    const a = await host.open(makeExt({ permissions: ['document', 'network'] }), box);
    const b = await host.open(makeExt({ permissions: ['network', 'document'] }), box);
    expect(consent).toHaveBeenCalledTimes(1);
    expect(box.querySelectorAll('iframe').length).toBe(2);
    a?.dispose();
    b?.dispose();
  });

  it('asks again for a new version or a larger permission set', async () => {
    const consent = vi.fn(async () => true);
    const host = new ExtensionHost(handlers({ consent }));
    await host.ensureConsent(makeExt({ permissions: ['document'] }));
    await host.ensureConsent(makeExt({ permissions: ['document'], version: '1.1.0' }));
    await host.ensureConsent(makeExt({ permissions: ['document', 'network'] }));
    expect(consent).toHaveBeenCalledTimes(3);
  });

  it('never asks for an extension that needs no permissions', async () => {
    const consent = vi.fn(async () => false);
    const host = new ExtensionHost(handlers({ consent }));
    expect(await host.ensureConsent(makeExt())).toBe(true);
    expect(consent).not.toHaveBeenCalled();
  });

  it('asks again after a grant is revoked', async () => {
    const consent = vi.fn(async () => true);
    const host = new ExtensionHost(handlers({ consent }));
    const ext = makeExt({ permissions: ['files-read'] });
    await host.ensureConsent(ext);
    expect(host.isGranted(ext)).toBe(true);
    host.revoke(ext);
    expect(host.isGranted(ext)).toBe(false);
  });

  it('refuses a headless command the person did not allow with -32001 and an unknown command with -32601', async () => {
    const host = new ExtensionHost(handlers({ consent: async () => false }));
    const ext = makeExt({ permissions: ['document'] });
    await expect(host.runCommand(ext, 'mark', {}, document.body)).rejects.toMatchObject({ code: -32001 });
    await expect(host.runCommand(ext, 'nope', {}, document.body)).rejects.toMatchObject({ code: -32601 });
    expect(document.body.querySelector('iframe')).toBeNull();
  });
});
