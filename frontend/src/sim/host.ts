import { ExtensionHost, HostError, ERR } from '../../../contract/host/host-bridge';
import type { ExtensionRecord, Frame, Theme } from '../../../contract/host/host-bridge';
import type { AppSim, Json, SimEmit } from './types';
import type { SimFile } from './samples';
import { tokensFor } from './tokens';
import { clone } from './util';

export interface LogEntry {
  id: number;
  at: number;
  dir: 'in' | 'out';
  method: string;
  params: unknown;
  frame: string;
  result?: unknown;
  error?: { code: number; message: string };
  ms?: number;
  pending: boolean;
}

export interface SimUI {
  consent(rec: ExtensionRecord): Promise<boolean>;
  openFiles(rec: ExtensionRecord, accept: string[], multiple: boolean): Promise<SimFile[]>;
  saveFile(rec: ExtensionRecord, name: string, type: string, data: string): Promise<{ saved: boolean; name: string }>;
  fetch(req: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; headers: Record<string, string>; body: string }>;
  notify(rec: ExtensionRecord, message: string, level: string): void;
  setTitle(frame: HTMLIFrameElement, title: string): void;
  resize(frame: HTMLIFrameElement, height: number): void;
  log(entry: LogEntry, fresh: boolean): void;
  changed(): void;
}

interface Step {
  label: string;
  before: Json;
}

let logSeq = 0;

export class SimHost {
  state: Json;
  steps: Step[] = [];
  mode: 'dark' | 'light';
  readonly host: ExtensionHost;
  private labels = new WeakMap<Frame, string>();
  private headless = '';
  private panels = new Map<string, Frame>();

  constructor(public sim: AppSim, private ui: SimUI, mode: 'dark' | 'light') {
    this.mode = mode;
    this.state = sim.initial();
    const offers = sim.offers;
    this.host = new ExtensionHost({
      product: sim.product,
      app: sim.app,
      appVersion: sim.appVersion,
      locale: () => navigator.language || 'en',
      theme: () => this.theme(),
      notify: (ext, message, level) => ui.notify(ext, message, level),
      setTitle: (_ext, frame, title) => ui.setTitle(frame, title),
      consent: (ext) => ui.consent(ext),
      readDocument: (_ext, params) => this.read(params),
      applyDocument: (ext, label, ops) => this.apply(ext, label, ops),
      commands: () => this.catalogue(),
      run: (ext, command, args) => this.run(ext, command, args),
      openFiles: offers.filesOpen ? (ext, accept, multiple) => ui.openFiles(ext, accept, multiple) : undefined,
      saveFile: offers.filesSave ? (ext, name, type, data) => ui.saveFile(ext, name, type, data) : undefined,
      fetch: offers.fetch ? (_ext, req) => ui.fetch(req) : undefined,
    });
    this.wrapDispatch();
  }

  private wrapDispatch() {
    const target = this.host as unknown as { dispatch: (frame: Frame, method: string, params: unknown, opts: unknown) => Promise<unknown> };
    const original = target.dispatch.bind(this.host);
    target.dispatch = async (frame, method, params, opts) => {
      const entry = this.record('in', method, params, this.labels.get(frame) ?? (this.headless ? `command ${this.headless}` : 'frame'));
      const t0 = performance.now();
      try {
        const result = await original(frame, method, params, opts);
        this.finish(entry, t0, { result: result ?? null });
        return result;
      } catch (err) {
        const e = err as { code?: number; message?: string };
        this.finish(entry, t0, { error: { code: typeof e.code === 'number' ? e.code : ERR.REFUSED, message: String(e.message ?? err) } });
        throw err;
      }
    };
  }

  private record(dir: 'in' | 'out', method: string, params: unknown, frame: string): LogEntry {
    const entry: LogEntry = { id: ++logSeq, at: Date.now(), dir, method, params, frame, pending: true };
    this.ui.log(entry, true);
    return entry;
  }

  private finish(entry: LogEntry, t0: number, out: { result?: unknown; error?: { code: number; message: string } }) {
    Object.assign(entry, out, { pending: false, ms: Math.round(performance.now() - t0) });
    this.ui.log(entry, false);
  }

  theme(): Theme {
    return { mode: this.mode, tokens: tokensFor(this.sim, this.mode) };
  }

  setMode(mode: 'dark' | 'light') {
    this.mode = mode;
    const theme = this.theme();
    const e = this.record('out', 'ext.theme', theme, 'all frames');
    this.host.setTheme(theme);
    this.finish(e, performance.now(), { result: null });
  }

  emit(name: string, data: unknown) {
    const e = this.record('out', 'ext.event', { name, data }, 'all frames');
    this.host.broadcast(name, data);
    this.finish(e, performance.now(), { result: null });
  }

  async read(params: Json) {
    const what = params?.what === undefined || params.what === null ? this.sim.defaultRead : String(params.what);
    const key = this.sim.readAliases?.[what] ?? what;
    const reader = this.sim.reads[key];
    if (reader) return clone(await reader(this.state, params ?? {}));
    if (this.sim.readFallback) return clone(await this.sim.readFallback(this.state, what, params ?? {}));
    throw new HostError(ERR.INVALID, `${this.sim.app} has no document.read what ${JSON.stringify(what)}; it offers ${Object.keys(this.sim.reads).join(', ')}`);
  }

  catalogue() {
    return Object.entries(this.sim.cmds).map(([id, c]) => (this.sim.catalogue ? this.sim.catalogue(id, c) : { id, title: c.title, ...(c.args ? { args: c.args } : {}), ...(c.group ? { group: c.group } : {}), ...(c.kind ? { kind: c.kind } : {}) }));
  }

  private command(id: string) {
    const c = this.sim.cmds[id];
    if (c) return c;
    const u = this.sim.unknownCommand?.(id) ?? { code: ERR.REFUSED, message: `${this.sim.app} has no command ${id}` };
    throw new HostError(u.code, u.message);
  }

  private resolveRefs(args: Json, results: Json[]): Json {
    if (typeof args === 'string') {
      const m = args.match(/^\$(\d+)\.(\w+)$/);
      return m ? results[Number(m[1]) - 1]?.[m[2]] : args;
    }
    if (Array.isArray(args)) return args.map((a) => this.resolveRefs(a, results));
    if (args && typeof args === 'object') return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, this.resolveRefs(v, results)]));
    return args;
  }

  async apply(ext: ExtensionRecord, label: string, ops: { command: string; args?: unknown }[]) {
    const sim = this.sim;
    const before = clone(this.state);
    const work = clone(this.state);
    const results: unknown[] = [];
    let failure: HostError | null = null;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      try {
        const c = this.command(op.command);
        if (sim.applyKinds && !sim.applyKinds.includes(c.kind ?? '')) throw new HostError(ERR.REFUSED, `${op.command} is not a document change; run it with app.run`);
        const args = sim.opRefs ? this.resolveRefs(op.args ?? {}, results) : op.args ?? {};
        results.push(clone(await c.fn(work, args, { via: 'apply', ext: ext.name, label })) ?? null);
      } catch (err) {
        const e = err as HostError;
        failure = new HostError(e.code === ERR.INVALID ? ERR.INVALID : ERR.REFUSED, `op ${i + 1} (${op.command}): ${e.message}`);
        break;
      }
    }
    const keep = !failure || (sim.apply === 'partial' && results.length > 0);
    if (keep && results.length) this.commit(before, work, label, 'apply');
    if (failure) throw failure;
    const extra = sim.applyExtra?.(this.state, label, results) ?? {};
    if (!sim.undo) this.ui.notify(ext, label, 'info');
    return { applied: results.length, results, ...extra } as { applied: number; results: unknown[] };
  }

  async run(ext: ExtensionRecord, command: string, args: unknown) {
    const c = this.command(command);
    if (this.sim.runExclude?.includes(c.kind ?? '')) throw new HostError(ERR.REFUSED, `${command} is a document command; send it with document.apply`);
    const before = clone(this.state);
    const work = clone(this.state);
    const result = clone(await c.fn(work, args ?? {}, { via: 'run', ext: ext.name, label: c.title }));
    const mutated = JSON.stringify(before) !== JSON.stringify(work);
    if (mutated) this.commit(before, work, c.title, 'run');
    return this.sim.runResult ? this.sim.runResult(this.state, command, result, mutated) : result ?? null;
  }

  private commit(before: Json, next: Json, label: string, cause: string) {
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    this.sim.step?.(next, label);
    this.state = next;
    this.steps.push({ label, before });
    if (this.steps.length > 50) this.steps.shift();
    this.announce(before, cause);
  }

  private announce(before: Json, cause: string) {
    const events: SimEmit[] = this.sim.changed(before, this.state, cause);
    this.ui.changed();
    for (const ev of events) this.emit(ev.name, ev.data);
  }

  undo() {
    const step = this.steps.pop();
    if (!step) return null;
    const before = this.state;
    this.state = step.before;
    this.announce(before, 'undo');
    return step.label;
  }

  reset() {
    const before = this.state;
    this.state = this.sim.initial();
    this.steps = [];
    this.announce(before, 'reset');
  }

  replace(next: Json) {
    const before = this.state;
    this.steps.push({ label: 'Edit document', before: clone(before) });
    this.state = clone(next);
    this.announce(before, 'edit');
  }

  isGranted(rec: ExtensionRecord) {
    return this.host.isGranted(rec);
  }

  async openPanel(rec: ExtensionRecord, panel: string, container: HTMLElement, command?: string): Promise<Frame | null> {
    const existing = this.panels.get(panel);
    if (existing) {
      if (command) this.activate(existing, { reason: 'command', panel, command });
      return existing;
    }
    const frame = await this.host.open(rec, container, { onResize: (h) => this.ui.resize(frame?.frame as HTMLIFrameElement, h) });
    if (!frame) return null;
    this.labels.set(frame, `panel ${panel}`);
    this.panels.set(panel, frame);
    this.activate(frame, command ? { reason: 'command', panel, command } : { reason: 'panel', panel });
    return frame;
  }

  private activate(frame: Frame, activation: { reason: 'panel' | 'command'; panel?: string; command?: string; args?: unknown }) {
    const e = this.record('out', 'ext.activate', activation, this.labels.get(frame) ?? 'frame');
    const t0 = performance.now();
    frame.activate(activation).then(
      (result) => this.finish(e, t0, { result: result ?? null }),
      (err) => this.finish(e, t0, { error: { code: (err as HostError).code ?? ERR.UNAVAILABLE, message: String((err as Error).message ?? err) } }),
    );
  }

  closePanel(panel: string) {
    const frame = this.panels.get(panel);
    if (!frame) return;
    this.panels.delete(panel);
    const e = this.record('out', 'ext.deactivate', {}, `panel ${panel}`);
    frame.dispose();
    this.finish(e, performance.now(), { result: null });
  }

  reactivate(panel: string) {
    const frame = this.panels.get(panel);
    if (frame) this.activate(frame, { reason: 'panel', panel });
    return Boolean(frame);
  }

  openPanels() {
    return [...this.panels.keys()];
  }

  async runCommand(rec: ExtensionRecord, command: string, container: HTMLElement, args: unknown = {}) {
    this.headless = command;
    const e = this.record('out', 'ext.activate', { reason: 'command', command, args }, `command ${command}`);
    const t0 = performance.now();
    try {
      const result = await this.host.runCommand(rec, command, args, container);
      this.finish(e, t0, { result: { done: result ?? null } });
      return result;
    } catch (err) {
      const x = err as HostError;
      this.finish(e, t0, { error: { code: x.code ?? ERR.UNAVAILABLE, message: String(x.message ?? err) } });
      throw err;
    } finally {
      this.headless = '';
    }
  }

  dispose() {
    for (const id of [...this.panels.keys()]) this.closePanel(id);
  }
}
