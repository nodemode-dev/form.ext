import { formext } from './formext.js';
import { $, esc, fill, status, errorText, debounce, headless, plural } from './kit.js';

function audioClips(doc) {
  return (doc.timeline?.tracks ?? []).flatMap((t) => (t.clips ?? []).filter((c) => c.kind === 'audio' || c.kind === 'video').map((c) => ({ ...c, track: t.name })));
}

async function markBeats(clip, { sensitivity = 0.5, bars = false } = {}) {
  const analysis = (await formext.run('media.beats', { mediaId: clip.mediaId, sensitivity })) ?? {};
  const every = bars ? Math.max(1, Number(analysis.bar) || 4) : 1;
  const speed = clip.speed || 1;
  const times = (analysis.beats ?? [])
    .filter((_, i) => i % every === 0)
    .map((b) => clip.start + (b - (clip.sourceIn ?? 0)) / speed)
    .filter((t) => t >= clip.start && t <= clip.start + clip.duration);
  if (!times.length) throw new Error('No beats were found inside the clip.');
  await formext.apply('Beat markers', times.map((t, i) => ({ command: 'marker.add', args: { t, note: bars ? `Bar ${i + 1}` : `Beat ${i + 1}` } })));
  return { markers: times.length, bpm: analysis.bpm ?? null };
}

async function refresh() {
  try {
    const doc = await formext.readDocument('project');
    const clips = audioClips(doc);
    const selected = doc.selection?.clipId;
    const keep = $('#clip').value || selected || '';
    fill($('#sub'), `${esc(doc.project?.title ?? '')}, ${plural(clips.length, 'clip')} with sound`);
    fill($('#clip'), clips.map((c) => `<option value="${esc(c.id)}"${c.id === keep ? ' selected' : ''}>${esc(c.label)} (${esc(c.track)}, ${c.start.toFixed(1)} s)</option>`).join('') || '<option value="">No clips with sound</option>');
    $('#mark').disabled = !clips.length;
  } catch (err) {
    status(errorText(err), 'error');
  }
}

$('#mark').addEventListener('click', async () => {
  try {
    const doc = await formext.readDocument('project');
    const clip = audioClips(doc).find((c) => c.id === $('#clip').value);
    if (!clip) return status('Choose a clip first.');
    status('Listening for beats');
    const r = await markBeats(clip, { sensitivity: Number($('#sensitivity').value), bars: $('#bars').checked });
    status(`${plural(r.markers, 'marker')} added${r.bpm ? `, ${Math.round(r.bpm)} BPM` : ''}`, 'success');
  } catch (err) {
    status(errorText(err), 'error');
  }
});

headless(async () => {
  const doc = await formext.readDocument('project');
  const clip = audioClips(doc).find((c) => c.id === doc.selection?.clipId);
  if (!clip) throw new Error('Select a music clip on the timeline first.');
  const r = await markBeats(clip);
  await formext.notify(`${plural(r.markers, 'beat marker')} added`, 'success');
  return r;
}, refresh);

const later = debounce(refresh, 150);
formext.onEvent(({ name }) => {
  if (name === 'document.changed' || name === 'selection.changed') later();
});

await formext.hello();
refresh();
