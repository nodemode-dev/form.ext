import type { ChatMode, ConsentChoice, ConsentRequest, DockAdapter, DockAgentStatus, DockChannel, DockChatEvent, DockChatStatus, DockErrorKind, DockProgramStatus, DockTerminal, PtyKind, StoredChoice, StoredChoiceState } from './dock/adapter';
import { Dock } from './dock/dock';
import './dock/dock.css';
import './styles/dock-tokens.css';
import { api, ApiError, isMac, keyLabel } from './shell';
import type { ShellContext } from './shell';
import { matchKeys } from './shell/dom';
import { on } from './shell/events';
import { isDialogOpen } from './shell/dialog';
import { isPaletteOpen } from './shell/palette';
import { openSettings, settingsOpen } from './shell/settings';
import { keyHeaders, windowHello } from './shell/window-key';

type Kind = Exclude<PtyKind, 'agent'>;
interface Row { id: string; title: string; cwd?: string; alive?: boolean; kind?: string }
interface Program { installed: boolean; version: string | null; install: string; signedIn: boolean | null }
interface ChatStatus extends Program { running: boolean; state: string; session: string | null; mode?: ChatMode; folder?: string; formmcp?: boolean }
interface Ask { id: string; agent?: string; what?: string; tool?: string; title?: string; project?: string; answers?: string[]; always?: string; expires?: number }
interface Access { access: string; requests: Ask[]; sealReset?: boolean }

const KINDS: Kind[] = ['shell', 'claude', 'codex', 'cursor'];
const NAMES: Record<Kind, string> = { shell: 'shell', claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' };
const CHOICES: ConsentChoice[] = ['deny', 'once', 'always'];
const WINDOW_KEYS = ['Mod+K', 'Mod+,', 'Mod+Shift+H', 'Mod+Shift+P', 'Mod+Shift+L', 'Mod+Shift+O'];
const ONCE_NOTE = 'Allow once lets this one call run.';
const ALWAYS_NOTE = 'Always allow lets outside agents change projects without asking; you can change that in Settings, Developer, Outside agents.';

export interface DockDeps {
  request(open: boolean): void;
}

export interface StudioDock {
  dock: Dock;
  terminals(): number;
}

const demo = (): boolean => document.documentElement.dataset.demo === 'studio';
const kindOf = (value: string | undefined): Kind => (KINDS.includes(value as Kind) ? (value as Kind) : 'shell');
const socketTo = (path: string): WebSocket => new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api${path}`);

function program(value: Program | undefined): DockProgramStatus | undefined {
  return value ? { installed: value.installed === true, version: value.version ?? null, install: value.install ?? '', signedIn: value.signedIn ?? null } : undefined;
}

function errorKind(err: unknown): DockErrorKind | null {
  if (demo() || err instanceof TypeError) return 'unreachable';
  if (!(err instanceof ApiError)) return null;
  if (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504) return 'unreachable';
  if (err.status === 403) return 'refused';
  if (err.status === 429) return 'busy';
  if (err.status === 404 || err.status === 405) return /^(Not Found|Method Not Allowed)$/i.test(err.message) ? 'oldEngine' : 'notInstalled';
  return null;
}

export function studioDock(ctx: ShellContext, deps: DockDeps): StudioDock {
  const open = new Map<string, Kind>();
  const project = (): string | undefined => ctx.project.current()?.id;

  const record = (row: Row): DockTerminal => {
    const kind = kindOf(row.kind);
    open.set(row.id, kind);
    return { id: row.id, title: row.title, alive: row.alive !== false, kind, ...(row.cwd ? { tip: row.cwd } : {}) };
  };

  const channel = async (id: string): Promise<DockChannel> => {
    await keyHeaders();
    let data = (_chunk: string | Uint8Array): void => undefined;
    let exit = (): void => undefined;
    let lost = (): void => undefined;
    let size: { cols: number; rows: number } | null = null;
    const socket = socketTo(`/terminal/${encodeURIComponent(id)}/stream`);
    socket.binaryType = 'arraybuffer';
    const send = (message: unknown): void => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    socket.addEventListener('open', () => {
      socket.send(windowHello());
      if (size) send({ type: 'resize', ...size });
    });
    socket.addEventListener('message', (msg) => {
      if (typeof msg.data === 'string') {
        data(msg.data);
        return;
      }
      let ctl: { type?: string };
      try {
        ctl = JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)) as { type?: string };
      } catch {
        return;
      }
      if (ctl.type !== 'exit') return;
      data(`\r\n\x1b[2m[${NAMES[open.get(id) ?? 'shell']} exited. Restart runs it again.]\x1b[0m\r\n`);
      exit();
    });
    socket.addEventListener('close', () => lost());
    return {
      send: (chunk) => send({ type: 'input', data: chunk }),
      resize: (cols, rows) => {
        size = { cols, rows };
        send({ type: 'resize', cols, rows });
      },
      onData: (handler) => { data = handler; },
      onExit: (handler) => { exit = handler; },
      onClose: (handler) => { lost = handler; },
      close: () => socket.close(),
    };
  };

  let add: (request: ConsentRequest) => void = () => undefined;
  let withdraw: (id: string) => void = () => undefined;
  const asked = new Set<string>();
  let reading = false;
  let again = false;
  const waiting = async (): Promise<void> => {
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    try {
      const got = await api.get<Access>('/api/agents/requests');
      const live = new Set(got.requests.map((r) => r.id));
      for (const id of [...asked]) {
        if (live.has(id)) continue;
        asked.delete(id);
        withdraw(id);
      }
      for (const r of got.requests) {
        const offers = CHOICES.filter((c) => (r.answers ?? CHOICES).includes(c));
        if (asked.has(r.id) || !offers.length) continue;
        asked.add(r.id);
        add({
          id: r.id,
          agent: r.agent ?? '',
          what: r.what ?? `run ${r.title ?? r.tool ?? 'a tool'}${r.project ? ` in the project ${r.project}` : ''}`,
          offers,
          always: r.always === 'agent' ? 'agent' : 'all',
          escape: 'deny',
          notes: offers.includes('always') ? [ONCE_NOTE, ALWAYS_NOTE] : [ONCE_NOTE],
          ...(typeof r.expires === 'number' ? { expires: r.expires * 1000 } : {}),
        });
      }
    } catch {
      return;
    } finally {
      reading = false;
      if (again) {
        again = false;
        void waiting();
      }
    }
  };

  const chatLead = (s: ChatStatus): string =>
    `Ask Claude to make, check, preview, package or run an extension in the line below. It works ${s.folder ? `in ${s.folder}, ` : ''}through the formext tools${s.formmcp ? ' and formMCP' : " (formMCP is not installed, so the host apps' own tools are out of reach)"}. Every call shows here and each file change shows in the editor.`;

  const adapter: DockAdapter = {
    words: {
      app: 'form.ext',
      noun: 'extension',
      example: 'make a FormWav extension that adds a fade button',
      start: './formext, or open the desktop app',
      lead: 'Ask Claude to make, check, preview, package or run an extension in the line below. Every call shows here and each file change shows in the editor.',
    },
    strings: {
      chatAbout: 'Chat with Claude about this extension',
      askPlaceholder: 'Ask Claude Code to work on this extension',
      chatPlaceholder: 'Ask Claude about this extension (Enter to send)',
      offlineStart: 'This needs the {app} engine on this computer, and it is not reachable from this page. Start it with {start}.',
      tourAskBody: 'If another AI program on this computer, or the formext command line, wants to change a project, {app} asks you first in a box in the middle of the window. Choose Deny, Allow once or Always allow. You can change your answer later under Outside agents in the menu here.',
    },
    placement: { mode: 'hosted', request: (want) => deps.request(want) },
    passKey: (event) => WINDOW_KEYS.some((keys) => matchKeys(event, keys)),
    isDockChord: (event) => matchKeys(event, 'Mod+J') && !isDialogOpen() && !isPaletteOpen() && !settingsOpen(),
    chordLabel: () => keyLabel('Mod+J').join(isMac ? '' : '+'),
    tabs: () => ({ builtin: ['chat', 'shell', 'claude', 'codex', 'cursor'] }),
    classes: { iconButton: 'fx-dock-ibtn', button: 'btn sm', primaryButton: 'primary', input: 'input', select: 'select', note: 'fx-dock-note' },
    t: (_key, english) => english,
    onTheme: (handler) => {
      on('shell.theme', handler);
      on('settings.changed', handler);
    },
    keyHeaders: () => ({}),
    errors: {
      message: (err) => (err instanceof ApiError ? err.message : null),
      kind: errorKind,
    },
    firstRun: () => !demo(),
    terminal: {
      list: async () => {
        const listed = await api.get<{ terminals: Row[] }>('/api/terminal');
        open.clear();
        return listed.terminals.map(record);
      },
      open: async (kind, o) => {
        const size = { cols: o.cols, rows: o.rows, project: project() };
        if (kind === 'shell') return record(await api.post<Row>('/api/terminal', size));
        if (kind === 'claude') return record(await api.post<Row>('/api/terminal/claude', { ...size, prompt: o.prompt || undefined, resume: o.resume || undefined }));
        return record(await api.post<Row>('/api/terminal/agent', { ...size, kind }));
      },
      restart: async (id) => {
        await api.post(`/api/terminal/${encodeURIComponent(id)}/restart`);
      },
      close: async (id) => {
        open.delete(id);
        await api.del(`/api/terminal/${encodeURIComponent(id)}`);
      },
      channel,
      scrollback: 5000,
    },
    agentStatus: async (): Promise<DockAgentStatus | null> => {
      if (demo()) return null;
      const status = await api.get<{ claude?: Program; codex?: Program; cursor?: Program }>('/api/agents/status');
      const out: DockAgentStatus = {};
      const claude = program(status.claude);
      const codex = program(status.codex);
      const cursor = program(status.cursor);
      if (claude) out.claude = claude;
      if (codex) out.codex = codex;
      if (cursor) out.cursor = cursor;
      return out;
    },
    chat: {
      modes: ['ask', 'auto-edits', 'plan'],
      status: async (): Promise<DockChatStatus | null> => {
        if (demo()) return null;
        const id = project();
        try {
          const s = await api.get<ChatStatus>(`/api/claude/status${id ? `?project=${encodeURIComponent(id)}` : ''}`);
          return { installed: s.installed, version: s.version ?? null, signedIn: s.signedIn ?? null, install: s.install, running: s.running, state: s.state, session: s.session ?? null, ...(s.mode ? { mode: s.mode } : {}), lead: chatLead(s) };
        } catch {
          return null;
        }
      },
      send: async (text) => {
        await api.post('/api/claude/send', { text });
      },
      start: async (mode, fresh) => {
        await api.post('/api/claude/start', { mode: mode ?? 'ask', fresh, project: project() });
      },
      stop: async () => {
        await api.post('/api/claude/stop');
      },
      answer: async (id, allow) => {
        await api.post('/api/claude/permission', { id, allow });
      },
      subscribe: (handlers) => {
        let socket: WebSocket | null = null;
        let off = demo();
        if (off) return () => undefined;
        void keyHeaders().then(() => {
          if (off) return;
          const made = socketTo('/claude/stream');
          socket = made;
          made.addEventListener('open', () => {
            made.send(windowHello());
            handlers.open();
          });
          made.addEventListener('message', (msg) => {
            let event: DockChatEvent;
            try {
              event = JSON.parse(String(msg.data)) as DockChatEvent;
            } catch {
              return;
            }
            handlers.event(event);
          });
          made.addEventListener('close', () => {
            if (!off) handlers.close();
          });
        });
        return () => {
          off = true;
          socket?.close();
        };
      },
    },
    consent: {
      subscribe: (onAdd, onWithdraw) => {
        add = onAdd;
        withdraw = onWithdraw;
        on('window.admitted', () => void waiting());
        on('agents.ask', () => void waiting());
        on('agents.answered', (d: { id?: string } | null) => {
          if (!d?.id) return;
          asked.delete(d.id);
          withdraw(d.id);
        });
      },
      answer: async (id, choice) => {
        await api.post(`/api/agents/requests/${encodeURIComponent(id)}`, { answer: choice });
      },
    },
    storedChoice: {
      get: async (): Promise<StoredChoiceState> => {
        const got = await api.get<Access>('/api/agents/requests');
        return { value: got.access === 'allowed' || got.access === 'blocked' ? got.access : 'ask', changedOutside: got.sealReset === true };
      },
      set: async (value: StoredChoice) => {
        await api.put('/api/settings', { agent_access: value === 'ask' ? '' : value });
      },
    },
    openSettings: () => openSettings('Developer'),
  };

  return { dock: new Dock(adapter), terminals: () => open.size };
}
