export interface PaneDef {
  id: string;
  title: string;
  icon: string;
  order: number;
  group?: 'make' | 'ship' | 'learn';
  view?: 'start' | 'studio' | 'part';
  mount(el: HTMLElement, ctx: ShellContext): void | (() => void);
}

export interface ShellContext {
  api: {
    get<T>(p: string): Promise<T>;
    post<T>(p: string, body?: unknown): Promise<T>;
    put<T>(p: string, body?: unknown): Promise<T>;
    del<T>(p: string): Promise<T>;
  };
  events: { on(name: string, cb: (data: any) => void): () => void };
  project: {
    current(): ProjectRef | null;
    onChange(cb: (p: ProjectRef | null) => void): () => void;
    open(id: string): Promise<void>;
  };
  notify(message: string, level?: 'info' | 'success' | 'warning' | 'error'): void;
  openPane(id: string, args?: unknown): void;
  commands: { register(c: { id: string; title: string; keys?: string; run: () => unknown }): void };
  dialog: {
    confirm(title: string, body: string, ok?: string): Promise<boolean>;
    form(title: string, html: string): Promise<FormData | null>;
  };
}

export interface ProjectRef {
  id: string;
  name: string;
  product: string;
  dir: string;
  manifest: Record<string, unknown>;
}

export type Level = 'info' | 'success' | 'warning' | 'error';

export interface Command {
  id: string;
  title: string;
  keys?: string;
  icon?: string;
  run: () => unknown;
}
