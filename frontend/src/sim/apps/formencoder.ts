import type { AppSim, Json } from '../types';
import { refuse, invalid, need, uid, esc } from '../util';

interface Output { id: string; kind: string; format: string; formatLabel: string; preset: string; presetName: string; path: string; status: string; progress: number; error: string | null; notes: string | null; settings: Json; effects: string[]; skip: boolean; loudness: null }
interface Item { id: string; kind: string; name: string; path: string; duration: number; video: string; audio: string; range: Json; missing: boolean; outputs: Output[] }
interface State { items: Item[]; selection: { items: string[]; outputs: string[] }; running: boolean; paused: boolean; undo: string | null; redo: string | null; revision: number; history: string[] }

const PRESETS: Record<string, { name: string; format: string; label: string; category: string; size: string; video: Json; audio: Json }> = {
  'system/youtube-1080p': { name: 'YouTube 1080p Full HD', format: 'h264', label: 'H.264', category: 'Web', size: '1920x1080', video: { codec: 'h264', width: 1920, height: 1080, targetBitrate: 16, maxBitrate: 20, passes: 1 }, audio: { codec: 'aac', rate: 48000, channels: 2, bitrate: 320 } },
  'system/web-720p': { name: 'Web 720p', format: 'h264', label: 'H.264', category: 'Web', size: '1280x720', video: { codec: 'h264', width: 1280, height: 720, targetBitrate: 6, maxBitrate: 8, passes: 1 }, audio: { codec: 'aac', rate: 48000, channels: 2, bitrate: 192 } },
  'system/prores-422': { name: 'Apple ProRes 422', format: 'prores', label: 'ProRes', category: 'Master', size: 'source', video: { codec: 'prores', profile: '422' }, audio: { codec: 'pcm', rate: 48000, channels: 2 } },
  'system/audio-mp3': { name: 'MP3 320 kb/s', format: 'mp3', label: 'MP3', category: 'Audio', size: 'none', video: null, audio: { codec: 'mp3', rate: 44100, channels: 2, bitrate: 320 } },
};

function output(item: Item, preset: string): Output {
  const p = PRESETS[preset] ?? refuse(`there is no preset ${preset}`);
  return { id: uid('o'), kind: 'encode', format: p.format, formatLabel: p.label, preset, presetName: p.name, path: item.path.replace(/\.[^.]+$/, `.${p.format === 'mp3' ? 'mp3' : p.format === 'prores' ? 'mov' : 'mp4'}`), status: 'ready', progress: 0, error: null, notes: null, settings: JSON.parse(JSON.stringify({ video: p.video, audio: p.audio })), effects: [], skip: false, loudness: null };
}

function summary(o: Output) {
  const v = o.settings.video;
  const a = o.settings.audio;
  return { format: o.formatLabel, video: v ? `${v.width ?? 'source'}x${v.height ?? ''}, 25 fps, ${v.codec.toUpperCase()}${v.targetBitrate ? `, Target ${v.targetBitrate} Mb/s` : ''}` : 'none', audio: a ? `${a.codec.toUpperCase()}, ${a.rate} Hz, ${a.channels === 2 ? 'Stereo' : 'Mono'}${a.bitrate ? `, ${a.bitrate} kb/s` : ''}` : 'none', effects: o.effects, captions: 'none', publish: [] };
}

function refs(s: State, r: unknown): Output[] {
  const list = Array.isArray(r) ? r : [r];
  const out: Output[] = [];
  for (const ref of list) {
    if (ref === 'all') s.items.forEach((i) => out.push(...i.outputs));
    else if (ref === 'selected') s.items.forEach((i) => out.push(...i.outputs.filter((o) => s.selection.outputs.includes(o.id) || s.selection.items.includes(i.id))));
    else if (typeof ref === 'string' && ref.startsWith('#')) out.push(...(s.items[Number(ref.slice(1)) - 1] ?? refuse(`there is no item ${ref}`)).outputs);
    else {
      const item = s.items.find((i) => i.id === ref);
      if (item) out.push(...item.outputs);
      else out.push(s.items.flatMap((i) => i.outputs).find((o) => o.id === ref) ?? refuse(`nothing in the queue is called ${String(ref)}`));
    }
  }
  if (!out.length) refuse('those refs match no output');
  return out;
}

function counts(s: State) {
  const all = s.items.flatMap((i) => i.outputs);
  const c: Record<string, number> = { total: all.length, ready: 0, encoding: 0, done: 0, failed: 0, stopped: 0, skipped: 0 };
  for (const o of all) c[o.status] = (c[o.status] ?? 0) + 1;
  return c;
}

function queue(s: State) {
  return { what: 'queue', revision: s.revision, running: s.running, paused: s.paused, counts: counts(s), selection: s.selection, undo: s.undo, redo: s.redo, items: s.items.map((i, n) => ({ ...i, index: n + 1, outputs: i.outputs.map((o) => { const { settings: _s, ...rest } = o; void _s; return { ...rest, summary: summary(o) }; }) })) };
}

function setPath(obj: Json, dotted: string, v: unknown) {
  const keys = dotted.split('.');
  let t = obj;
  for (const k of keys.slice(0, -1)) t = t[k] ??= {};
  t[keys.at(-1) as string] = v;
}

const sim: AppSim<State> = {
  product: 'formencoder',
  app: 'FormEncoder',
  appVersion: '0.7.0',
  docLabel: 'Queue',
  title: (s) => `Queue (${counts(s).total} outputs)`,
  initial: () => {
    const item = (id: string, name: string, duration: number, video: string, audio: string): Item => ({ id, kind: 'file', name, path: `/Users/me/Movies/${name}`, duration, video, audio, range: {}, missing: false, outputs: [] });
    const a = item('ic94ecd001', 'harbour-short.mov', 24.0, '3840x2160, 25 fps', '48000 Hz 2 ch');
    a.outputs.push({ ...output(a, 'system/youtube-1080p'), id: 'oc94ef7002' }, { ...output(a, 'system/prores-422'), id: 'oc94ef7003' });
    const b = item('ic94ecd004', 'interview-raw.mp4', 1265.4, '1920x1080, 25 fps', '48000 Hz 1 ch');
    b.outputs.push({ ...output(b, 'system/audio-mp3'), id: 'oc94ef7005', status: 'done', progress: 1 });
    return { items: [a, b], selection: { items: ['ic94ecd001'], outputs: ['oc94ef7002'] }, running: false, paused: false, undo: 'Add Source...', redo: null, revision: 6, history: ['Add Source...'] };
  },
  defaultRead: 'queue',
  reads: {
    queue,
    selection: (s) => ({ what: 'selection', outputs: s.items.flatMap((i) => i.outputs.filter((o) => s.selection.outputs.includes(o.id) || s.selection.items.includes(i.id)).map((o) => ({ output: o.id, item: i.id, settings: o.settings, summary: summary(o), path: o.path, source: i.path }))).slice(0, 50) }),
    watch: () => ({ what: 'watch', folders: [{ folder: '/Users/me/Movies/Drop', outputs: [{ preset: 'system/web-720p' }], auto: false }] }),
    presets: () => ({ what: 'presets', presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, category: p.category, format: p.format, size: p.size, rate: '25', comment: '' })) }),
    formats: () => ({ what: 'formats', formats: [{ id: 'h264', label: 'H.264', codecs: ['h264', 'aac'] }, { id: 'hevc', label: 'HEVC', codecs: ['hevc', 'aac'] }, { id: 'prores', label: 'ProRes', codecs: ['prores', 'pcm'] }, { id: 'mp3', label: 'MP3', codecs: ['mp3'] }] }),
    history: (s) => ({ what: 'history', undo: [...s.history].reverse(), redo: s.redo ? [s.redo] : [] }),
  },
  apply: 'atomic',
  undo: true,
  step: (s, label) => {
    s.undo = label;
    s.history.push(label);
    s.revision += 1;
  },
  cmds: {
    'queue.addSource': { title: 'Add Source', args: { paths: 'string[]', preset: 'string?', folder: 'string?' }, fn: (s, a) => { if (!Array.isArray(a.paths) || !a.paths.length) invalid('paths must be a list of files'); const made = a.paths.map((p: string) => { const name = p.split('/').pop() as string; const it: Item = { id: uid('i'), kind: 'file', name, path: p, duration: 10, video: '1920x1080, 25 fps', audio: '48000 Hz 2 ch', range: {}, missing: false, outputs: [] }; it.outputs.push(output(it, a.preset ?? 'system/youtube-1080p')); s.items.push(it); return it.id; }); return { items: made }; } },
    'queue.addOutput': { title: 'Add Output', args: { item: 'string', preset: 'string' }, fn: (s, a) => { const it = s.items.find((i) => i.id === a.item) ?? refuse(`there is no item ${a.item}`); const o = output(it, a.preset ?? 'system/youtube-1080p'); it.outputs.push(o); return { output: o.id }; } },
    'queue.setPreset': { title: 'Apply Preset', args: { refs: 'refs', preset: 'string' }, fn: (s, a) => { need(a, 'preset'); const list = refs(s, a.refs); for (const o of list) { const it = s.items.find((i) => i.outputs.includes(o)) as Item; Object.assign(o, { ...output(it, a.preset), id: o.id }); } return { outputs: list.length }; } },
    'queue.setSettings': { title: 'Change Settings', args: { refs: 'refs', settings: 'patch, dotted keys work', replace: 'boolean?' }, fn: (s, a) => { const list = refs(s, a.refs); for (const o of list) for (const [k, v] of Object.entries(a.settings ?? {})) setPath(o.settings, k, v); return { outputs: list.length }; } },
    'queue.getSettings': { title: 'Get Settings', args: { output: 'string' }, fn: (s, a) => { const o = refs(s, a.output)[0]; return { settings: o.settings, summary: summary(o), path: o.path }; } },
    'queue.setRange': { title: 'Set Range', args: { refs: 'refs', mode: 'entire|inout|custom', in: 'seconds', out: 'seconds' }, fn: (s, a) => { refs(s, a.refs); for (const it of s.items) if (it.outputs.some((o) => refs(s, a.refs).includes(o))) it.range = a.mode === 'entire' ? {} : { in: a.in, out: a.out }; return {}; } },
    'queue.setOutput': { title: 'Set Output', args: { refs: 'refs', path: 'string?', folder: 'string?', name: 'string?' }, fn: (s, a) => { for (const o of refs(s, a.refs)) o.path = a.path ?? `${a.folder ?? o.path.replace(/\/[^/]+$/, '')}/${a.name ?? o.path.split('/').pop()}`; return {}; } },
    'queue.remove': { title: 'Remove', args: { refs: 'refs' }, fn: (s, a) => { const list = refs(s, a.refs); for (const it of s.items) it.outputs = it.outputs.filter((o) => !list.includes(o)); s.items = s.items.filter((i) => i.outputs.length); return { removed: list.length }; } },
    'queue.skip': { title: 'Skip', args: { refs: 'refs', skip: 'boolean' }, fn: (s, a) => { for (const o of refs(s, a.refs)) { o.skip = a.skip !== false; o.status = o.skip ? 'skipped' : 'ready'; } return {}; } },
    'queue.start': { title: 'Start Queue', fn: (s) => ((s.running = true), { running: true }) },
    'queue.pause': { title: 'Pause Queue', fn: (s) => ((s.paused = !s.paused), { paused: s.paused }) },
    'queue.stop': { title: 'Stop Queue', fn: (s) => ((s.running = false), { running: false }) },
    'queue.select': { title: 'Select', args: { items: 'string[]', outputs: 'string[]' }, fn: (s, a) => ((s.selection = { items: a.items ?? [], outputs: a.outputs ?? [] }), s.selection) },
    'encode.estimate': { title: 'Estimate', args: { output: 'string' }, fn: (s, a) => { const o = refs(s, a.output)[0]; const it = s.items.find((i) => i.outputs.includes(o)) as Item; const mbps = (o.settings.video?.targetBitrate ?? 0) + (o.settings.audio?.bitrate ?? 0) / 1000; return { bytes: Math.round((mbps * 1e6 * it.duration) / 8), seconds: Math.round(it.duration * 0.6) }; } },
    'media.probe': { title: 'Probe Media', args: { path: 'string', loudness: 'boolean?' }, fn: (s, a) => { const it = s.items.find((i) => i.path === a.path) ?? refuse(`${a.path} is not in the queue`); return { path: it.path, duration: it.duration, video: it.video, audio: it.audio }; } },
    'preset.list': { title: 'Preset Browser', args: { query: 'string?', category: 'string?' }, fn: () => Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, category: p.category })) },
    'ui.toast': { title: 'Toast', args: { text: 'string' }, fn: () => ({}) },
  },
  changed: (p, n) => {
    const out = [];
    if (JSON.stringify([p.items, p.running, p.paused]) !== JSON.stringify([n.items, n.running, n.paused])) out.push({ name: 'document.changed', data: { revision: n.revision, counts: counts(n) } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: n.selection });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'the queue or watch folders changed', sample: (s) => ({ revision: s.revision, counts: counts(s) }) },
    { name: 'selection.changed', note: 'the Queue panel selection changed', sample: (s) => s.selection },
    { name: 'encode.finished', note: 'an output finished encoding', sample: () => ({ output: 'oc94ef7002', status: 'done', path: '/Users/me/Movies/harbour-short.mp4', error: null }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: true, notes: ['net.fetch: through the engine, redirects returned, 60 s, 50 MB'] },
  tokens: { '--surface': '--panel', '--faint': '--muted', '--ok': '#30a46c', '--warn': '#f5a524', '--danger': '#e5484d', '--font-ui': 'Inter, system-ui, sans-serif', '--font-mono': 'JetBrains Mono, monospace' },
  view: (s) => `<table class="sim-table">${s.items.map((i, n) => `<tr><td colspan="3"><b>${n + 1}. ${esc(i.name)}</b> <span class="sim-m">${esc(i.video)}, ${i.duration}s</span></td></tr>${i.outputs.map((o) => `<tr class="${s.selection.outputs.includes(o.id) ? 'on' : ''}"><td class="sim-m">${esc(o.id)}</td><td>${esc(o.presetName)}</td><td>${esc(o.status)}</td></tr>`).join('')}`).join('')}</table><div class="sim-m">${counts(s).total} outputs, ${s.running ? 'running' : 'idle'}, undo: ${esc(s.undo)}</div>`,
  samples: ['song.wav', 'notes.txt'],
};

export default sim;
