import { register, run } from '../shell/commands';
import { confirm } from '../shell/dialog';
import { notify } from '../shell/toast';
import { DEMOS, demoMode, enterDemo, leaveDemo, pageDemo } from './mode';

function unsaved(): boolean {
  const ev = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(ev);
  return ev.defaultPrevented;
}

async function settled(): Promise<boolean> {
  if (!unsaved()) return true;
  if (!(await confirm('Save your files first?', 'Some open files have unsaved changes. Save All writes them to their project, then the window changes.', 'Save All'))) return false;
  await run('edit.save-all');
  if (!unsaved()) return true;
  notify('Some files could not be saved, so the window stays as it is.', 'warning');
  return false;
}

export async function openDemo(id: string): Promise<void> {
  const def = DEMOS.find((d) => d.id === id);
  if (!def) return;
  if (demoMode()) {
    if (!(await confirm('Start the demo over?', 'The sample projects go back to how they started. What you made or changed in the demo is removed.', 'Start Over'))) return;
  } else if (!(await confirm(`Open the demo: ${def.title}?`, 'The window switches to a sample workspace with its own projects, keys and a simulated FormPortal folder. Nothing in it reaches your projects folder, your keys or your apps. Leave the demo from the Demo button in the title bar or the Help menu.', 'Open Demo'))) return;
  if (!(await settled())) return;
  enterDemo(id);
}

export async function closeDemo(): Promise<void> {
  if (!demoMode()) return;
  if (!(await confirm('Leave the demo?', 'The sample projects and everything made in the demo are removed, and your own projects come back.', 'Leave Demo'))) return;
  if (!(await settled())) return;
  leaveDemo();
}

export function registerDemos(): void {
  if (pageDemo()) {
    register({ id: 'demo.studio', title: 'Demo: Start Over with the Sample Projects', icon: 'refresh', run: () => run('demo.reset') });
    return;
  }
  for (const d of DEMOS) register({ id: `demo.${d.id}`, title: `Demo: ${d.title}`, icon: 'play', run: () => openDemo(d.id) });
  if (demoMode()) register({ id: 'demo.leave', title: 'Leave the Demo', icon: 'close', run: closeDemo });
}
