import type { AppSim, Json } from '../types';
import { refuse, invalid, need, num, uid, esc, HostError, ERR } from '../util';

interface Clip { id: string; kind: string; label: string; start: number; duration: number; mediaId?: string; sourceIn?: number; speed?: number; muted?: boolean; volume?: number; text?: string; transition?: Json; transform?: Json; colour?: Json }
interface Track { index: number; id: string; name: string; locked: boolean; hidden: boolean; muted: boolean; magnetic: boolean; clips: Clip[] }
interface State {
  project: Json;
  timeline: { index: number; count: number; id: string; name: string; width: number; height: number; fps: number; tracks: Track[]; markers: { id: string; t: number; note: string; colour: string | null }[] };
  selection: { clipId: string | null; clipIds: string[]; range: { start: number; end: number } | null };
  media: { id: string; name: string; kind: string; duration: number; width: number; height: number; fps: number }[];
}

function track(s: State, i: unknown): Track {
  const t = s.timeline.tracks[num(i, 'trackIndex')];
  if (!t) refuse(`there is no track ${i}`);
  if (t.locked) refuse(`track ${t.name} is locked`);
  return t;
}

function clip(s: State, id: unknown): { c: Clip; t: Track } {
  for (const t of s.timeline.tracks) {
    const c = t.clips.find((x) => x.id === id);
    if (c) {
      if (t.locked) refuse(`track ${t.name} is locked`);
      return { c, t };
    }
  }
  refuse(`there is no clip ${String(id)}`);
}

function duration(s: State) {
  s.project.duration = Math.max(0, ...s.timeline.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)));
}

function summary(s: State, c: Clip) {
  return { ...c };
}

const edit = 'edit';
const sim: AppSim<State> = {
  product: 'formcut',
  app: 'formcut',
  appVersion: '2.14.0',
  docLabel: 'Project',
  title: (s) => s.project.title,
  initial: () => ({
    project: { id: null, title: 'Harbour short', revision: null, saved: false, width: 1920, height: 1080, fps: 30, aspect: '16:9', duration: 24, playhead: 0, playing: false },
    timeline: {
      index: 0, count: 1, id: 'tl-main', name: 'Timeline 1', width: 1920, height: 1080, fps: 30,
      tracks: [
        { index: 0, id: 't-text', name: 'Text', locked: false, hidden: false, muted: false, magnetic: false, clips: [{ id: 'c4', kind: 'text', label: 'Title', text: 'The harbour at dusk', start: 1, duration: 4 }] },
        { index: 1, id: 't-video', name: 'Video', locked: false, hidden: false, muted: false, magnetic: false, clips: [
          { id: 'c1', kind: 'video', label: 'wide-pier.mp4', start: 0, duration: 8, mediaId: 'm1', sourceIn: 2, speed: 1, muted: false, volume: 1 },
          { id: 'c2', kind: 'video', label: 'boats-close.mp4', start: 8, duration: 6, mediaId: 'm2', sourceIn: 0, speed: 1, muted: false, volume: 1 },
          { id: 'c3', kind: 'image', label: 'lighthouse.jpg', start: 14, duration: 10, mediaId: 'm3', sourceIn: 0, speed: 1, muted: false, volume: 1 },
        ] },
        { index: 2, id: 't-audio', name: 'Audio', locked: false, hidden: false, muted: false, magnetic: false, clips: [{ id: 'c5', kind: 'audio', label: 'song.wav', start: 0, duration: 24, mediaId: 'm4', sourceIn: 0, speed: 1, muted: false, volume: 0.8 }] },
      ],
      markers: [{ id: '4f0c', t: 8, note: 'cut to boats', colour: null }],
    },
    selection: { clipId: 'c1', clipIds: ['c1'], range: null },
    media: [
      { id: 'm1', name: 'wide-pier.mp4', kind: 'video', duration: 14.2, width: 1920, height: 1080, fps: 30 },
      { id: 'm2', name: 'boats-close.mp4', kind: 'video', duration: 9.5, width: 1920, height: 1080, fps: 30 },
      { id: 'm3', name: 'lighthouse.jpg', kind: 'image', duration: 0, width: 3000, height: 2000, fps: 0 },
      { id: 'm4', name: 'song.wav', kind: 'audio', duration: 31.4, width: 0, height: 0, fps: 0 },
    ],
  }),
  defaultRead: 'project',
  reads: {
    project: (s) => ({ product: 'formcut', what: 'project', project: s.project, timeline: s.timeline, selection: s.selection, media: s.media }),
    timeline: (s) => ({ product: 'formcut', what: 'timeline', timeline: s.timeline }),
    selection: (s) => ({ product: 'formcut', what: 'selection', selection: s.selection, clips: s.selection.clipIds.map((id) => s.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === id)).filter(Boolean).map((c) => summary(s, c as Clip)) }),
    media: (s) => ({ product: 'formcut', what: 'media', media: s.media }),
    markers: (s) => ({ product: 'formcut', what: 'markers', markers: s.timeline.markers }),
    full: (s) => ({ product: 'formcut', what: 'full', state: { project: s.project, timelines: [s.timeline], selection: s.selection }, media: s.media }),
  },
  applyKinds: [edit],
  apply: 'atomic',
  undo: true,
  unknownCommand: (id) => ({ code: ERR.INVALID, message: `formcut has no command ${id}` }),
  catalogue: (id, c) => ({ id, title: c.title, args: c.args, kind: c.kind }),
  cmds: {
    'marker.add': { title: 'Add Marker', kind: edit, args: { t: 'seconds', note: 'string?', colour: 'string?' }, fn: (s, a) => { const id = uid('mk'); s.timeline.markers.push({ id, t: num(a.t, 't'), note: String(a.note ?? ''), colour: a.colour ?? null }); s.timeline.markers.sort((x, y) => x.t - y.t); return { markerId: id }; } },
    'marker.update': { title: 'Update Marker', kind: edit, args: { id: 'string', t: 'seconds?', note: 'string?', colour: 'string?' }, fn: (s, a) => { const m = s.timeline.markers.find((x) => x.id === a.id) ?? refuse(`there is no marker ${a.id}`); Object.assign(m, Object.fromEntries(['t', 'note', 'colour'].filter((k) => a[k] !== undefined).map((k) => [k, a[k]]))); return {}; } },
    'marker.remove': { title: 'Remove Marker', kind: edit, args: { id: 'string' }, fn: (s, a) => { if (!s.timeline.markers.some((m) => m.id === a.id)) refuse(`there is no marker ${a.id}`); s.timeline.markers = s.timeline.markers.filter((m) => m.id !== a.id); return {}; } },
    'clip.add': { title: 'Add Clip', kind: edit, args: { trackIndex: 'number', mediaId: 'string', start: 'seconds', duration: 'seconds?', sourceIn: 'seconds?', label: 'string?' }, fn: (s, a) => { const t = track(s, a.trackIndex); const m = s.media.find((x) => x.id === a.mediaId) ?? refuse(`there is no media ${a.mediaId}`); const id = uid('c'); t.clips.push({ id, kind: m.kind, label: a.label ?? m.name, start: num(a.start, 'start'), duration: Number(a.duration ?? (m.duration || 5)), mediaId: m.id, sourceIn: Number(a.sourceIn ?? 0), speed: 1, muted: false, volume: 1 }); duration(s); return { clipId: id }; } },
    'text.add': { title: 'Add Title', kind: edit, args: { trackIndex: 'number', start: 'seconds', duration: 'seconds', text: 'string' }, fn: (s, a) => { need(a, 'text'); const t = track(s, a.trackIndex); const id = uid('c'); t.clips.push({ id, kind: 'text', label: String(a.text).slice(0, 24), text: String(a.text), start: num(a.start, 'start'), duration: num(a.duration, 'duration') }); duration(s); return { clipId: id }; } },
    'captions.add': { title: 'Add Captions', kind: edit, args: { trackIndex: 'number', cues: '[{ start, end, text }]' }, fn: (s, a) => { if (!Array.isArray(a.cues)) invalid('cues must be a list'); const t = track(s, a.trackIndex); const ids = a.cues.map((q: Json) => { const id = uid('c'); t.clips.push({ id, kind: 'text', label: String(q.text).slice(0, 24), text: String(q.text), start: num(q.start, 'start'), duration: num(q.end, 'end') - num(q.start, 'start') }); return id; }); duration(s); return { clipIds: ids }; } },
    'clip.remove': { title: 'Remove Clip', kind: edit, args: { clipId: 'string' }, fn: (s, a) => { const { c, t } = clip(s, a.clipId); t.clips = t.clips.filter((x) => x !== c); duration(s); return {}; } },
    'clip.split': { title: 'Split Clip', kind: edit, args: { clipId: 'string', time: 'seconds' }, fn: (s, a) => { const { c, t } = clip(s, a.clipId); const at = num(a.time, 'time'); if (at <= c.start || at >= c.start + c.duration) refuse(`${at} s is not inside ${c.label}`); const id = uid('c'); const tail = { ...c, id, start: at, duration: c.start + c.duration - at, sourceIn: (c.sourceIn ?? 0) + at - c.start }; c.duration = at - c.start; t.clips.push(tail); return { clipId: id }; } },
    'clip.move': { title: 'Move Clip', kind: edit, args: { clipId: 'string', start: 'seconds', trackIndex: 'number?' }, fn: (s, a) => { const { c, t } = clip(s, a.clipId); c.start = num(a.start, 'start'); if (a.trackIndex !== undefined) { const to = track(s, a.trackIndex); t.clips = t.clips.filter((x) => x !== c); to.clips.push(c); } duration(s); return {}; } },
    'clip.trim': { title: 'Trim Clip', kind: edit, args: { clipId: 'string', start: 'seconds', duration: 'seconds' }, fn: (s, a) => { const { c } = clip(s, a.clipId); c.start = num(a.start, 'start'); c.duration = num(a.duration, 'duration'); duration(s); return {}; } },
    'clip.mute': { title: 'Mute Clip', kind: edit, args: { clipId: 'string', muted: 'boolean' }, fn: (s, a) => ((clip(s, a.clipId).c.muted = Boolean(a.muted)), {}) },
    'clip.transition': { title: 'Set Transition', kind: edit, args: { clipId: 'string', type: 'crossfade|dissolve|...|null', duration: 'seconds' }, fn: (s, a) => ((clip(s, a.clipId).c.transition = a.type ? { type: a.type, duration: Number(a.duration ?? 0.5) } : undefined), {}) },
    'clip.transform': { title: 'Transform Clip', kind: edit, args: { clipId: 'string', patch: '{ scale?, posX?, posY?, rotation?, opacity? }' }, fn: (s, a) => { const { c } = clip(s, a.clipId); c.transform = { ...(c.transform ?? {}), ...(a.patch ?? {}) }; return {}; } },
    'clip.colour': { title: 'Colour Clip', kind: edit, args: { clipId: 'string', colour: '{ exposure?, contrast?, saturation?, ... } | null' }, fn: (s, a) => ((clip(s, a.clipId).c.colour = a.colour ?? undefined), {}) },
    'clip.text': { title: 'Edit Title', kind: edit, args: { clipId: 'string', patch: '{ content?, size?, color?, bold?, align? }' }, fn: (s, a) => { const { c } = clip(s, a.clipId); if (c.kind !== 'text') refuse(`${c.label} is not a text clip`); if (a.patch?.content !== undefined) c.text = String(a.patch.content); return {}; } },
    'track.add': { title: 'Add Track', kind: edit, args: { name: 'string?' }, fn: (s, a) => { const index = s.timeline.tracks.length; s.timeline.tracks.push({ index, id: uid('t-'), name: a.name ?? `Track ${index + 1}`, locked: false, hidden: false, muted: false, magnetic: false, clips: [] }); return { trackIndex: index }; } },
    'track.update': { title: 'Update Track', kind: edit, args: { index: 'number', patch: '{ name?, locked?, hidden?, muted?, magnetic? }' }, fn: (s, a) => { const t = s.timeline.tracks[num(a.index, 'index')] ?? refuse(`there is no track ${a.index}`); Object.assign(t, a.patch ?? {}); return {}; } },
    'timeline.cut-range': { title: 'Cut Range', kind: edit, args: { start: 'seconds', end: 'seconds' }, fn: (s, a) => { const st = num(a.start, 'start'); const en = num(a.end, 'end'); const gap = en - st; for (const t of s.timeline.tracks) { t.clips = t.clips.filter((c) => !(c.start >= st && c.start + c.duration <= en)); for (const c of t.clips) if (c.start >= en) c.start -= gap; } duration(s); return {}; } },
    'project.rename': { title: 'Rename Project', kind: edit, args: { title: 'string' }, fn: (s, a) => ((s.project.title = String(a.title)), {}) },
    'transport.seek': { title: 'Seek', kind: 'view', args: { time: 'seconds' }, fn: (s, a) => ((s.project.playhead = num(a.time, 'time')), {}) },
    'transport.play': { title: 'Play', kind: 'view', fn: (s) => ((s.project.playing = true), {}) },
    'transport.pause': { title: 'Pause', kind: 'view', fn: (s) => ((s.project.playing = false), {}) },
    'clip.select': { title: 'Select Clip', kind: 'view', args: { clipId: 'string|null' }, fn: (s, a) => { if (a.clipId) clip(s, a.clipId); s.selection.clipId = a.clipId ?? null; s.selection.clipIds = a.clipId ? [a.clipId] : []; return {}; } },
    'clips.select': { title: 'Select Clips', kind: 'view', args: { clipIds: 'string[]' }, fn: (s, a) => { s.selection.clipIds = [...(a.clipIds ?? [])]; s.selection.clipId = s.selection.clipIds[0] ?? null; return {}; } },
    'range.set': { title: 'Set Range', kind: 'view', args: { start: 'seconds', end: 'seconds' }, fn: (s, a) => ((s.selection.range = { start: num(a.start, 'start'), end: num(a.end, 'end') }), {}) },
    'range.clear': { title: 'Clear Range', kind: 'view', fn: (s) => ((s.selection.range = null), {}) },
    'media.beats': { title: 'Find Beats', kind: 'analysis', args: { mediaId: 'string', sensitivity: 'number?' }, fn: (s, a) => { const m = s.media.find((x) => x.id === a.mediaId) ?? refuse(`there is no media ${a.mediaId}`); if (m.kind === 'image') refuse(`${m.name} has no sound`); const beats = Array.from({ length: Math.floor(m.duration * 2) }, (_, i) => +(0.24 + i * 0.5).toFixed(3)); return { beats, bpm: 120, bar: 4, first_beat: 0.24, final_hit: beats.at(-1) }; } },
    'media.scenes': { title: 'Find Scenes', kind: 'analysis', args: { mediaId: 'string', sensitivity: 'number?' }, fn: (s, a) => { const m = s.media.find((x) => x.id === a.mediaId) ?? refuse(`there is no media ${a.mediaId}`); if (m.kind !== 'video') refuse(`${m.name} is not a video`); return { cuts: [3.2, 7.9, 11.4].filter((t) => t < m.duration) }; } },
    'media.ducking': { title: 'Ducking Envelope', kind: 'analysis', args: { mediaId: 'string', depth: 'number?' }, fn: () => ({ envelope: [[0, 1], [1.2, 0.4], [5, 0.4], [5.6, 1]] }) },
  },
  changed: (p, n) => {
    const out = [];
    const docP = JSON.stringify([p.timeline, p.project.title, p.media]);
    const docN = JSON.stringify([n.timeline, n.project.title, n.media]);
    if (docP !== docN) out.push({ name: 'document.changed', data: { changed: JSON.stringify(p.timeline.tracks) !== JSON.stringify(n.timeline.tracks) ? 'clips' : p.project.title !== n.project.title ? 'project' : 'timeline' } });
    if (JSON.stringify(p.selection) !== JSON.stringify(n.selection)) out.push({ name: 'selection.changed', data: { clipId: n.selection.clipId, clipIds: n.selection.clipIds } });
    if (p.project.playing !== n.project.playing || p.project.playhead !== n.project.playhead) out.push({ name: 'transport.changed', data: { playing: n.project.playing, playhead: n.project.playhead } });
    return out;
  },
  events: [
    { name: 'document.changed', note: 'after any edit, undo or redo', sample: () => ({ changed: 'clips' }) },
    { name: 'selection.changed', note: 'the clip selection changes', sample: (s) => ({ clipId: s.selection.clipId, clipIds: s.selection.clipIds }) },
    { name: 'transport.changed', note: 'play, pause or a seek', sample: (s) => ({ playing: s.project.playing, playhead: s.project.playhead }) },
  ],
  offers: { filesOpen: true, filesSave: true, fetch: true, notes: ['files.open and files.save: the system dialogs', 'net.fetch: through the engine, https only, 50 MB'] },
  tokens: { '--accent-text': '#ffffff', '--danger': '#e5484d', '--float': '--panel', '--control': '--border', '--font-ui': 'Inter, system-ui, sans-serif', '--font-mono': 'JetBrains Mono, monospace' },
  view: (s) => {
    const len = Math.max(1, s.project.duration);
    return `<div class="sim-tl">${s.timeline.tracks.map((t) => `<div class="sim-track"><span class="sim-k">${esc(t.name)}${t.locked ? ' (locked)' : ''}</span><div class="sim-lane">${t.clips.map((c) => `<span class="sim-clip${s.selection.clipIds.includes(c.id) ? ' on' : ''}" style="left:${(c.start / len) * 100}%;width:${(c.duration / len) * 100}%" title="${esc(c.label)} ${c.start}s +${c.duration}s">${esc(c.text ?? c.label)}</span>`).join('')}</div></div>`).join('')}<div class="sim-track"><span class="sim-k">Markers</span><div class="sim-lane">${s.timeline.markers.map((m) => `<span class="sim-marker" style="left:${(m.t / len) * 100}%" title="${esc(m.note)} at ${m.t}s"></span>`).join('')}</div></div></div><div class="sim-m">${s.project.duration.toFixed(1)} s, playhead ${s.project.playhead} s${s.project.playing ? ', playing' : ''}, ${s.timeline.markers.length} markers</div>`;
  },
  samples: ['song.wav', 'shots.csv', 'photo.png'],
};

export default sim;
