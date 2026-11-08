import { ApiError, icon } from '../../shell';
import type { ShellContext } from '../../shell';

type Mode = 'ask' | 'auto-edits' | 'plan';

interface Status {
  installed: boolean;
  version: string | null;
  signedIn: boolean | null;
  install: string;
  formmcp: boolean;
  running: boolean;
  state: string;
  mode: Mode;
  session: string | null;
  folder: string;
}

type Event =
  | { type: 'state'; running: boolean; state: string; mode: Mode; session: string | null }
  | { type: 'user'; text: string }
  | { type: 'block'; id: string; kind: 'text' | 'thinking' }
  | { type: 'delta'; id: string; text: string }
  | { type: 'tool'; id: string; name: string; summary: string }
  | { type: 'tool_result'; id: string; text: string; error: boolean }
  | { type: 'permission'; id: string; tool: string; summary: string }
  | { type: 'permission_done'; id: string; allowed: boolean }
  | { type: 'result'; ok: boolean; text: string }
  | { type: 'notice'; text: string };

const LABELS: Record<Mode, string> = { ask: 'Ask', 'auto-edits': 'Auto-accept edits', plan: 'Plan' };

function toolName(name: string): string {
  return name.replace(/^mcp__/, '').replace(/__/g, ' ');
}

function node(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function pick<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  return root.querySelector<T>(sel)!;
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export class ChatPane {
  readonly root = node(`<div class="tm-chat" hidden>
<div class="tm-chat-bar"><span class="tm-chat-status"></span><span class="tm-spacer"></span>
<select class="select tm-chat-mode" aria-label="Permission mode"></select>
<button type="button" class="btn sm tm-chat-stop" disabled>Stop</button>
<button type="button" class="btn sm tm-chat-handoff" title="Continue this conversation in a Claude Code terminal tab">Continue in Claude Code</button>
<button type="button" class="btn sm tm-chat-new">New Chat</button></div>
<div class="tm-chat-log" role="log" aria-live="polite"><div class="tm-chat-empty"><p class="tm-chat-empty-text"></p><div class="tm-chat-install" hidden><code class="tm-chat-install-cmd"></code><button type="button" class="btn sm tm-chat-copy">Copy</button></div></div></div>
</div>`);
  onFail: (err: unknown) => void = () => undefined;
  onHandoff: (session: string) => void = () => undefined;
  private readonly log = pick(this.root, '.tm-chat-log');
  private readonly empty = pick(this.root, '.tm-chat-empty');
  private readonly emptyText = pick(this.root, '.tm-chat-empty-text');
  private readonly install = pick(this.root, '.tm-chat-install');
  private readonly statusEl = pick(this.root, '.tm-chat-status');
  private readonly mode = pick<HTMLSelectElement>(this.root, '.tm-chat-mode');
  private readonly stopBtn = pick<HTMLButtonElement>(this.root, '.tm-chat-stop');
  private readonly blocks = new Map<string, { node: HTMLElement; text: Text }>();
  private readonly tools = new Map<string, HTMLElement>();
  private readonly asks = new Map<string, HTMLElement>();
  private socket: WebSocket | null = null;
  private info: Status | null = null;
  private state = 'idle';
  private running = false;
  private offline = false;
  private wanted = false;
  private session: string | null = null;

  constructor(private readonly ctx: ShellContext, private readonly project: () => string | undefined) {
    for (const [value, label] of Object.entries(LABELS)) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      this.mode.append(o);
    }
    pick(this.root, '.tm-chat-new').addEventListener('click', () => void this.begin(true));
    pick(this.root, '.tm-chat-handoff').addEventListener('click', () => void this.handoff());
    pick(this.root, '.tm-chat-copy').addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.info?.install ?? '').catch(() => undefined);
    });
    this.stopBtn.addEventListener('click', () => {
      void this.ctx.api.post('/api/claude/stop').catch(() => undefined);
    });
    this.mode.addEventListener('change', () => {
      if (this.running) void this.begin(false);
    });
  }

  isBusy(): boolean {
    return this.state === 'busy';
  }

  async load(): Promise<void> {
    this.wanted = true;
    this.connect();
    await this.refresh();
  }

  release(): void {
    this.wanted = false;
    this.socket?.close();
    this.socket = null;
  }

  async send(text: string): Promise<void> {
    if (!text || this.state === 'busy') return;
    if (!this.running && !(await this.begin(false))) return;
    try {
      await this.ctx.api.post('/api/claude/send', { text });
    } catch (err) {
      this.note('note', err instanceof ApiError ? err.message : 'The message could not be sent.');
    }
    this.paint();
  }

  private async status(): Promise<Status | null> {
    const id = this.project();
    try {
      return await this.ctx.api.get<Status>(`/api/claude/status${id ? `?project=${encodeURIComponent(id)}` : ''}`);
    } catch {
      return null;
    }
  }

  private async refresh(): Promise<void> {
    this.info = await this.status();
    this.offline = this.info === null;
    if (this.info) {
      this.running = this.info.running;
      this.state = this.info.state;
      this.session = this.info.session ?? this.session;
      if (this.mode.value !== this.info.mode && this.info.running) this.mode.value = this.info.mode;
    }
    this.paint();
  }

  private paint(): void {
    const i = this.info;
    let status: string;
    let lead: string;
    if (this.offline || !i) {
      status = 'The form.ext engine is not reachable';
      lead = 'The Chat tab runs Claude Code through the form.ext engine on this computer. Start it with ./formext, or open the desktop app.';
    } else if (!i.installed) {
      status = 'Claude Code is not installed';
      lead = 'Claude Code is not installed on this computer. Install it with the command below, then sign in once by running claude in a terminal tab.';
    } else {
      const parts = [`Claude Code ${i.version ?? ''}`.trim()];
      if (i.signedIn === true) parts.push('signed in');
      else if (i.signedIn === false) parts.push('not signed in: run claude in a terminal tab and sign in with /login');
      parts.push(this.running ? (this.state === 'busy' ? 'working' : 'ready') : 'not started');
      status = parts.join(' · ');
      const where = i.folder ? ` It works in ${i.folder}` : '';
      lead = `Ask Claude to make, check, preview, package or run an extension in the line below.${where}, through the formext tools${i.formmcp ? ' and formMCP' : ' (formMCP is not installed, so the host apps\' own tools are out of reach)'}. Every call shows here and each file change shows in the editor.`;
    }
    setText(this.statusEl, status);
    this.statusEl.title = status;
    setText(this.emptyText, lead);
    const missing = !!i && !i.installed;
    this.install.hidden = !missing;
    if (missing && i) setText(pick(this.install, '.tm-chat-install-cmd'), i.install);
    const usable = !!i && i.installed && !this.offline;
    this.stopBtn.disabled = !this.running;
    this.mode.disabled = !usable;
    this.root.classList.toggle('is-busy', this.state === 'busy');
  }

  private connect(): void {
    if (this.socket) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${proto}//${location.host}/api/claude/stream`);
    this.socket = socket;
    socket.addEventListener('open', () => this.wipe());
    socket.addEventListener('message', (msg) => {
      try {
        this.onEvent(JSON.parse(String(msg.data)) as Event);
      } catch {
        return;
      }
    });
    socket.addEventListener('close', () => {
      if (this.socket === socket) this.socket = null;
      if (this.wanted) {
        window.setTimeout(() => {
          if (this.wanted && !this.socket) {
            this.connect();
            void this.refresh();
          }
        }, 2000);
      }
    });
  }

  private wipe(): void {
    this.log.replaceChildren(this.empty);
    this.empty.hidden = false;
    this.blocks.clear();
    this.tools.clear();
    this.asks.clear();
  }

  private async begin(fresh: boolean): Promise<boolean> {
    try {
      await this.ctx.api.post('/api/claude/start', { mode: this.mode.value, fresh, project: this.project() });
      if (fresh) this.wipe();
      return true;
    } catch (err) {
      this.note('note', err instanceof ApiError ? err.message : 'Claude Code could not be started.');
      return false;
    }
  }

  private async handoff(): Promise<void> {
    const s = await this.status();
    const session = s?.session ?? this.session;
    if (!session) {
      this.onFail(new Error('Start a conversation here first; then it can continue in Claude Code'));
      return;
    }
    if ((s?.state ?? this.state) === 'busy') {
      this.onFail(new Error('Wait for Claude to finish, or press Stop, before moving the conversation'));
      return;
    }
    this.onHandoff(session);
  }

  private add(cls: string): HTMLElement {
    const n = node(`<div class="${cls}"></div>`);
    this.empty.hidden = true;
    const stick = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40;
    this.log.append(n);
    if (stick) this.log.scrollTop = this.log.scrollHeight;
    return n;
  }

  private note(kind: 'user' | 'note' | 'error', text: string): void {
    setText(this.add(`tm-chat-msg is-${kind}`), text);
  }

  private grow(n: HTMLElement): void {
    if (this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 80 + n.clientHeight) this.log.scrollTop = this.log.scrollHeight;
  }

  private onEvent(ev: Event): void {
    switch (ev.type) {
      case 'state':
        this.running = ev.running;
        this.state = ev.state;
        this.session = ev.session ?? this.session;
        if (ev.running && this.mode.value !== ev.mode) this.mode.value = ev.mode;
        this.paint();
        break;
      case 'user':
        this.note('user', ev.text);
        break;
      case 'block':
        if (!this.blocks.has(ev.id)) {
          const n = this.add(`tm-chat-msg is-${ev.kind === 'thinking' ? 'thinking' : 'assistant'}`);
          const text = document.createTextNode('');
          n.append(text);
          this.blocks.set(ev.id, { node: n, text });
        }
        break;
      case 'delta': {
        const block = this.blocks.get(ev.id);
        if (block) {
          block.text.appendData(ev.text);
          this.grow(block.node);
        }
        break;
      }
      case 'tool':
        this.tool(ev.id, ev.name, ev.summary);
        break;
      case 'tool_result': {
        const card = this.tools.get(ev.id);
        if (!card) break;
        const chip = pick(card, '.tm-chat-tool');
        const out = pick(card, '.tm-chat-tool-out');
        setText(out, ev.text);
        out.hidden = ev.text === '' || !ev.error;
        chip.classList.remove('is-running');
        chip.classList.toggle('is-done', !ev.error);
        chip.classList.toggle('is-error', ev.error);
        break;
      }
      case 'permission':
        this.question(ev.id, ev.tool, ev.summary);
        break;
      case 'permission_done': {
        const card = this.asks.get(ev.id);
        if (!card) break;
        card.classList.add('is-done');
        setText(pick(card, '.tm-chat-ask-state'), ev.allowed ? 'Allowed' : 'Declined');
        break;
      }
      case 'result':
        if (!ev.ok) this.note('error', ev.text || 'Claude Code stopped with an error.');
        break;
      case 'notice':
        this.note('note', ev.text);
        break;
    }
  }

  private tool(id: string, name: string, summary: string): void {
    if (this.tools.has(id)) return;
    const card = this.add('tm-chat-tool-card');
    const chip = node(`<div class="tm-chat-tool is-running" role="button" tabindex="0"><span class="tm-chat-tool-mark">${icon('terminal', 11)}</span><span class="tm-chat-tool-name"></span><span class="tm-chat-tool-input"></span></div>`);
    const out = node('<pre class="tm-chat-tool-out" hidden></pre>');
    setText(pick(chip, '.tm-chat-tool-name'), toolName(name));
    setText(pick(chip, '.tm-chat-tool-input'), summary);
    chip.title = summary;
    const toggle = (): void => {
      if (out.textContent) out.hidden = !out.hidden;
    };
    chip.addEventListener('click', toggle);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    card.append(chip, out);
    this.tools.set(id, card);
  }

  private question(id: string, tool: string, summary: string): void {
    if (this.asks.has(id)) return;
    const card = this.add('tm-chat-ask');
    card.append(
      node('<div class="tm-chat-ask-text"></div>'),
      node('<code class="tm-chat-ask-sum"></code>'),
      node('<div class="tm-chat-ask-row"><button type="button" class="btn sm primary tm-chat-allow">Allow</button><button type="button" class="btn sm tm-chat-deny">Deny</button><span class="tm-chat-ask-state"></span></div>'),
    );
    setText(pick(card, '.tm-chat-ask-text'), `Claude Code asks to use ${toolName(tool)}`);
    setText(pick(card, '.tm-chat-ask-sum'), summary);
    pick(card, '.tm-chat-allow').addEventListener('click', () => {
      void this.ctx.api.post('/api/claude/permission', { id, allow: true }).catch(() => undefined);
    });
    pick(card, '.tm-chat-deny').addEventListener('click', () => {
      void this.ctx.api.post('/api/claude/permission', { id, allow: false }).catch(() => undefined);
    });
    this.asks.set(id, card);
  }
}
