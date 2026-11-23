import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SIMS, simFor, SimHost, sampleFile, accepts, tokensFor } from '../../../src/sim';
import type { SimUI, AppSim } from '../../../src/sim';
import { formext } from '../../../../sdk/src/formext';
import { makeExt, link } from './wire';

function ui(): SimUI {
  return {
    consent: vi.fn(async () => true),
    openFiles: vi.fn(async () => []),
    saveFile: vi.fn(async (_r, name) => ({ saved: true, name })),
    fetch: vi.fn(async () => ({ status: 200, headers: {}, body: '' })),
    notify: vi.fn(),
    setTitle: vi.fn(),
    resize: vi.fn(),
    log: vi.fn(),
    changed: vi.fn(),
  };
}

const ext = makeExt({ permissions: ['document'] });
const REQUIRED_TOKENS = ['--bg', '--panel', '--text', '--muted', '--accent', '--border', '--radius'];
const all = Object.entries(SIMS) as [string, AppSim][];

function b64bytes(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, 'base64'));
}

beforeEach(() => localStorage.clear());

describe('simulated host apps', () => {
  it.each(all)('%s is registered under its own product id', (key, sim) => {
    expect(sim.product).toBe(key);
    expect(simFor(key)).toBe(sim);
  });

  it('finds no simulation for an unknown product', () => {
    expect(simFor('formnothing')).toBeNull();
  });

  it.each(all)('%s gives extensions at least the design tokens the contract lists, in both modes', (_k, sim) => {
    for (const mode of ['dark', 'light'] as const) {
      const tokens = tokensFor(sim, mode);
      for (const name of REQUIRED_TOKENS) expect(tokens[name], `${mode} ${name}`).toMatch(/\S/);
    }
  });

  it.each(all)('%s leaves the document untouched when document.apply names an unknown command', async (_k, sim) => {
    const host = new SimHost(sim, ui(), 'dark');
    const before = JSON.stringify(host.state);
    await expect(host.apply(ext, 'Nothing', [{ command: 'no.such.command', args: {} }])).rejects.toMatchObject({ code: expect.any(Number) });
    expect(JSON.stringify(host.state)).toBe(before);
    expect(host.steps).toEqual([]);
  });

  it.each(all.filter(([, s]) => !s.readFallback))('%s refuses an unknown document.read what with -32602', async (_k, sim) => {
    const host = new SimHost(sim, ui(), 'dark');
    await expect(host.read({ what: 'no-such-part' })).rejects.toMatchObject({ code: -32602 });
  });

  it.each(all)('%s lists its command catalogue with an id and a title for each command', (_k, sim) => {
    const host = new SimHost(sim, ui(), 'light');
    const cat = host.catalogue() as { id: string; title: string }[];
    expect(cat.map((c) => c.id).sort()).toEqual(Object.keys(sim.cmds).sort());
    for (const c of cat) expect(typeof c.title).toBe('string');
  });
});

describe('form.md simulation', () => {
  const md = SIMS.formmd;

  it('applies a batch as one undoable step and undo restores the page exactly', async () => {
    const u = ui();
    const host = new SimHost(md, u, 'dark');
    const start = JSON.stringify(host.state);
    const out = await host.apply(ext, 'Add notes', [
      { command: 'doc.insertText', args: { text: 'First note' } },
      { command: 'doc.insertMarkdown', args: { markdown: '## Winter' } },
    ]);
    expect(out.applied).toBe(2);
    expect(host.steps.map((s) => s.label)).toEqual(['Add notes']);
    const after = (await host.read({ what: 'markdown' })) as { markdown: string };
    expect(after.markdown).toContain('First note');
    expect(after.markdown).toContain('## Winter');
    expect(u.changed).toHaveBeenCalled();
    expect(host.undo()).toBe('Add notes');
    expect(JSON.stringify(host.state)).toBe(start);
    expect(host.undo()).toBeNull();
  });

  it('applies all ops or none: a failing second op keeps the first out of the page', async () => {
    const host = new SimHost(md, ui(), 'dark');
    const start = JSON.stringify(host.state);
    const err = await host.apply(ext, 'Half', [
      { command: 'doc.insertText', args: { text: 'Should not land' } },
      { command: 'doc.deleteBlock', args: { block: 'missing' } },
    ]).catch((e) => e);
    expect(err.code).toBe(-32004);
    expect(err.message).toMatch(/^op 2 \(doc\.deleteBlock\)/);
    expect(JSON.stringify(host.state)).toBe(start);
  });

  it('reports a missing required argument as invalid params', async () => {
    const host = new SimHost(md, ui(), 'dark');
    await expect(host.apply(ext, 'x', [{ command: 'doc.insertText', args: {} }])).rejects.toMatchObject({ code: -32602 });
  });

  it('refuses to run a non-document command inside document.apply', async () => {
    const host = new SimHost(md, ui(), 'dark');
    await expect(host.apply(ext, 'x', [{ command: 'page.favorite' }])).rejects.toMatchObject({ code: -32004 });
  });

  it('counts words the same way as splitting the markdown it hands out', async () => {
    const host = new SimHost(md, ui(), 'dark');
    const { markdown } = (await host.read({ what: 'markdown' })) as { markdown: string };
    const words = markdown.split(/\s+/).filter(Boolean).length;
    expect(await host.run(ext, 'view.wordCount', {})).toEqual({ words });
  });

  it('replaces every case-insensitive match and reports how many', async () => {
    const host = new SimHost(md, ui(), 'dark');
    const { blocks } = (await host.read({ what: 'blocks' })) as { blocks: { text: string }[] };
    const expected = blocks.reduce((n, b) => n + (b.text.match(/tide/gi)?.length ?? 0), 0);
    expect(expected).toBeGreaterThan(0);
    const out = await host.apply(ext, 'Swap', [{ command: 'doc.replaceText', args: { find: 'TIDE', replace: 'flow' } }]);
    expect(out.results).toEqual([{ replaced: expected }]);
    const again = (await host.read({ what: 'markdown' })) as { markdown: string };
    expect(again.markdown).not.toMatch(/tide/i);
  });

  it('lists headings in the outline in page order', async () => {
    const host = new SimHost(md, ui(), 'dark');
    const { outline } = (await host.read({ what: 'outline' })) as { outline: { text: string; level: number }[] };
    expect(outline.map((o) => [o.level, o.text])).toEqual([[1, 'Tides and timetables'], [2, 'Method'], [2, 'Results']]);
  });

  it('refuses an unknown command in app.run with the app name in the message', async () => {
    const host = new SimHost(md, ui(), 'dark');
    await expect(host.run(ext, 'nope', {})).rejects.toMatchObject({ code: -32004, message: 'form.md has no command nope' });
  });

  it('serves document.read to a real SDK client through the bridge and logs the call', async () => {
    const u = ui();
    const host = new SimHost(md, u, 'dark');
    const mount = host.host.mount.bind(host.host);
    vi.spyOn(host.host, 'mount').mockImplementation((e, c, o) => {
      const h = mount(e, c, o);
      link(h);
      return h;
    });
    const frame = await host.openPanel(ext, 'main', document.createElement('div'));
    expect(frame).not.toBeNull();
    expect(u.consent).toHaveBeenCalledTimes(1);
    const hello = await formext.call<{ app: string; permissions: string[] }>('host.hello');
    expect(hello.app).toBe('form.md');
    expect(hello.permissions).toEqual(['document']);
    const page = await formext.readDocument<{ outline: { text: string }[] }>('outline');
    expect(page.outline[0].text).toBe('Tides and timetables');
    const logged = (u.log as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).filter((e) => e.method === 'document.read' && !e.pending);
    expect(logged.at(-1)).toMatchObject({ dir: 'in', frame: 'panel main' });
    expect(host.openPanels()).toEqual(['main']);
    host.closePanel('main');
    expect(host.openPanels()).toEqual([]);
  });
});

describe('sample files', () => {
  it('builds a wav whose RIFF header matches its own bytes', () => {
    const f = sampleFile('song.wav')!;
    const bytes = b64bytes(f.data);
    const v = new DataView(bytes.buffer);
    const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
    expect(f.size).toBe(bytes.length);
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(v.getUint32(4, true)).toBe(bytes.length - 8);
    const channels = v.getUint16(22, true);
    const rate = v.getUint32(24, true);
    const bits = v.getUint16(34, true);
    expect(v.getUint32(28, true)).toBe((rate * channels * bits) / 8);
    expect(tag(36)).toBe('data');
    const seconds = v.getUint32(40, true) / ((rate * channels * bits) / 8);
    expect(seconds).toBeCloseTo(4, 3);
  });

  it('builds a pdf whose cross-reference offsets point at their objects', () => {
    const f = sampleFile('membership-form.pdf')!;
    const text = Buffer.from(f.data, 'base64').toString('latin1');
    expect(text.startsWith('%PDF-1.')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const start = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    const rows = text.slice(start).split('\n').slice(2).filter((l) => / n $/.test(l));
    rows.forEach((row, i) => {
      const off = Number(row.slice(0, 10));
      expect(text.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
    expect(text).toContain('/T (full_name)');
  });

  it('decodes a text sample to the size it reports', () => {
    const f = sampleFile('notes.txt')!;
    const text = Buffer.from(f.data, 'base64').toString('utf8');
    expect(text.startsWith('Harbour shoot notes')).toBe(true);
    expect(f.size).toBe(Buffer.byteLength(text));
    expect(f.type).toBe('text/plain');
  });

  it('has no sample for a name it does not know', () => {
    expect(sampleFile('secret.exe')).toBeNull();
  });

  it('matches files against accept lists by extension, wildcard and exact type', () => {
    expect(accepts('Song.WAV', 'audio/wav', ['.wav'])).toBe(true);
    expect(accepts('song.mp3', 'audio/mpeg', ['.wav'])).toBe(false);
    expect(accepts('photo.png', 'image/png', ['image/*'])).toBe(true);
    expect(accepts('a.json', 'application/json', ['application/json'])).toBe(true);
    expect(accepts('a.json', 'application/json', ['text/plain'])).toBe(false);
    expect(accepts('anything.bin', 'application/octet-stream', [])).toBe(true);
  });
});
