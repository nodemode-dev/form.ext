import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionHost } from '../../../../contract/host/host-bridge';
import type { HostHandlers, Frame } from '../../../../contract/host/host-bridge';
import { formext, FormExtError, ERR, toBase64, fromBase64, applyTheme } from '../../../../sdk/src/formext';
import { makeExt, link, flush } from './wire';
import type { Msg } from './wire';

let handle: Frame | null = null;

function handlers(over: Partial<HostHandlers> = {}): HostHandlers {
  return {
    product: 'formmd',
    app: 'form.md',
    appVersion: '1.2.3',
    locale: () => 'fr-FR',
    theme: () => ({ mode: 'light', tokens: { '--bg': '#eeeeee', '--accent': '#123456', color: 'red' } }),
    notify: vi.fn(),
    consent: async () => true,
    ...over,
  };
}

async function connect(h: Partial<HostHandlers> = {}, perms: ('document' | 'network' | 'files-read')[] = []) {
  const host = new ExtensionHost(handlers(h));
  const ext = makeExt({ permissions: perms });
  await host.ensureConsent(ext);
  handle = host.mount(ext, document.createElement('div'));
  const toHost = link(handle);
  return { host, ext, toHost };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  handle?.dispose();
  handle = null;
  vi.useRealTimers();
});

describe('SDK and host agree', () => {
  it('sends every request with the formext marker and json-rpc 2.0', async () => {
    const { toHost } = await connect();
    await formext.call('host.hello');
    expect(toHost[0]).toMatchObject({ formext: 1, jsonrpc: '2.0', method: 'host.hello', params: {} });
    expect(typeof toHost[0].id).toBe('number');
  });

  it('gets the hello the host builds and applies its theme tokens to the page', async () => {
    await connect();
    const hello = await formext.hello();
    expect(hello.api).toBe('1');
    expect(hello.app).toBe('form.md');
    expect(hello.locale).toBe('fr-FR');
    expect(hello.extension).toEqual({ id: 'org.example.beats', version: '1.0.0', source: 'sideload' });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456');
    expect(document.documentElement.style.getPropertyValue('color')).toBe('');
  });

  it('turns a host refusal into a FormExtError carrying the contract code', async () => {
    await connect({ readDocument: () => ({}) }, []);
    const err = (await formext.readDocument().catch((e) => e)) as FormExtError;
    expect(err).toBeInstanceOf(FormExtError);
    expect(err.code).toBe(ERR.PERMISSION);
    expect(err.code).toBe(-32001);
  });

  it('round-trips storage through the host', async () => {
    await connect();
    await formext.storageSet('grid', { rows: 4, cols: [1, 2] });
    expect(await formext.storageGet('grid')).toEqual({ rows: 4, cols: [1, 2] });
    await formext.storageSet('grid', null);
    expect(await formext.storageGet('grid')).toBeNull();
  });

  it('sends document.apply ops the host passes to the app unchanged', async () => {
    const applyDocument = vi.fn(async (_e: unknown, _l: string, ops: { command: string }[]) => ({ applied: ops.length, results: ops.map((o) => o.command) }));
    await connect({ applyDocument }, ['document']);
    const out = await formext.apply('Add beats', [{ command: 'marker.add', args: { t: 1 } }, { command: 'marker.add', args: { t: 2 } }]);
    expect(out).toEqual({ applied: 2, results: ['marker.add', 'marker.add'] });
    expect(applyDocument.mock.calls[0][1]).toBe('Add beats');
    expect(applyDocument.mock.calls[0][2]).toEqual([{ command: 'marker.add', args: { t: 1 } }, { command: 'marker.add', args: { t: 2 } }]);
  });

  it('notifies through ui.notify with the level it was given', async () => {
    const notify = vi.fn();
    await connect({ notify });
    await formext.notify('Done', 'warning');
    expect(notify).toHaveBeenCalledWith(expect.anything(), 'Done', 'warning');
  });

  it('rounds a fractional resize height up before it reaches the host', async () => {
    const { toHost } = await connect();
    await formext.resize(100.2);
    expect(toHost.at(-1)).toMatchObject({ method: 'ui.resize', params: { height: 101 } });
  });

  it('delivers ext.activate to the extension handler and returns its answer to the host', async () => {
    await connect();
    const seen: unknown[] = [];
    formext.onActivate((a) => {
      seen.push(a);
      return { opened: a.panel };
    });
    await formext.call('host.hello');
    const result = await handle!.activate({ reason: 'panel', panel: 'main' });
    expect(seen).toEqual([{ reason: 'panel', panel: 'main' }]);
    expect(result).toEqual({ opened: 'main' });
  });

  it('reports a failing activate handler to the host with its code', async () => {
    await connect();
    formext.onActivate(() => {
      throw new FormExtError(ERR.CANCELLED, 'person closed it');
    });
    await formext.call('host.hello');
    await expect(handle!.activate({ reason: 'command', command: 'mark' })).rejects.toMatchObject({ code: -32002, message: 'person closed it' });
  });

  it('answers a host request it has no handler for with -32601', async () => {
    await connect();
    await formext.call('host.hello');
    await expect(handle!.send('ext.unknownThing', {})).rejects.toMatchObject({ code: -32601 });
  });

  it('passes app events from broadcast to onEvent', async () => {
    const { host } = await connect();
    const events: unknown[] = [];
    formext.onEvent((e) => void events.push(e));
    await formext.call('host.hello');
    host.broadcast('document.changed', { blocks: 3 });
    await flush();
    expect(events).toEqual([{ name: 'document.changed', data: { blocks: 3 } }]);
  });

  it('repaints the page when the host changes theme', async () => {
    const { host } = await connect();
    await formext.call('host.hello');
    host.setTheme({ mode: 'dark', tokens: { '--bg': '#010101' } });
    await flush();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#010101');
  });

  it('ends a headless command with the result the extension gives to done', async () => {
    const host = new ExtensionHost(handlers());
    const ext = makeExt();
    const box = document.createElement('div');
    const mount = host.mount.bind(host);
    vi.spyOn(host, 'mount').mockImplementation((e, c, o) => {
      const h = mount(e, c, o);
      link(h);
      void formext.call('host.hello');
      return h;
    });
    formext.onActivate(async (a) => {
      await formext.done({ marked: a.command, args: a.args });
      return null;
    });
    const result = await host.runCommand(ext, 'mark', { bpm: 90 }, box);
    expect(result).toEqual({ marked: 'mark', args: { bpm: 90 } });
    expect(box.querySelector('iframe')).toBeNull();
  });
});

describe('SDK on its own', () => {
  it('gives up on a plain request after 30 s with -32003', async () => {
    vi.useFakeTimers();
    vi.spyOn(window.parent, 'postMessage').mockImplementation((() => undefined) as typeof window.postMessage);
    const p = formext.storageGet('x').catch((e) => e as FormExtError);
    await vi.advanceTimersByTimeAsync(29_999);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = (await p) as FormExtError;
    expect(err.code).toBe(-32003);
  });

  it('waits 300 s for files and app.run before giving up', async () => {
    vi.useFakeTimers();
    vi.spyOn(window.parent, 'postMessage').mockImplementation((() => undefined) as typeof window.postMessage);
    const out: Record<string, unknown> = {};
    const track = (name: string, p: Promise<unknown>) => p.catch((e) => (out[name] = e.code));
    track('open', formext.openFiles(['.wav']));
    track('save', formext.saveFile('a.txt', 'text/plain', ''));
    track('run', formext.run('x'));
    await vi.advanceTimersByTimeAsync(31_000);
    expect(out).toEqual({});
    await vi.advanceTimersByTimeAsync(270_000);
    expect(out).toEqual({ open: -32003, save: -32003, run: -32003 });
  });

  it('accepts answers only from the parent window', async () => {
    const sent: Msg[] = [];
    vi.spyOn(window.parent, 'postMessage').mockImplementation(((m: Msg) => void sent.push(m)) as typeof window.postMessage);
    let value: unknown = 'pending';
    void formext.storageGet('k').then((v) => (value = v));
    const id = sent[0].id;
    window.dispatchEvent(new MessageEvent('message', { data: { formext: 1, jsonrpc: '2.0', id, result: 'forged' }, source: {} as Window }));
    await flush();
    expect(value).toBe('pending');
    window.dispatchEvent(new MessageEvent('message', { data: { formext: 1, jsonrpc: '2.0', id, result: 'real' }, source: window.parent }));
    await flush();
    expect(value).toBe('real');
  });

  it('round-trips bytes through base64 and agrees with the platform encoder', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
    const b64 = toBase64(bytes);
    expect(b64).toBe(Buffer.from(bytes).toString('base64'));
    expect(Array.from(fromBase64(b64))).toEqual(Array.from(bytes));
    expect(toBase64(new TextEncoder().encode('hi'))).toBe('aGk=');
  });

  it('ignores a missing theme and skips token names without the leading dashes', () => {
    applyTheme(undefined);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    applyTheme({ mode: 'dark', tokens: { '--panel': '#222222', panel: '#333333' } });
    expect(document.documentElement.style.getPropertyValue('--panel')).toBe('#222222');
    expect(document.documentElement.style.getPropertyValue('panel')).toBe('');
  });
});
