import { vi } from 'vitest';
import type { ExtensionRecord, Frame } from '../../../../contract/host/host-bridge';

export type Msg = Record<string, any>;

export function makeExt(over: Partial<ExtensionRecord> = {}): ExtensionRecord {
  return {
    id: 'org.example.beats',
    name: 'Beat Markers',
    version: '1.0.0',
    source: 'sideload',
    permissions: [],
    base: 'about:',
    entryUi: 'blank',
    panels: [{ id: 'main', title: 'Beats' }],
    commands: [{ id: 'mark', title: 'Mark Beats' }],
    state: 'ready',
    ...over,
  };
}

export function flush(times = 6): Promise<void> {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => new Promise<void>((r) => setTimeout(r, 0)));
  return p;
}

export interface FakeFrame {
  win: { postMessage: (m: Msg) => void };
  sent: Msg[];
}

export function fakeWindow(): FakeFrame {
  const sent: Msg[] = [];
  return { sent, win: { postMessage: (m: Msg) => void sent.push(m) } };
}

export function attach(handle: Frame, fake: FakeFrame): void {
  Object.defineProperty(handle.frame, 'contentWindow', { value: fake.win, configurable: true });
}

export function fromFrame(source: unknown, data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));
}

export async function ask(fake: FakeFrame, id: number, method: string, params: unknown = {}): Promise<Msg> {
  fromFrame(fake.win, { formext: 1, jsonrpc: '2.0', id, method, params });
  for (let i = 0; i < 20; i++) {
    const hit = fake.sent.find((m) => m.id === id && !m.method);
    if (hit) return hit;
    await flush(1);
  }
  throw new Error(`no answer to ${method}`);
}

export function link(handle: Frame): Msg[] {
  const toHost: Msg[] = [];
  const parent = window.parent;
  const win = {
    postMessage: (data: Msg) => queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data, source: parent }))),
  };
  Object.defineProperty(handle.frame, 'contentWindow', { value: win, configurable: true });
  vi.spyOn(parent, 'postMessage').mockImplementation(((data: Msg) => {
    toHost.push(data);
    queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data, source: win as unknown as Window })));
  }) as typeof parent.postMessage);
  return toHost;
}
