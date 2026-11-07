import { start } from './engine/ready';
import { seed, resetDemo, SAMPLE } from './engine/seed';
import { dispatch } from './engine/router';
import { register } from '../../frontend/src/shell/commands';
import { confirm } from '../../frontend/src/shell/dialog';
import { on } from '../../frontend/src/shell/events';
import { whenIdle } from './api';

try {
  if (!localStorage.getItem('formext.demo.disk') && !localStorage.getItem('formext.project')) localStorage.setItem('formext.project', SAMPLE);
} catch {
  void 0;
}

start(seed);

function save(name: string, data: ArrayBuffer, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

document.addEventListener(
  'click',
  (ev) => {
    const a = (ev.target as HTMLElement | null)?.closest?.('a[href^="/api/"]');
    if (!a) return;
    ev.preventDefault();
    const href = a.getAttribute('href')!;
    const url = new URL(href, 'http://engine.invalid');
    void dispatch({ method: 'GET', path: url.pathname, query: url.searchParams, body: undefined }).then((res) => {
      const body = res.body as { __raw?: Uint8Array; __name?: string } | null;
      if (res.status === 200 && body?.__raw) save(a.getAttribute('download') || body.__name || 'download.formpkg', body.__raw.slice().buffer as ArrayBuffer, 'application/zip');
    });
  },
  true,
);

register({
  id: 'demo.reset',
  title: 'Demo: Start Over with the Sample Projects',
  icon: 'refresh',
  run: async () => {
    if (!(await confirm('Start the demo over?', 'Everything you made or changed in this browser demo is removed, and the sample projects come back.', 'Start Over'))) return;
    resetDemo();
    location.hash = '';
    location.reload();
  },
});

let shown = false;
function reveal(): void {
  if (shown) return;
  shown = true;
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('demo-ready')));
}

let restored = false;
on('shell.project', () => {
  restored = true;
  void whenIdle().then(() => setTimeout(() => whenIdle().then(reveal), 60));
});
window.setTimeout(() => {
  if (!restored) void whenIdle().then(reveal);
}, 1200);
window.setTimeout(reveal, 4000);
