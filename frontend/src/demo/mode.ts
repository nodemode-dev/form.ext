export const DEMO_FLAG = 'formext.demo';
export const DEMO_PREFIX = 'formext.demo.';

export interface DemoDef {
  id: string;
  title: string;
  line: string;
}

export const DEMOS: DemoDef[] = [
  { id: 'studio', title: 'The Studio with Sample Projects', line: 'Golden Hour, Mail Merge and Rating Desk in a sample workspace: edit, preview, check, package and sign without touching your projects or keys.' },
];

export function demoMode(): boolean {
  return document.documentElement.dataset.demo === 'studio';
}

export function pageDemo(): boolean {
  return document.documentElement.dataset.demo === 'page';
}

function session(fn: (s: Storage) => void): void {
  try {
    fn(sessionStorage);
  } catch {
    return;
  }
}

export function clearDemoData(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(DEMO_PREFIX)) localStorage.removeItem(k);
  } catch {
    return;
  }
}

function reloadHome(): void {
  history.replaceState(null, '', `${location.pathname}${location.search}#/home`);
  location.reload();
}

export function enterDemo(id: string): void {
  clearDemoData();
  session((s) => s.setItem(DEMO_FLAG, id));
  reloadHome();
}

export function leaveDemo(): void {
  session((s) => s.removeItem(DEMO_FLAG));
  clearDemoData();
  reloadHome();
}
