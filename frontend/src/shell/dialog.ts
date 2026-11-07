import { esc } from './dom';

interface Job {
  title: string;
  body: string;
  ok: string;
  danger: boolean;
  isForm: boolean;
  wide: boolean;
  resolve: (v: FormData | boolean | null) => void;
}

let scrim: HTMLElement;
let box: HTMLFormElement;
let head: HTMLElement;
let bodyEl: HTMLElement;
let okBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
const queue: Job[] = [];
let active: Job | null = null;
let returnFocus: Element | null = null;

export function mountDialogs(scrimEl: HTMLElement, dialogEl: HTMLFormElement): void {
  scrim = scrimEl;
  box = dialogEl;
  head = box.querySelector('.fx-dialog-head')!;
  bodyEl = box.querySelector('.fx-dialog-body')!;
  okBtn = box.querySelector('[data-role="ok"]')!;
  cancelBtn = box.querySelector('[data-role="cancel"]')!;
  box.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!active) return;
    if (active.isForm && !box.reportValidity()) return;
    finish(active.isForm ? new FormData(box) : true);
  });
  cancelBtn.addEventListener('click', () => finish(active?.isForm ? null : false));
  scrim.addEventListener('mousedown', () => finish(active?.isForm ? null : false));
  box.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      finish(active?.isForm ? null : false);
    }
  });
}

export function isDialogOpen(): boolean {
  return active !== null;
}

function show(job: Job): void {
  active = job;
  returnFocus = document.activeElement;
  head.textContent = job.title;
  bodyEl.innerHTML = job.isForm ? job.body : `<p>${esc(job.body)}</p>`;
  okBtn.textContent = job.ok;
  okBtn.className = `btn ${job.danger ? 'danger' : 'primary'}`;
  box.classList.toggle('wide', job.wide);
  box.classList.add('open');
  scrim.classList.add('open');
  const first = job.isForm ? bodyEl.querySelector<HTMLElement>('[autofocus], input:not([type="hidden"]), select, textarea') : null;
  (first ?? okBtn).focus();
}

function finish(value: FormData | boolean | null): void {
  const job = active;
  if (!job) return;
  active = null;
  box.classList.remove('open');
  scrim.classList.remove('open');
  bodyEl.innerHTML = '';
  job.resolve(value);
  if (returnFocus instanceof HTMLElement) returnFocus.focus();
  const next = queue.shift();
  if (next) show(next);
}

function enqueue(job: Job): void {
  if (active) queue.push(job);
  else show(job);
}

export function confirm(title: string, body: string, ok = 'OK'): Promise<boolean> {
  const danger = /^(delete|remove|discard|overwrite|replace)/i.test(ok);
  return new Promise((resolve) => enqueue({ title, body, ok, danger, isForm: false, wide: false, resolve: (v) => resolve(v === true) }));
}

export function form(title: string, html: string): Promise<FormData | null> {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const okAttr = tmp.querySelector<HTMLElement>('[data-ok]')?.dataset.ok;
  const wide = !!tmp.querySelector('[data-wide]');
  return new Promise((resolve) => enqueue({ title, body: html, ok: okAttr || 'OK', danger: false, isForm: true, wide, resolve: (v) => resolve(v instanceof FormData ? v : null) }));
}

export const dialog = { confirm, form };
