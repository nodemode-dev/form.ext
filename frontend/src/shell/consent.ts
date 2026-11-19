import { api } from './api';
import { on } from './events';

interface Ask {
  id: string;
  tool: string;
  title: string;
  project: string;
}

let scrim: HTMLElement;
let box: HTMLElement;
let lead: HTMLElement;
let note: HTMLElement;
let allowBtn: HTMLButtonElement;
let current: Ask | null = null;
let busy = false;
let again = false;
let returnFocus: Element | null = null;

function text(ask: Ask): string {
  const where = ask.project ? ` in the project ${ask.project}` : '';
  return `An outside agent connected to form.ext asks to run ${ask.title} (${ask.tool})${where}. Allow once lets this one call run. Always allow lets outside agents change projects without asking; you can change that in Settings, Developer, Outside agents.`;
}

function show(ask: Ask): void {
  current = ask;
  lead.textContent = text(ask);
  if (!box.classList.contains('open')) {
    returnFocus = document.activeElement;
    box.classList.add('open');
    scrim.classList.add('open');
  }
  allowBtn.focus();
}

function hide(): void {
  current = null;
  if (!box.classList.contains('open')) return;
  box.classList.remove('open');
  scrim.classList.remove('open');
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
}

async function refresh(): Promise<void> {
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  try {
    const got = await api.get<{ requests: Ask[]; sealReset?: boolean }>('/api/agents/requests');
    noteSealReset(!!got.sealReset);
    const next = got.requests.find((r) => r.id === current?.id) ?? got.requests[0];
    if (next) show(next);
    else hide();
  } catch {
    hide();
  } finally {
    busy = false;
    if (again) {
      again = false;
      void refresh();
    }
  }
}

async function answer(choice: 'deny' | 'once' | 'always'): Promise<void> {
  const ask = current;
  if (!ask) return;
  hide();
  try {
    await api.post(`/api/agents/requests/${encodeURIComponent(ask.id)}`, { answer: choice });
  } catch {
    return;
  } finally {
    void refresh();
  }
}

export function noteSealReset(reset: boolean): void {
  note.hidden = !reset;
}

export function mountConsent(): void {
  scrim = document.querySelector<HTMLElement>('.fx-consent-scrim')!;
  box = document.querySelector<HTMLElement>('.fx-consent')!;
  lead = box.querySelector<HTMLElement>('[data-role="lead"]')!;
  note = box.querySelector<HTMLElement>('[data-role="note"]')!;
  allowBtn = box.querySelector<HTMLButtonElement>('[data-answer="once"]')!;
  for (const b of box.querySelectorAll<HTMLButtonElement>('[data-answer]')) {
    b.addEventListener('click', () => void answer(b.dataset.answer as 'deny' | 'once' | 'always'));
  }
  box.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      void answer('deny');
    }
  });
  on('window.admitted', () => void refresh());
  on('agents.ask', () => void refresh());
  on('agents.answered', (d: { id?: string } | null) => {
    if (current && d?.id === current.id) void refresh();
  });
  on('settings.changed', (s: { agentAccessReset?: boolean } | null) => noteSealReset(!!s?.agentAccessReset));
}
