import { esc } from '../../shell';
import type { LogEntry } from '../../sim';

const MAX = 600;
const ERRORS: Record<number, string> = { [-32601]: 'not in API 1', [-32602]: 'invalid params', [-32001]: 'no permission', [-32002]: 'cancelled', [-32003]: 'not available', [-32004]: 'refused' };

export function short(value: unknown, limit = 160): string {
  let text: string;
  try {
    text = JSON.stringify(value, (_k, v) => (typeof v === 'string' && v.length > 80 ? `${v.slice(0, 40)}... (${v.length} chars)` : v)) ?? 'null';
  } catch {
    text = String(value);
  }
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

export function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'string' && v.length > 2000 ? `${v.slice(0, 600)}... (${v.length} chars, base64 or long text cut here)` : v), 2) ?? 'null';
  } catch {
    return String(value);
  }
}

function clock(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export class MessageLog {
  private rows = new Map<number, HTMLElement>();
  private entries = new Map<number, LogEntry>();
  private filter = '';
  private dirs = { in: true, out: true };
  private errorsOnly = false;
  count = 0;

  constructor(private list: HTMLElement, private counter: HTMLElement) {
    list.addEventListener('click', (ev) => {
      const head = (ev.target as HTMLElement).closest('.pv-log-head');
      if (!head) return;
      const row = head.parentElement as HTMLElement;
      const open = row.getAttribute('aria-expanded') !== 'true';
      row.setAttribute('aria-expanded', String(open));
      const detail = row.querySelector('.pv-log-detail') as HTMLElement;
      if (open && !detail.dataset.filled) this.fill(row, detail);
    });
  }

  setFilter(text: string, dirs: { in: boolean; out: boolean }, errorsOnly: boolean) {
    this.filter = text.trim().toLowerCase();
    this.dirs = dirs;
    this.errorsOnly = errorsOnly;
    for (const [id, row] of this.rows) row.hidden = !this.visible(this.entries.get(id) as LogEntry);
  }

  private visible(e: LogEntry): boolean {
    if (!this.dirs[e.dir]) return false;
    if (this.errorsOnly && !e.error) return false;
    if (!this.filter) return true;
    return `${e.method} ${e.frame} ${short(e.params, 400)}`.toLowerCase().includes(this.filter);
  }

  private fill(row: HTMLElement, detail: HTMLElement) {
    const e = this.entries.get(Number(row.dataset.id));
    if (!e) return;
    const answer = e.pending ? '<div class="pv-log-label">Waiting for the answer</div>' : e.error ? `<div class="pv-log-label">Error ${e.error.code} (${esc(ERRORS[e.error.code] ?? 'error')})</div><pre class="code-block">${esc(e.error.message)}</pre>` : `<div class="pv-log-label">${e.dir === 'in' ? 'Host answered' : 'Extension answered'}</div><pre class="code-block">${esc(pretty(e.result))}</pre>`;
    detail.innerHTML = `<div class="pv-log-label">${e.dir === 'in' ? 'Extension sent' : 'Host sent'} ${esc(e.method)}</div><pre class="code-block">${esc(pretty(e.params))}</pre>${answer}`;
    detail.dataset.filled = '1';
  }

  add(e: LogEntry, fresh: boolean) {
    this.entries.set(e.id, e);
    let row = this.rows.get(e.id);
    if (!row) {
      if (!fresh) return;
      row = document.createElement('div');
      row.className = 'pv-log-row';
      row.dataset.id = String(e.id);
      row.dataset.dir = e.dir;
      row.setAttribute('aria-expanded', 'false');
      row.innerHTML = `<button type="button" class="pv-log-head"><span class="pv-log-time">${clock(e.at)}</span><span class="pv-log-dir" title="${e.dir === 'in' ? 'extension to host' : 'host to extension'}">${e.dir === 'in' ? '&rarr;' : '&larr;'}</span><span class="pv-log-method">${esc(e.method)}</span><span class="pv-log-frame">${esc(e.frame)}</span><span class="pv-log-params">${esc(short(e.params))}</span><span class="chip pv-log-state"></span></button><div class="pv-log-detail"></div>`;
      this.rows.set(e.id, row);
      const atEnd = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 24;
      this.list.appendChild(row);
      this.count += 1;
      while (this.rows.size > MAX) {
        const first = this.rows.keys().next().value as number;
        this.rows.get(first)?.remove();
        this.rows.delete(first);
        this.entries.delete(first);
      }
      if (atEnd) this.list.scrollTop = this.list.scrollHeight;
    }
    row.hidden = !this.visible(e);
    const chip = row.querySelector('.pv-log-state') as HTMLElement;
    chip.className = `chip pv-log-state ${e.pending ? 'info' : e.error ? 'error' : 'success'}`;
    chip.textContent = e.pending ? 'waiting' : e.error ? String(e.error.code) : `${e.ms ?? 0} ms`;
    chip.title = e.error ? `${ERRORS[e.error.code] ?? 'error'}: ${e.error.message}` : '';
    const detail = row.querySelector('.pv-log-detail') as HTMLElement;
    if (detail.dataset.filled) {
      delete detail.dataset.filled;
      if (row.getAttribute('aria-expanded') === 'true') this.fill(row, detail);
    }
    this.counter.textContent = `${this.rows.size} messages`;
  }

  clear() {
    this.rows.clear();
    this.entries.clear();
    this.list.textContent = '';
    this.counter.textContent = '0 messages';
  }

  all(): LogEntry[] {
    return [...this.entries.values()];
  }
}
