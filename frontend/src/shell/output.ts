import type { Level } from './types';

export interface OutputLine {
  at: number;
  source: string;
  text: string;
  level: Level;
}

const MAX = 500;
const lines: OutputLine[] = [];
const listeners = new Set<(line: OutputLine | null) => void>();

export function write(source: string, text: string, level: Level = 'info'): void {
  const line = { at: Date.now(), source, text, level };
  lines.push(line);
  if (lines.length > MAX) lines.shift();
  for (const cb of listeners) cb(line);
}

export function all(): OutputLine[] {
  return lines.slice();
}

export function clear(): void {
  lines.length = 0;
  for (const cb of listeners) cb(null);
}

export function onWrite(cb: (line: OutputLine | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const output = { write, all, clear, onWrite };
