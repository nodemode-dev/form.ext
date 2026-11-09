import { start } from '../../frontend/src/demo/engine/ready';
import { seed, resetDemo, SAMPLE } from '../../frontend/src/demo/engine/seed';
import { catchDownloads } from '../../frontend/src/demo/downloads';
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

catchDownloads();

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
