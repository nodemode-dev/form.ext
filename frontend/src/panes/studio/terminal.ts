import './terminal.css';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import { icon, errorMessage, ApiError } from '../../shell';
import type { ShellContext } from '../../shell';
import { ChatPane } from './chat';

interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  alive: boolean;
  kind: 'shell' | 'claude';
}

interface ClaudeStatus {
  installed: boolean;
  install: string;
}

interface Tab {
  id: string;
  term: Terminal;
  fit: FitAddon;
  host: HTMLElement;
  tab: HTMLElement;
  socket: WebSocket | null;
  kind: 'shell' | 'claude';
  seen: boolean;
  closed: boolean;
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function node(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function pick<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  return root.querySelector<T>(sel)!;
}

const WINDOW_KEYS = new Set(['KeyJ', 'KeyK', 'Comma', 'Shift+KeyH', 'Shift+KeyP', 'Shift+KeyL', 'Shift+KeyO']);

let xterm: Promise<[typeof import('@xterm/xterm'), typeof import('@xterm/addon-fit')]> | null = null;

function loadXterm() {
  xterm ??= Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/xterm/css/xterm.css')]).then(([a, b]) => [a, b] as [typeof import('@xterm/xterm'), typeof import('@xterm/addon-fit')]);
  return xterm;
}

export function socketTo(path: string): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${location.host}/api${path}`);
}

export class TerminalDock {
  readonly root = node(`<div class="tm-dock">
    <div class="tm-head">
      <div class="tm-tabs" role="tablist" aria-label="Terminals"></div>
      <span class="tm-spacer"></span>
      <button type="button" class="tm-btn tm-new" title="New Terminal" aria-label="New Terminal">${icon('plus', 15)}</button>
      <button type="button" class="tm-btn tm-open-chat" title="Chat with Claude about this extension" aria-label="Chat with Claude">${icon('agentChat', 15)}</button>
      <button type="button" class="tm-btn tm-claude" title="Claude Code in this project" aria-label="Claude Code">${icon('agent', 15)}</button>
      <button type="button" class="tm-btn tm-restart" title="Restart this tab" aria-label="Restart this tab" disabled>${icon('refresh', 15)}</button>
    </div>
    <div class="tm-stage">
      <p class="tm-empty">Starting the terminal. Open another with the plus button, Claude Code with the robot button, or Chat with the speech bubble.</p>
      <div class="tm-note" role="status" hidden><span class="tm-note-text"></span><code class="tm-note-cmd" hidden></code><button type="button" class="btn sm tm-note-copy" hidden>Copy</button><button type="button" class="tm-btn tm-note-x" title="Dismiss" aria-label="Dismiss">${icon('close', 12)}</button></div>
    </div>
    <form class="tm-ask" autocomplete="off">
      <span class="tm-ask-mark">${icon('agent', 15)}</span>
      <input class="input tm-ask-input" type="text" spellcheck="false" placeholder="Ask Claude Code to work on this extension" aria-label="Ask Claude Code">
      <button type="submit" class="tm-btn tm-ask-send" title="Send to Claude Code" aria-label="Send to Claude Code">${icon('send', 14)}</button>
    </form>
  </div>`);
  private readonly tabsEl = pick(this.root, '.tm-tabs');
  private readonly stage = pick(this.root, '.tm-stage');
  private readonly empty = pick(this.root, '.tm-empty');
  private readonly note = pick(this.root, '.tm-note');
  private readonly noteText = pick(this.root, '.tm-note-text');
  private readonly noteCmd = pick(this.root, '.tm-note-cmd');
  private readonly noteCopy = pick<HTMLButtonElement>(this.root, '.tm-note-copy');
  private readonly ask = pick<HTMLInputElement>(this.root, '.tm-ask-input');
  private readonly restartBtn = pick<HTMLButtonElement>(this.root, '.tm-restart');
  private readonly tabs = new Map<string, Tab>();
  private chat: ChatPane | null = null;
  private chatTab: HTMLElement | null = null;
  private active: string | null = null;
  private started = false;
  private visible = false;
  private pending: Promise<void> | null = null;

  constructor(private readonly ctx: ShellContext) {
    pick(this.root, '.tm-new').addEventListener('click', () => void this.open());
    pick(this.root, '.tm-claude').addEventListener('click', () => void this.claude());
    pick(this.root, '.tm-open-chat').addEventListener('click', () => void this.showChat());
    this.restartBtn.addEventListener('click', () => void this.restart());
    pick(this.root, '.tm-ask').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send();
    });
    pick(this.root, '.tm-note-x').addEventListener('click', () => this.dismiss());
    this.noteCopy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.noteCmd.textContent ?? '').catch(() => undefined);
    });
    this.ask.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
    });
    new ResizeObserver(() => this.fitActive()).observe(this.stage);
    ctx.events.on('shell.theme', () => this.restyle());
    ctx.events.on('settings.changed', () => this.restyle());
  }

  private project(): string | undefined {
    return this.ctx.project.current()?.id;
  }

  show(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      void this.ensure().then(() => {
        this.fitActive();
        this.focus();
      });
    }
  }

  async newTerminal(): Promise<void> {
    await this.ensure();
    await this.open();
  }

  async openClaude(prompt?: string): Promise<boolean> {
    await this.ensure(false);
    return this.claude(prompt);
  }

  async openChat(): Promise<void> {
    await this.ensure(false);
    await this.showChat();
  }

  private ensure(seed = true): Promise<void> {
    this.pending ??= this.boot(seed).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async boot(seed: boolean): Promise<void> {
    if (!this.started) {
      this.started = true;
      try {
        const listed = await this.ctx.api.get<{ terminals: TerminalInfo[] }>('/api/terminal');
        for (const info of listed.terminals) await this.mount(info, this.active === null);
      } catch (err) {
        this.started = false;
        this.engineNote(err);
        return;
      }
    }
    if (seed && this.tabs.size === 0 && !this.chatTab) await this.open();
    this.hideEmpty();
    this.fitActive();
  }

  private hideEmpty(): void {
    this.empty.hidden = this.tabs.size > 0 || !!this.chatTab;
  }

  private engineNote(err: unknown): void {
    const down = err instanceof ApiError && (err.status === 0 || err.status === 404 || err.status === 405);
    this.say(down ? 'The terminal needs the form.ext engine from this computer (./formext or the desktop app). It is not reachable from this page.' : errorMessage(err));
    this.empty.hidden = true;
  }

  focus(): void {
    if (this.active === 'chat') this.ask.focus({ preventScroll: true });
    else if (this.active) this.tabs.get(this.active)?.term.focus();
  }

  private restyle(): void {
    for (const x of this.tabs.values()) x.term.options.theme = this.theme();
    this.fitActive();
  }

  private theme() {
    return {
      background: token('--bar', '#111111'),
      foreground: token('--ink', '#f7f7f7'),
      cursor: token('--accent-color', '#f97316'),
      cursorAccent: token('--bar', '#111111'),
      selectionBackground: token('--accent-color-dim', '#f9731633'),
    };
  }

  private say(text: string, cmd = ''): void {
    if (this.noteText.textContent !== text) this.noteText.textContent = text;
    if (this.noteCmd.textContent !== cmd) this.noteCmd.textContent = cmd;
    this.noteCmd.hidden = cmd === '';
    this.noteCopy.hidden = cmd === '';
    this.note.hidden = false;
  }

  private dismiss(): void {
    this.note.hidden = true;
  }

  private async open(): Promise<void> {
    try {
      const info = await this.ctx.api.post<TerminalInfo>('/api/terminal', { cols: 100, rows: 24, project: this.project() });
      await this.mount(info, true);
      this.dismiss();
    } catch (err) {
      this.engineNote(err);
    }
  }

  async claude(prompt?: string, resume?: string): Promise<boolean> {
    const size = this.size();
    try {
      const info = await this.ctx.api.post<TerminalInfo>('/api/terminal/claude', { prompt: prompt || undefined, resume: resume || undefined, cols: size.cols, rows: size.rows, project: this.project() });
      if (this.tabs.has(info.id)) this.select(info.id);
      else await this.mount(info, true);
      this.dismiss();
      return true;
    } catch (err) {
      await this.claudeFailed(err);
      return false;
    }
  }

  private async claudeFailed(err: unknown): Promise<void> {
    let status: ClaudeStatus | null = null;
    try {
      status = await this.ctx.api.get<ClaudeStatus>('/api/claude/status');
    } catch {
      status = null;
    }
    if (status && !status.installed) {
      this.say('Claude Code is not installed on this computer. Install it with the command below, then sign in once by running claude in a terminal tab.', status.install);
      return;
    }
    this.engineNote(err);
  }

  private size(): { cols: number; rows: number } {
    const tab = this.active ? this.tabs.get(this.active) : null;
    return tab ? { cols: tab.term.cols, rows: tab.term.rows } : { cols: 100, rows: 20 };
  }

  private async mount(info: TerminalInfo, show: boolean): Promise<void> {
    if (this.tabs.has(info.id)) {
      if (show) this.select(info.id);
      return;
    }
    const [{ Terminal }, { FitAddon }] = await loadXterm();
    if (this.tabs.has(info.id)) return;
    const kind = info.kind === 'claude' ? 'claude' : 'shell';
    const term = new Terminal({
      fontFamily: token('--font-code', 'monospace'),
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      theme: this.theme(),
      overviewRuler: { width: 0 },
      minimumContrastRatio: 4.5,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.attachCustomKeyEventHandler((e) => !(e.type === 'keydown' && (e.ctrlKey || e.metaKey) && !e.altKey && WINDOW_KEYS.has(`${e.shiftKey ? 'Shift+' : ''}${e.code}`)));
    const host = node('<div class="tm-term" hidden></div>');
    const tab = node(`<button type="button" class="tm-tab${kind === 'claude' ? ' is-claude' : ''}" role="tab" aria-selected="false">${icon(kind === 'claude' ? 'agent' : 'terminal', 13)}<span class="tm-tab-title"></span><span class="tm-tab-x" role="button" aria-label="Close this tab">${icon('close', 11)}</span></button>`);
    pick(tab, '.tm-tab-title').textContent = info.title;
    tab.title = info.cwd;
    tab.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.tm-tab-x')) void this.close(info.id);
      else this.select(info.id);
    });
    this.stage.appendChild(host);
    this.tabsEl.appendChild(tab);
    const entry: Tab = { id: info.id, term, fit, host, tab, socket: null, kind, seen: false, closed: false };
    this.tabs.set(info.id, entry);
    this.hideEmpty();
    term.open(host);
    if (show) this.select(info.id);
    this.connect(entry);
  }

  private connect(entry: Tab): void {
    const socket = socketTo(`/terminal/${entry.id}/stream`);
    socket.binaryType = 'arraybuffer';
    entry.socket = socket;
    socket.addEventListener('open', () => this.sendSize(entry));
    socket.addEventListener('message', (msg) => {
      entry.seen = true;
      if (typeof msg.data === 'string') {
        entry.term.write(msg.data);
        return;
      }
      try {
        const ctl = JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)) as { type?: string };
        if (ctl.type === 'exit') entry.term.write(`\r\n\x1b[2m[${entry.kind === 'claude' ? 'Claude Code' : 'shell'} exited. Restart runs it again.]\x1b[0m\r\n`);
      } catch {
        return;
      }
    });
    socket.addEventListener('close', () => {
      if (!entry.seen && !entry.closed) entry.term.write('\r\n\x1b[2m[The engine did not answer on this terminal. Restart the engine, then close this tab and open it again.]\x1b[0m\r\n');
    });
    entry.term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }));
    });
  }

  private sendSize(x: Tab): void {
    if (x.socket?.readyState === WebSocket.OPEN) x.socket.send(JSON.stringify({ type: 'resize', cols: x.term.cols, rows: x.term.rows }));
  }

  private fitActive(): void {
    const x = this.active ? this.tabs.get(this.active) : null;
    if (!x || x.host.hidden || this.stage.clientHeight < 20 || !this.visible) return;
    const before = `${x.term.cols}x${x.term.rows}`;
    x.fit.fit();
    if (`${x.term.cols}x${x.term.rows}` !== before) this.sendSize(x);
  }

  private select(id: string, focus = true): void {
    this.active = id;
    for (const [tid, x] of this.tabs) {
      const on = tid === id;
      x.host.hidden = !on;
      x.tab.classList.toggle('is-on', on);
      x.tab.setAttribute('aria-selected', String(on));
    }
    if (this.chat) this.chat.root.hidden = id !== 'chat';
    if (this.chatTab) {
      this.chatTab.classList.toggle('is-on', id === 'chat');
      this.chatTab.setAttribute('aria-selected', String(id === 'chat'));
    }
    this.syncAsk();
    this.restartBtn.disabled = id === 'chat';
    this.fitActive();
    if (focus) this.focus();
  }

  private syncAsk(): void {
    const text = this.active === 'chat' ? 'Ask Claude about this extension (Enter to send)' : 'Ask Claude Code to work on this extension';
    if (this.ask.placeholder !== text) this.ask.placeholder = text;
  }

  async showChat(): Promise<void> {
    if (!this.chat) {
      const chat = new ChatPane(this.ctx, () => this.project());
      chat.onFail = (err) => this.say(errorMessage(err));
      chat.onHandoff = (session) => void this.claude(undefined, session);
      this.chat = chat;
      this.stage.appendChild(chat.root);
    }
    if (!this.chatTab) {
      const tab = node(`<button type="button" class="tm-tab is-chat" role="tab" aria-selected="false">${icon('agentChat', 13)}<span class="tm-tab-title">Chat</span><span class="tm-tab-x" role="button" aria-label="Close the Chat tab">${icon('close', 11)}</span></button>`);
      tab.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tm-tab-x')) this.closeChat();
        else this.select('chat');
      });
      this.tabsEl.prepend(tab);
      this.chatTab = tab;
    }
    this.empty.hidden = true;
    this.select('chat');
    await this.chat.load();
  }

  private closeChat(): void {
    this.chatTab?.remove();
    this.chatTab = null;
    this.chat?.release();
    if (this.chat) this.chat.root.hidden = true;
    if (this.active === 'chat') {
      this.active = null;
      const next = [...this.tabs.keys()].pop();
      if (next) this.select(next);
      else {
        this.empty.hidden = false;
        this.syncAsk();
        this.restartBtn.disabled = true;
      }
    }
  }

  private async send(): Promise<void> {
    const text = this.ask.value.trim();
    if (!text) return;
    if (this.active === 'chat' && this.chat) {
      if (this.chat.isBusy()) return;
      this.ask.value = '';
      await this.chat.send(text);
      return;
    }
    this.ask.value = '';
    const ok = await this.claude(text);
    if (!ok && !this.ask.value) this.ask.value = text;
  }

  private async restart(): Promise<void> {
    const x = this.active ? this.tabs.get(this.active) : null;
    if (!x) return;
    try {
      await this.ctx.api.post(`/api/terminal/${x.id}/restart`);
    } catch (err) {
      this.say(errorMessage(err));
      return;
    }
    this.sendSize(x);
    x.term.focus();
  }

  private async close(id: string): Promise<void> {
    const x = this.tabs.get(id);
    if (!x) return;
    x.closed = true;
    x.socket?.close();
    x.term.dispose();
    x.host.remove();
    x.tab.remove();
    this.tabs.delete(id);
    try {
      await this.ctx.api.del(`/api/terminal/${id}`);
    } catch {
      this.hideEmpty();
    }
    if (this.active === id) {
      this.active = null;
      const next = [...this.tabs.keys()].pop() ?? (this.chatTab ? 'chat' : undefined);
      if (next) this.select(next);
      else {
        this.restartBtn.disabled = true;
        this.syncAsk();
      }
    }
    this.hideEmpty();
  }
}
