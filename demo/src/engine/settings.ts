import { emit } from '../../../frontend/src/shell/events';
import { text, utf8 } from './bytes';
import * as fs from './vfs';

const FILE = `${fs.HOME}/.local/share/ai.nodemode.formext/settings.json`;
const DEFAULTS: Record<string, unknown> = {
  theme: 'dark',
  author: '',
  publisher: '',
  licence: 'Apache-2.0',
  default_product: 'formvis',
  formportal_root: '',
  formportal_cli: '',
  editor: { font_size: 13, tab_size: 2, wrap: false },
  preview: { theme: 'dark', consent: 'ask' },
};

type Obj = Record<string, any>;

function merge(base: Obj, patch: Obj): Obj {
  const out: Obj = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function stored(): Obj {
  const raw = fs.read(FILE);
  if (!raw) return {};
  try {
    const d = JSON.parse(text(raw));
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

export const settings = {
  get(): Obj {
    return merge(DEFAULTS, stored());
  },
  value(key: string): any {
    let cur: any = settings.get();
    for (const part of key.split('.')) {
      if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
      cur = cur[part];
    }
    return cur;
  },
  update(patch: Obj): Obj {
    const next = merge(stored(), patch);
    for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
    fs.write(FILE, utf8(JSON.stringify(next, null, 2)));
    const merged = merge(DEFAULTS, next);
    emit('settings.changed', merged);
    return merged;
  },
};
