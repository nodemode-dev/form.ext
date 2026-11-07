import type { AppSim, Json } from '../types';
import { refuse, invalid, num, uid, esc } from '../util';

interface Clip { id: string; media: string; start: number; length: number; gain_db: number; fade_in?: number; fade_out?: number }
interface Track { id: string; name: string; gain_db: number; pan: number; mute: boolean; solo: boolean; output: string; sends: Json[]; effects: string[]; color?: string; clips: Clip[] }
interface State {
  name: string;
  sample_rate: number;
  tracks: Track[];
  buses: Json[];
  markers: { id: string; at: number; label: string; number: number; comment?: string; color?: string }[];
  regions: { id: string; start: number; end: number; label: string; number: number }[];
  loop: { start: number; end: number; enabled: boolean } | null;
  tempo: { bpm: number; meter: string };
  playhead: number;
  playing: boolean;
  selection: { clips: { track_id: string; clip_id: string }[]; range: { track_id: string; start: number; end: number } | null };
  undo: string;
  steps: number;
  media: { id: string; name: string; sample_rate: number; channels: number; frames: number }[];
}

const SR = 48000;
const sec = (n: number) => +(n / SR).toFixed(4);

function trk(s: State, id: unknown): Track {
  return s.tracks.find((t) => t.id === id) ?? refuse(`there is no track ${String(id)}`);
}

function clp(s: State, tid: unknown, cid: unknown): Clip {
  return trk(s, tid).clips.find((c) => c.id === cid) ?? refuse(`there is no clip ${String(cid)} on ${String(tid)}`);
}

function nextNumber(s: State) {
  return Math.max(0, ...s.markers.map((m) => m.number), ...s.regions.map((r) => r.number)) + 1;
}

function session(s: State) {
  return {
    product: 'formwav',
    name: s.name,
    sample_rate: s.sample_rate,
    length_s: Math.max(...s.tracks.flatMap((t) => t.clips.map((c) => sec(c.start + c.length))), 0),
    tracks: s.tracks.map((t) => ({ id: t.id, name: t.name, gain_db: t.gain_db, pan: t.pan, mute: t.mute, solo: t.solo, output: t.output, sends: t.sends, effects: t.effects, automation_points: {}, clips: t.clips.map((c) => ({ id: c.id, media: c.media, start_s: sec(c.start), length_s: sec(c.length), gain_db: c.gain_db })) })),
    buses: s.buses,
    vcas: [],
    groups: [],
    master: { gain_db: 0, effects: ['limiter'], automation_points: 0 },
    markers: s.markers.map((m) => ({ id: m.id, at_s: sec(m.at), label: m.label })),
    regions: s.regions.map((r) => ({ id: r.id, label: r.label, start_s: sec(r.start), end_s: sec(r.end) })),
    loop: s.loop && { start_s: sec(s.loop.start), end_s: sec(s.loop.end), enabled: s.loop.enabled },
    tempo: { bpm: s.tempo.bpm, meter: s.tempo.meter, changes: [], meter_changes: [] },
    key: { start: 'A minor', changes: [] },
    playhead_s: sec(s.playhead),
    selection: selection(s),
    undo: s.undo,
    steps: s.steps,
    unsaved: true,
  };
}

function selection(s: State) {
  return {
    clips: s.selection.clips.map((x) => { const c = clp(s, x.track_id, x.clip_id); return { track_id: x.track_id, clip_id: c.id, name: trk(s, x.track_id).name, start_s: sec(c.start), length_s: sec(c.length) }; }),
    range: s.selection.range && { track_id: s.selection.range.track_id, tracks: [s.selection.range.track_id], start: s.selection.range.start, end: s.selection.range.end, start_s: sec(s.selection.range.start), end_s: sec(s.selection.range.end) },
    playhead_s: sec(s.playhead),
  };
}

function set(obj: Json, a: Json, keys: [string, string][]) {
  for (const [from, to] of keys) if (a[from] !== undefined) obj[to] = a[from];
}

const sim: AppSim<State> = {
  product: 'formwav',
  app: 'formwav',
  appVersion: '2.24.0',
  docLabel: 'Session',
  title: (s) => s.name,
  initial: () => ({
    name: 'Episode 12 - Harbour stories',
    sample_rate: SR,
    tracks: [
      { id: 't-host', name: 'Host', gain_db: 0, pan: -0.1, mute: false, solo: false, output: 'master', sends: [{ bus: 'b-room', gain_db: -22 }], effects: ['eq', 'compressor', 'de-esser'], clips: [{ id: 'c-host', media: 'host.wav', start: 0, length: 1680 * SR, gain_db: 0 }] },
      { id: 't-guest', name: 'Guest', gain_db: -1.5, pan: 0.1, mute: false, solo: false, output: 'master', sends: [{ bus: 'b-room', gain_db: -22 }], effects: ['eq', 'compressor'], clips: [{ id: 'c-guest', media: 'guest.wav', start: 95 * SR, length: 1560 * SR, gain_db: 1 }] },
      { id: 't-music', name: 'Music', gain_db: -12, pan: 0, mute: false, solo: false, output: 'master', sends: [], effects: [], clips: [{ id: 'c-intro', media: 'theme.wav', start: 0, length: 32 * SR, gain_db: 0 }, { id: 'c-outro', media: 'theme.wav', start: 1648 * SR, length: 32 * SR, gain_db: 0 }] },
    ],
    buses: [{ id: 'b-room', name: 'Room', gain_db: 0, pan: 0, mute: false, output: 'master', effects: ['reverb'] }],
    markers: [{ id: 'm-1', at: 32 * SR, label: 'Welcome', number: 1 }, { id: 'm-2', at: 95 * SR, label: 'Guest joins', number: 2 }],
    regions: [{ id: 'r-1', start: 600 * SR, end: 840 * SR, label: 'Ad break', number: 3 }],
    loop: null,
    tempo: { bpm: 120, meter: '4/4' },
    playhead: 0,
    playing: false,
    selection: { clips: [{ track_id: 't-host', clip_id: 'c-host' }], range: null },
    undo: 'Added region Ad break',
    steps: 4,
    media: [
      { id: 'host.wav', name: 'host.wav', sample_rate: SR, channels: 1, frames: 1680 * SR },
      { id: 'guest.wav', name: 'guest.wav', sample_rate: SR, channels: 1, frames: 1560 * SR },
      { id: 'theme.wav', name: 'theme.wav', sample_rate: SR, channels: 2, frames: 32 * SR },
    ],
  }),
  defaultRead: 'session',
  reads: {
    session,
    selection,
    markers: (s) => ({ sample_rate: s.sample_rate, markers: s.markers.map((m) => ({ ...m, at_s: sec(m.at) })), regions: s.regions.map((r) => ({ ...r, start_s: sec(r.start), end_s: sec(r.end) })) }),
    media: (s) => ({ media: s.media.map((m) => ({ ...m, seconds: m.frames / m.sample_rate })) }),
    transport: (s) => ({ playhead_s: sec(s.playhead), playing: s.playing, recording: false, loop: s.loop }),
  },
  apply: 'atomic',
  undo: true,
  step: (s, label) => {
    s.undo = label;
    s.steps += 1;
  },
  applyExtra: (s) => ({ step: s.undo }),
  applyKinds: ['session'],
  runExclude: ['session'],
  runResult: (s, _c, result, mutated) => ({ result, step: mutated ? s.undo : null }),
  cmds: {
    'add-marker': { title: 'Add Marker', kind: 'session', args: { at: 'samples', label: 'string', clipId: 'string?' }, fn: (s, a) => { const id = uid('m-'); s.markers.push({ id, at: num(a.at, 'at'), label: String(a.label ?? ''), number: nextNumber(s) }); s.markers.sort((x, y) => x.at - y.at); return { command: 'add-marker', changed: true, id }; } },
    'set-marker': { title: 'Set Marker', kind: 'session', args: { markerId: 'string', at: 'samples?', label: 'string?', number: 'number?', comment: 'string?', color: 'string?' }, fn: (s, a) => { const m = s.markers.find((x) => x.id === a.markerId) ?? refuse(`there is no marker ${a.markerId}`); set(m, a, [['at', 'at'], ['label', 'label'], ['number', 'number'], ['comment', 'comment'], ['color', 'color']]); return { command: 'set-marker', changed: true }; } },
    'remove-marker': { title: 'Remove Marker', kind: 'session', args: { markerId: 'string' }, fn: (s, a) => { if (!s.markers.some((m) => m.id === a.markerId)) refuse(`there is no marker ${a.markerId}`); s.markers = s.markers.filter((m) => m.id !== a.markerId); return { command: 'remove-marker', changed: true }; } },
    'add-region': { title: 'Add Region', kind: 'session', args: { start: 'samples', end: 'samples', label: 'string' }, fn: (s, a) => { const st = num(a.start, 'start'); const en = num(a.end, 'end'); if (en <= st) invalid('end must be after start'); const id = uid('r-'); s.regions.push({ id, start: st, end: en, label: String(a.label ?? ''), number: nextNumber(s) }); return { command: 'add-region', changed: true, id }; } },
    'set-region': { title: 'Set Region', kind: 'session', args: { regionId: 'string', start: 'samples?', end: 'samples?', label: 'string?' }, fn: (s, a) => { const r = s.regions.find((x) => x.id === a.regionId) ?? refuse(`there is no region ${a.regionId}`); set(r, a, [['start', 'start'], ['end', 'end'], ['label', 'label'], ['number', 'number']]); return { command: 'set-region', changed: true }; } },
    'remove-region': { title: 'Remove Region', kind: 'session', args: { regionId: 'string' }, fn: (s, a) => { s.regions = s.regions.filter((r) => r.id !== a.regionId); return { command: 'remove-region', changed: true }; } },
    'set-loop': { title: 'Set Loop', kind: 'session', args: { start: 'samples', end: 'samples', enabled: 'boolean' }, fn: (s, a) => ((s.loop = { start: num(a.start, 'start'), end: num(a.end, 'end'), enabled: a.enabled !== false }), { command: 'set-loop', changed: true }) },
    'add-track': { title: 'Add Track', kind: 'session', args: { name: 'string?', channels: 'number?' }, fn: (s, a) => { const id = uid('t-'); s.tracks.push({ id, name: a.name ?? `Track ${s.tracks.length + 1}`, gain_db: 0, pan: 0, mute: false, solo: false, output: 'master', sends: [], effects: [], clips: [] }); return { command: 'add-track', changed: true, id }; } },
    'rename-track': { title: 'Rename Track', kind: 'session', args: { trackId: 'string', name: 'string' }, fn: (s, a) => ((trk(s, a.trackId).name = String(a.name)), { command: 'rename-track', changed: true }) },
    'set-track-gain': { title: 'Track Gain', kind: 'session', args: { trackId: 'string', gainDb: 'dB' }, fn: (s, a) => ((trk(s, a.trackId).gain_db = num(a.gainDb, 'gainDb')), { command: 'set-track-gain', changed: true }) },
    'set-track-pan': { title: 'Track Pan', kind: 'session', args: { trackId: 'string', pan: '-1..1' }, fn: (s, a) => ((trk(s, a.trackId).pan = Math.max(-1, Math.min(1, num(a.pan, 'pan')))), { command: 'set-track-pan', changed: true }) },
    'set-track-mute': { title: 'Track Mute', kind: 'session', args: { trackId: 'string', mute: 'boolean' }, fn: (s, a) => ((trk(s, a.trackId).mute = Boolean(a.mute)), { command: 'set-track-mute', changed: true }) },
    'set-track-solo': { title: 'Track Solo', kind: 'session', args: { trackId: 'string', solo: 'boolean', exclusive: 'boolean?' }, fn: (s, a) => { const t = trk(s, a.trackId); if (a.exclusive) s.tracks.forEach((x) => (x.solo = false)); t.solo = Boolean(a.solo); return { command: 'set-track-solo', changed: true }; } },
    'set-track-color': { title: 'Track Colour', kind: 'session', args: { trackId: 'string', color: 'string' }, fn: (s, a) => ((trk(s, a.trackId).color = String(a.color)), { command: 'set-track-color', changed: true }) },
    'move-clip': { title: 'Move Clip', kind: 'session', args: { trackId: 'string', clipId: 'string', start: 'samples' }, fn: (s, a) => ((clp(s, a.trackId, a.clipId).start = num(a.start, 'start')), { command: 'move-clip', changed: true }) },
    'split-clip': { title: 'Split Clip', kind: 'session', args: { trackId: 'string', clipId: 'string', at: 'samples' }, fn: (s, a) => { const c = clp(s, a.trackId, a.clipId); const at = num(a.at, 'at'); if (at <= c.start || at >= c.start + c.length) refuse(`the split point is not inside clip ${c.id}`); const id = uid('c-'); trk(s, a.trackId).clips.push({ ...c, id, start: at, length: c.start + c.length - at }); c.length = at - c.start; return { command: 'split-clip', changed: true, id }; } },
    'rename-clip': { title: 'Rename Clip', kind: 'session', args: { trackId: 'string', clipId: 'string', name: 'string' }, fn: (s, a) => ((clp(s, a.trackId, a.clipId).media = String(a.name)), { command: 'rename-clip', changed: true }) },
    'set-clip-gain': { title: 'Clip Gain', kind: 'session', args: { trackId: 'string', clipId: 'string', gainDb: 'dB' }, fn: (s, a) => ((clp(s, a.trackId, a.clipId).gain_db = num(a.gainDb, 'gainDb')), { command: 'set-clip-gain', changed: true }) },
    'set-clip-fades': { title: 'Clip Fades', kind: 'session', args: { trackId: 'string', clipId: 'string', fadeIn: 'samples', fadeOut: 'samples' }, fn: (s, a) => { const c = clp(s, a.trackId, a.clipId); c.fade_in = num(a.fadeIn, 'fadeIn'); c.fade_out = num(a.fadeOut, 'fadeOut'); return { command: 'set-clip-fades', changed: true }; } },
    'remove-clip': { title: 'Remove Clip', kind: 'session', args: { trackId: 'string', clipId: 'string' }, fn: (s, a) => { const t = trk(s, a.trackId); clp(s, a.trackId, a.clipId); t.clips = t.clips.filter((c) => c.id !== a.clipId); s.selection.clips = s.selection.clips.filter((x) => x.clip_id !== a.clipId); return { command: 'remove-clip', changed: true }; } },
    'set-tempo': { title: 'Set Tempo', kind: 'session', args: { bpm: 'number', beatsPerBar: 'number' }, fn: (s, a) => { s.tempo = { bpm: num(a.bpm, 'bpm'), meter: `${Number(a.beatsPerBar ?? 4)}/4` }; return { command: 'set-tempo', changed: true }; } },
    'session.add-marker': { title: 'Add Marker at Time', group: 'Session', args: { at_s: 'seconds', label: 'string' }, fn: (s, a) => { const id = uid('m-'); s.markers.push({ id, at: Math.round(num(a.at_s, 'at_s') * SR), label: String(a.label ?? ''), number: nextNumber(s) }); return { id }; } },
    'session.set-loop': { title: 'Set Loop Range', group: 'Session', args: { start_s: 'seconds', end_s: 'seconds' }, fn: (s, a) => ((s.loop = { start: Math.round(num(a.start_s, 'start_s') * SR), end: Math.round(num(a.end_s, 'end_s') * SR), enabled: true }), {}) },
    'session.get-session-state': { title: 'Get Session State', group: 'Session', fn: (s) => session(s) },
    'session.analyze-clip': { title: 'Analyze Clip', group: 'Session', args: { track_id: 'string', clip_id: 'string' }, fn: (s, a) => { clp(s, a.track_id, a.clip_id); return { peak_db: -1.2, rms_db: -18.4, dc_offset: 0.0003, clipped_samples: 0 }; } },
    'session.get-transcript': { title: 'Get Transcript', group: 'Session', args: { max_words: 'number?' }, fn: () => ({ words: [{ w: 'Welcome', start_s: 32.1, end_s: 32.6, speaker: 'Host' }, { w: 'back', start_s: 32.6, end_s: 32.9, speaker: 'Host' }, { w: 'to', start_s: 32.9, end_s: 33.0, speaker: 'Host' }, { w: 'Harbour', start_s: 33.0, end_s: 33.5, speaker: 'Host' }, { w: 'stories.', start_s: 33.5, end_s: 34.1, speaker: 'Host' }] }) },
    'session.mark-speech': { title: 'Mark Speech', group: 'Session', args: { track_id: 'string', clip_id: 'string' }, fn: (s, a) => { const c = clp(s, a.track_id, a.clip_id); const id = uid('r-'); s.regions.push({ id, start: c.start + 2 * SR, end: c.start + 40 * SR, label: 'Speech', number: nextNumber(s) }); return { regions: [id] }; } },
    'transport.play-or-pause': { title: 'Play or Pause', group: 'Transport', fn: (s) => ((s.playing = !s.playing), {}) },
    'transport.stop': { title: 'Stop', group: 'Transport', fn: (s) => ((s.playing = false), {}) },
    'file.save': { title: 'Save', group: 'File', fn: () => ({ saved: true }) },
  },
  changed: (p, n) => {
    const out = [];
    const strip = (x: State) => JSON.stringify({ ...x, playing: 0, playhead: 0, selection: 0 });
    if (strip(p) !== strip(n)) out.push({ name: 'document.changed', data: { undo: n.undo, steps: n.steps } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: { clips: n.selection.clips.map((c) => c.clip_id), range: selection(n).range } });
    if (p.playing !== n.playing) out.push({ name: 'transport.changed', data: { playing: n.playing, recording: false, playhead_s: sec(n.playhead) } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'after any change to the session', sample: (s) => ({ undo: s.undo, steps: s.steps }) },
    { name: 'selection.changed', note: 'selected clips or time range changed', sample: (s) => ({ clips: s.selection.clips.map((c) => c.clip_id), range: { track_id: 't-host', start: 96000, end: 192000, start_s: 2, end_s: 4 } }) },
    { name: 'transport.changed', note: 'playback or recording starts or stops', sample: () => ({ playing: true, recording: false, playhead_s: 12.5 }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: true, notes: ['files.save: a save dialog where there is one, otherwise a download', 'net.fetch: through the engine, https only'] },
  tokens: { '--bg-primary': '--bg', '--bg-secondary': '--panel', '--bg-tertiary': '--panel', '--text-primary': '--text', '--text-secondary': '--muted', '--accent-color': '--accent', '--border-color': '--border', '--font-ui': 'Inter, system-ui, sans-serif', '--font-mono': 'JetBrains Mono, monospace' },
  view: (s) => {
    const len = Math.max(1, ...s.tracks.flatMap((t) => t.clips.map((c) => c.start + c.length)));
    const pos = (x: number) => `${(x / len) * 100}%`;
    return `<div class="sim-tl">${s.tracks.map((t) => `<div class="sim-track"><span class="sim-k">${esc(t.name)} ${t.gain_db} dB${t.mute ? ' M' : ''}</span><div class="sim-lane">${t.clips.map((c) => `<span class="sim-clip${s.selection.clips.some((x) => x.clip_id === c.id) ? ' on' : ''}" style="left:${pos(c.start)};width:${pos(c.length)}">${esc(c.media)}</span>`).join('')}</div></div>`).join('')}<div class="sim-track"><span class="sim-k">Markers</span><div class="sim-lane">${s.markers.map((m) => `<span class="sim-marker" style="left:${pos(m.at)}" title="${esc(m.label)} at ${sec(m.at)} s"></span>`).join('')}${s.regions.map((r) => `<span class="sim-region" style="left:${pos(r.start)};width:${pos(r.end - r.start)}" title="${esc(r.label)}"></span>`).join('')}</div></div></div><div class="sim-m">${s.markers.length} markers, ${s.regions.length} regions, last step: ${esc(s.undo)}</div>`;
  },
  samples: ['episode.wav', 'chapters.json'],
};

export default sim;
