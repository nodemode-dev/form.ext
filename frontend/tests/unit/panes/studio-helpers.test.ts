import { describe, it, expect, vi } from 'vitest';
import { setKey, formatManifest } from '../../../src/panes/studio/manifest';
import { minimalChange, Text } from '../../../src/panes/studio/editor';
import { short, pretty } from '../../../src/panes/preview/log';

vi.mock('../../../src/shell/shell', () => ({
  lastArgs: () => undefined,
  activePane: () => 'studio',
  chooseProject: async () => undefined,
  partRoot: () => document.body,
  setStatus: () => undefined,
  setNavCount: () => undefined,
  layoutOf: () => 'studio',
}));

const MANIFEST = {
  format: 'formext',
  format_version: 1,
  id: 'shelf-sorter',
  name: 'Shelf "Sorter"',
  permissions: ['document', 'network'],
  contributes: { panels: [{ id: 'main', title: 'Main', location: 'dock' }], commands: [] },
  description: 'A long sentence that makes the whole manifest too wide to sit on a single line of one hundred characters.',
  payload: { nested: { deep: [1, 2.5, true, null, 'x'] }, empty: {} },
};

function apply(prev: string, next: string): string {
  const c = minimalChange(Text.of(prev.split('\n')), next);
  if (!c) return prev;
  return prev.slice(0, c.from) + c.insert + prev.slice(c.to);
}

describe('studio manifest text', () => {
  it('writes manifest text that reads back as the same JSON value', () => {
    expect(JSON.parse(formatManifest(MANIFEST))).toEqual(MANIFEST);
  });

  it('keeps the keys in the order they were given', () => {
    expect(Object.keys(JSON.parse(formatManifest(MANIFEST)) as object)).toEqual(Object.keys(MANIFEST));
  });

  it('reads back the same value with a tab indent and a narrow width', () => {
    expect(JSON.parse(formatManifest(MANIFEST, '\t', 20))).toEqual(MANIFEST);
  });

  it('changes the value of a key that is already there without moving it', () => {
    const out = setKey({ id: 'a', name: 'A', version: '1.0.0' }, 'name', 'B');
    expect(out).toEqual({ id: 'a', name: 'B', version: '1.0.0' });
    expect(Object.keys(out)).toEqual(['id', 'name', 'version']);
  });

  it('removes a key when its value is cleared and leaves the others alone', () => {
    expect(setKey({ id: 'a', name: 'A', version: '1.0.0' }, 'name', undefined)).toEqual({ id: 'a', version: '1.0.0' });
  });

  it('adds a key without losing or changing any other key', () => {
    const out = setKey({ id: 'a', version: '1.0.0', zeta: 1 }, 'name', 'A');
    expect(out).toEqual({ id: 'a', name: 'A', version: '1.0.0', zeta: 1 });
  });

  it('puts an unknown key at the end', () => {
    expect(Object.keys(setKey({ id: 'a', name: 'A' }, 'x-custom', 1))).toEqual(['id', 'name', 'x-custom']);
  });
});

describe('studio editor change', () => {
  it('reports no change when the new text is the same', () => {
    expect(minimalChange(Text.of(['same', 'text']), 'same\ntext')).toBeNull();
  });

  it('gives a change that turns the old text into the new text', () => {
    const cases: [string, string][] = [
      ['const a = 1;\nconst b = 2;', 'const a = 1;\nconst c = 3;\nconst b = 2;'],
      ['abc', ''],
      ['', 'abc'],
      ['aaaa', 'aa'],
      ['hello world', 'hello brave world'],
      ['x\ny\nz', 'x\nz'],
    ];
    for (const [prev, next] of cases) expect(apply(prev, next)).toBe(next);
  });

  it('touches only the changed middle and leaves the shared start and end alone', () => {
    const c = minimalChange(Text.of(['hello world']), 'hello brave world')!;
    expect(c.from).toBeGreaterThanOrEqual(5);
    expect(c.to - c.from).toBe(0);
    expect(c.insert).toHaveLength(6);
  });
});

describe('preview message text', () => {
  it('shows a short value as its JSON', () => {
    expect(short({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
  });

  it('cuts a long line at the limit and marks the cut', () => {
    const out = short({ list: Array.from({ length: 200 }, (_v, i) => i) }, 50);
    expect(out).toHaveLength(53);
    expect(out.endsWith('...')).toBe(true);
  });

  it('says how many characters a long string had instead of printing it', () => {
    expect(short({ data: 'a'.repeat(500) })).toContain('(500 chars)');
  });

  it('prints a value in full so it reads back as the same JSON', () => {
    const v = { method: 'doc.read', params: { ids: [1, 2], deep: { ok: true } } };
    expect(JSON.parse(pretty(v))).toEqual(v);
  });

  it('prints something for a value that has no JSON form', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(typeof short(loop)).toBe('string');
    expect(short(undefined)).toBe('null');
  });
});
