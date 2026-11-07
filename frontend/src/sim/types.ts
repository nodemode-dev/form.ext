export type Json = any;

export interface SimCtx {
  via: 'apply' | 'run';
  ext: string;
  label: string;
}

export interface SimCmd<S> {
  title: string;
  args?: Record<string, string>;
  kind?: string;
  group?: string;
  fn: (s: S, a: Json, x: SimCtx) => unknown;
}

export interface SimEvent<S> {
  name: string;
  note: string;
  sample: (s: S) => unknown;
}

export interface SimOffers {
  filesOpen: boolean;
  filesSave: boolean;
  fetch: boolean;
  notes: string[];
}

export interface SimEmit {
  name: string;
  data: unknown;
}

export interface AppSim<S = Json> {
  product: string;
  app: string;
  appVersion: string;
  docLabel: string;
  title: (s: S) => string;
  initial: () => S;
  reads: Record<string, (s: S, p: Json) => unknown>;
  defaultRead: string;
  readAliases?: Record<string, string>;
  readFallback?: (s: S, what: string, p: Json) => unknown;
  cmds: Record<string, SimCmd<S>>;
  applyKinds?: string[];
  runExclude?: string[];
  opRefs?: boolean;
  apply: 'atomic' | 'partial';
  undo: boolean;
  step?: (s: S, label: string) => void;
  applyExtra?:(s: S, label: string, results: unknown[]) => Record<string, unknown>;
  runResult?: (s: S, command: string, result: unknown, mutated: boolean) => unknown;
  unknownCommand?: (id: string) => { code: number; message: string };
  catalogue?: (id: string, c: SimCmd<S>) => Record<string, unknown>;
  changed: (prev: S, next: S, cause: string) => SimEmit[];
  events: SimEvent<S>[];
  offers: SimOffers;
  tokens: Record<string, string>;
  view: (s: S) => string;
  samples?: string[];
}
