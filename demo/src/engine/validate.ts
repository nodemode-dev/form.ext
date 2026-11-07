import { emit } from '../../../frontend/src/shell/events';
import { ext as suffix, now, pyRepr, strictText, text as decode } from './bytes';
import * as kit from './kit';
import type { Folder, Json } from './kit';
import { deflate } from './zip';
import packageSchema from '../../../contract/schema/package.schema.json';

const SEVERITIES = ['error', 'warning', 'info'];
const LINT_TYPES = new Set(['.html', '.js', '.mjs', '.css']);
const TEXT_LIMIT = 2 * 1024 * 1024;
const LARGE_FILE = 5 * 1024 * 1024;
const PLAIN = kit.PLAIN;

export const RULES = [
  { id: 'json', severity: 'error', title: 'manifest.json is valid JSON', text: 'The host cannot read a manifest with a syntax error.' },
  { id: 'package', severity: 'error', title: 'Package rules', text: "The contract kit's own checks (tools/formpkg.py): required fields, ids, versions, permissions, contributes, entry.ui, file types, paths and file count." },
  { id: 'schema', severity: 'error', title: 'Manifest schema', text: 'contract/schema/package.schema.json: lengths, https addresses, panel locations, unknown keys in entry and contributes.' },
  { id: 'host', severity: 'error', title: 'Host acceptance', text: 'What an API 1 host checks before loading (contract section 3), with formext_host.check.' },
  { id: 'missing-entry', severity: 'error', title: 'Entry page', text: 'entry.ui exists and is an HTML page.' },
  { id: 'missing-file', severity: 'error', title: 'Files the code loads', text: 'Every relative script, style, image, import and url() points at a file in the package.' },
  { id: 'csp-inline-script', severity: 'error', title: 'Inline script', text: 'The extension CSP allows scripts from the package only: inline <script>, on* attributes and javascript: links never run.' },
  { id: 'csp-external', severity: 'error', title: 'Outside resources', text: 'Scripts, styles, fonts, images and media load only from the package; anything from the internet is blocked.' },
  { id: 'csp-frame', severity: 'error', title: 'Frames and base', text: "frame-src and base-uri are 'none'." },
  { id: 'no-network', severity: 'error', title: 'Direct network use', text: "connect-src is 'none': fetch, XMLHttpRequest, WebSocket, EventSource and sendBeacon fail. Use net.fetch with the network permission." },
  { id: 'no-eval', severity: 'error', title: 'eval', text: "The CSP has no 'unsafe-eval': eval, new Function and string timers fail." },
  { id: 'sandbox-storage', severity: 'error', title: 'Browser storage', text: 'The sandbox has an opaque origin: localStorage, sessionStorage, indexedDB and cookies throw. Use storage.get and storage.set.' },
  { id: 'sandbox-ui', severity: 'warning', title: 'Dialogs, popups and forms', text: "The sandbox allows scripts only: alert, confirm, prompt, window.open, target=_blank and form submits do nothing, and the parent's DOM is out of reach." },
  { id: 'undeclared-permission', severity: 'error', title: 'Permission used but not declared', text: 'Calls that need a permission missing from the manifest fail with -32001.' },
  { id: 'unused-permission', severity: 'warning', title: 'Permission declared but not used', text: 'Every permission is shown to the person in the consent dialog; ask only for what the code calls.' },
  { id: 'headless-command', severity: 'warning', title: 'Headless commands', text: 'A command without a panel must handle ext.activate and call ext.done, or the host closes it after 120 s idle.' },
  { id: 'file-size', severity: 'warning', title: 'File sizes', text: 'Single files over 5 MB slow every load; the packed package must stay under 20 MB.' },
  { id: 'description', severity: 'info', title: 'Description', text: 'The index and FormPortal show the description; without one they show the name.' },
];
const RULE_SEVERITY: Record<string, string> = Object.fromEntries(RULES.map((r) => [r.id, r.severity]));

const FIX: Record<string, string> = {
  format: 'Set "format": "formai-package".',
  format_version: 'Set "format_version": 1.',
  id: 'Use 2 to 64 lower-case letters, digits and hyphens, starting with a letter or digit.',
  name: 'Give the extension a name.',
  author: 'Fill in the author (settings hold a default).',
  licence: 'Fill in the licence, for example "Apache-2.0".',
  product: `Pick one of: ${kit.PRODUCTS.join(', ')}.`,
  kind: 'Extensions with panels or commands are "script-plugin".',
  version: 'Write the version as three numbers, like 0.1.0.',
  minimum_app: 'Write it as three numbers, or leave it out while testing against a source build.',
  native: 'Set "native": false; API 1 hosts do not load native extensions.',
  permissions: `List each permission once, from: ${kit.PERMISSIONS.join(', ')}.`,
  api: 'Set "api": "1".',
  description: 'Keep the description to 400 characters.',
  homepage: 'Use an https:// address.',
  support: 'Use an https:// address.',
  payload: 'Name the payload file, or remove the key.',
  entry: 'entry holds only "ui".',
  'entry.ui': 'Point entry.ui at the HTML page inside the package, for example "ui/index.html".',
  contributes: 'contributes holds only panels and commands.',
  'contributes.panels': 'At most 8 panels.',
  'contributes.commands': 'At most 32 commands.',
  'contributes.panels.id': 'Use 1 to 32 lower-case letters, digits and hyphens.',
  'contributes.commands.id': 'Use 1 to 32 lower-case letters, digits and hyphens.',
  'contributes.panels.title': 'Give the panel a title of at most 60 characters.',
  'contributes.commands.title': 'Give the command a title of at most 80 characters.',
  'contributes.panels.location': 'Use "dock" or "dialog".',
  'contributes.commands.panel': 'Name a panel id from contributes.panels, or remove "panel" to run the command headless.',
};

interface Problem {
  rule: string;
  severity: string;
  file: string;
  line: number;
  column: number;
  message: string;
  fix: string;
  path: string;
}

class Problems {
  items: Problem[] = [];
  seen = new Set<string>();
  add(rule: string, message: string, file = '', line = 0, column = 0, fix = '', severity?: string, path = ''): void {
    const key = JSON.stringify([rule, file, line, message]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.items.push({ rule, severity: severity || RULE_SEVERITY[rule] || 'error', file, line, column, message, fix, path });
  }
}

class Text {
  starts: number[] = [0];
  constructor(public text: string) {
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.starts.push(i + 1);
  }
  pos(offset: number): [number, number] {
    let lo = 0;
    let hi = this.starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.starts[mid] <= offset) lo = mid + 1;
      else hi = mid;
    }
    const i = lo - 1;
    return [i + 1, offset - this.starts[i] + 1];
  }
}

type Path = (string | number)[];
const pkey = (p: Path) => JSON.stringify(p);

function locate(src: string): Map<string, number> {
  const out = new Map<string, number>();
  const t = new Text(src);
  const n = src.length;
  const scalar = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
  const ws = (i: number) => {
    while (i < n && ' \t\r\n'.includes(src[i])) i++;
    return i;
  };
  const string = (i: number): [string, number] => {
    let j = i + 1;
    while (j < n) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === '"') return [JSON.parse(src.slice(i, j + 1)), j + 1];
      j++;
    }
    throw new Error('unterminated string');
  };
  const value = (i: number, path: Path): number => {
    i = ws(i);
    if (!out.has(pkey(path))) out.set(pkey(path), t.pos(i)[0]);
    const c = src[i];
    if (c === undefined) throw new Error('end');
    if (c === '{') {
      i = ws(i + 1);
      if (src[i] === '}') return i + 1;
      for (;;) {
        i = ws(i);
        const [key, end] = string(i);
        out.set(pkey([...path, key]), t.pos(i)[0]);
        i = ws(end);
        i = value(i + 1, [...path, key]);
        i = ws(i);
        if (src[i] === ',') {
          i++;
          continue;
        }
        return i + 1;
      }
    }
    if (c === '[') {
      i = ws(i + 1);
      if (src[i] === ']') return i + 1;
      let k = 0;
      for (;;) {
        i = value(i, [...path, k]);
        i = ws(i);
        k++;
        if (src[i] === ',') {
          i++;
          continue;
        }
        return i + 1;
      }
    }
    if (c === '"') return string(i)[1];
    scalar.lastIndex = i;
    const m = scalar.exec(src);
    if (!m) throw new Error('bad value');
    return i + m[0].length;
  };
  try {
    value(0, []);
  } catch {
    return out;
  }
  return out;
}

export function pathText(path: Path): string {
  let out = '';
  for (const part of path) out += typeof part === 'number' ? `[${part}]` : out ? `.${part}` : String(part);
  return out;
}

function pathKey(path: Path): string {
  return path.filter((p) => typeof p !== 'number').join('.');
}

function same(a: unknown, b: unknown): boolean {
  return typeof a === typeof b && JSON.stringify(a) === JSON.stringify(b);
}

const isObj = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const TYPE_OK: Record<string, (v: unknown) => boolean> = {
  object: isObj,
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  boolean: (v) => typeof v === 'boolean',
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === 'number',
};

function pyList(v: unknown): string {
  return JSON.stringify(v).replace(/","/g, '", "');
}

export function schemaErrors(schema: Json, root: Json, value: unknown, path: Path = []): [Path, string][] {
  const ref = schema.$ref;
  if (typeof ref === 'string' && ref.startsWith('#/')) {
    let node = root;
    for (const part of ref.slice(2).split('/')) node = node?.[part] ?? {};
    const rest = { ...schema };
    delete rest.$ref;
    schema = { ...node, ...rest };
  }
  const name = pathText(path) || 'manifest';
  const out: [Path, string][] = [];
  if ('const' in schema && !same(value, schema.const)) return [[path, `${name} must be ${JSON.stringify(schema.const)}`]];
  if ('enum' in schema && !schema.enum.some((e: unknown) => same(value, e))) return [[path, `${name} must be one of ${schema.enum.map(String).join(', ')}`]];
  const kind = schema.type;
  if (kind && TYPE_OK[kind] && !TYPE_OK[kind](value)) return [[path, `${name} must be ${'aeiou'.includes(kind[0]) ? 'an' : 'a'} ${kind}`]];
  if (typeof value === 'string') {
    if ('minLength' in schema && value.length < schema.minLength) out.push([path, schema.minLength === 1 ? `${name} must not be empty` : `${name} is shorter than ${schema.minLength} characters`]);
    if ('maxLength' in schema && value.length > schema.maxLength) out.push([path, `${name} is ${value.length} characters; at most ${schema.maxLength}`]);
    if ('pattern' in schema && !new RegExp(schema.pattern).test(value)) out.push([path, `${name} ${JSON.stringify(value)} does not match ${schema.pattern}`]);
  }
  if (Array.isArray(value)) {
    if ('maxItems' in schema && value.length > schema.maxItems) out.push([path, `${name} has ${value.length} items; at most ${schema.maxItems}`]);
    if ('minItems' in schema && value.length < schema.minItems) out.push([path, `${name} needs at least ${schema.minItems} items`]);
    if (schema.uniqueItems) {
      const seen: unknown[] = [];
      for (const v of value) {
        if (seen.some((s) => same(v, s))) out.push([path, `${name} lists ${JSON.stringify(v)} twice`]);
        seen.push(v);
      }
    }
    if (isObj(schema.items)) value.forEach((v, i) => out.push(...schemaErrors(schema.items, root, v, [...path, i])));
  }
  if (isObj(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) out.push([[...path, key], `${pathText([...path, key])} is required`]);
    const props = schema.properties ?? {};
    for (const [key, v] of Object.entries(value)) {
      if (key in props) out.push(...schemaErrors(props[key], root, v, [...path, key]));
      else if (schema.additionalProperties === false) out.push([[...path, key], `${name} has an unknown key ${JSON.stringify(key)}`]);
    }
  }
  return out;
}

export { pyList };

function pkgPath(message: string): string {
  const body = message.startsWith('manifest.json: ') ? message.split(': ').slice(1).join(': ') : message;
  let m = /^contributes\.(panels|commands) id /.exec(body);
  if (m) return `contributes.${m[1]}.id`;
  m = /^contributes\.(panels|commands) .* needs a title/.exec(body);
  if (m) return `contributes.${m[1]}.title`;
  if (body.startsWith('command ') && body.includes('names panel')) return 'contributes.commands.panel';
  if (body.startsWith('entry.ui')) return 'entry.ui';
  m = /^(\S+) is required/.exec(body);
  if (m) return m[1];
  return body.split(' ')[0];
}

function fixFor(key: string): string {
  const parts = key.split('.');
  while (parts.length) {
    const hit = FIX[parts.join('.')];
    if (hit) return hit;
    parts.pop();
  }
  return '';
}

function hostPath(reason: string): string {
  const pairs: [string, string][] = [['formai package', 'format'], ["manifest says '", 'id'], ['made for', 'product'], ['version', 'version'], ['extension API', 'api'], ['native', 'native'], ['permission', 'permissions'], ['needs ', 'minimum_app'], ['entry.ui', 'entry.ui']];
  for (const [needle, key] of pairs) if (reason.includes(needle)) return key;
  return '';
}

const REGEX_BEFORE = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
const WORD_CHAR = /[\p{L}\p{N}_$]/u;

function scanJs(src: string): [string, string] {
  const code = src.split('');
  const bare = src.split('');
  const n = src.length;
  let i = 0;
  let last = '';
  let word = '';
  let depth = 0;
  const templates: number[] = [];

  const blankOut = (a: number, b: number, both: boolean) => {
    for (let k = a; k < Math.min(b, n); k++) {
      if (src[k] === '\n') continue;
      bare[k] = ' ';
      if (both) code[k] = ' ';
    }
  };

  const quoted = (at: number, q: string): number => {
    let j = at + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === q || c === '\n') break;
      j++;
    }
    blankOut(at + 1, j, false);
    return j + 1;
  };

  const template = (at: number): number => {
    let j = at;
    while (j < n) {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '`') {
        blankOut(at, j, false);
        return j + 1;
      }
      if (c === '$' && src[j + 1] === '{') {
        blankOut(at, j, false);
        templates.push(depth);
        return j + 2;
      }
      j++;
    }
    blankOut(at, n, false);
    return n;
  };

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      i = quoted(i, c);
      last = '"';
      word = '';
      continue;
    }
    if (c === '`') {
      i = template(i + 1);
      last = '"';
      word = '';
      continue;
    }
    if (c === '/' && src.startsWith('//', i)) {
      let end = src.indexOf('\n', i);
      end = end < 0 ? n : end;
      blankOut(i, end, true);
      i = end;
      continue;
    }
    if (c === '/' && src.startsWith('/*', i)) {
      let end = src.indexOf('*/', i + 2);
      end = end < 0 ? n : end + 2;
      blankOut(i, end, true);
      i = end;
      continue;
    }
    if (c === '/' && (!last || REGEX_BEFORE.has(last) || REGEX_WORDS.has(word))) {
      let j = i + 1;
      let klass = false;
      while (j < n && src[j] !== '\n') {
        const d = src[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        if (d === '[') klass = true;
        else if (d === ']') klass = false;
        else if (d === '/' && !klass) break;
        j++;
      }
      if (j < n && src[j] === '/') {
        blankOut(i + 1, j, false);
        i = j + 1;
        last = '"';
        word = '';
        continue;
      }
    }
    if (c === '{') depth++;
    else if (c === '}') {
      if (templates.length && templates[templates.length - 1] === depth) {
        templates.pop();
        i = template(i + 1);
        last = '"';
        word = '';
        continue;
      }
      depth--;
    }
    if (WORD_CHAR.test(c)) {
      let j = i;
      while (j < n && WORD_CHAR.test(src[j])) j++;
      word = src.slice(i, j);
      last = 'a';
      i = j;
      continue;
    }
    last = c;
    word = '';
    i++;
  }
  return [code.join(''), bare.join('')];
}

function defines(bare: string, open: number): boolean {
  let level = 0;
  const n = bare.length;
  let i = open;
  for (; i < n; i++) {
    const c = bare[i];
    if (c === '(') level++;
    else if (c === ')') {
      level--;
      if (level === 0) break;
    }
  }
  i++;
  while (i < n && ' \t\r\n'.includes(bare[i])) i++;
  return i < n && bare[i] === '{';
}

const blank = (s: string) => s.replace(/[^\n]/g, ' ');
const stripHtml = (s: string) => s.replace(/<!--[\s\S]*?-->/g, blank);
const stripCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, blank);

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const SKIP_REF = /^(?:#|data:|blob:|mailto:|about:|javascript:)/i;
const JS_RULES: [string, RegExp, string, string][] = [
  ['no-network', /(?<![\w$.])fetch\s*\(/g, "fetch() is blocked: the extension CSP sets connect-src 'none'.", 'Call the host instead: formext.fetch(url) (net.fetch) with the network permission. To read a file of your own package, import it as a module.'],
  ['no-network', /\b(?:window|globalThis|self)\.fetch\s*\(/g, "fetch() is blocked: the extension CSP sets connect-src 'none'.", 'Call the host instead: formext.fetch(url) (net.fetch) with the network permission.'],
  ['no-network', /\bXMLHttpRequest\b/g, "XMLHttpRequest is blocked: connect-src is 'none'.", 'Use formext.fetch(url) (net.fetch) with the network permission.'],
  ['no-network', /\bWebSocket\s*\(/g, "WebSocket is blocked: connect-src is 'none'.", 'API 1 has no sockets; poll with formext.fetch(url) (net.fetch) or listen to ext.event from the host.'],
  ['no-network', /\bEventSource\s*\(/g, "EventSource is blocked: connect-src is 'none'.", 'Listen to ext.event from the host, or poll with net.fetch.'],
  ['no-network', /\bnavigator\.sendBeacon\s*\(/g, "sendBeacon is blocked: connect-src is 'none'.", 'Use formext.fetch(url) (net.fetch) with the network permission.'],
  ['no-eval', /(?<![\w$.])eval\s*\(/g, "eval() is blocked: the CSP has no 'unsafe-eval'.", 'Parse data with JSON.parse, or write the code as a module in the package.'],
  ['no-eval', /\bnew\s+Function\s*\(/g, "new Function() is blocked: the CSP has no 'unsafe-eval'.", 'Write the function in a module in the package.'],
  ['no-eval', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/g, 'A string timer is evaluated as code, which the CSP blocks.', 'Pass a function: setTimeout(() => work(), ms).'],
  ['sandbox-storage', /\b(?:localStorage|sessionStorage|indexedDB)\b/g, '{0} throws in the sandbox: the frame has an opaque origin.', 'Use formext.storageGet(key) and formext.storageSet(key, value) (storage.get, storage.set), 256 KB per extension.'],
  ['sandbox-storage', /\bdocument\.cookie\b/g, 'document.cookie throws in the sandbox: the frame has an opaque origin.', 'Use formext.storageSet(key, value) (storage.set).'],
  ['sandbox-ui', /(?:(?<![\w$.])|\bwindow\.)(?:alert|confirm|prompt)\s*\(/g, '{0} does nothing in the sandbox: modals are not allowed.', 'Tell the person with formext.notify(message, level) (ui.notify), or ask inside your own page.'],
  ['sandbox-ui', /\bwindow\.open\s*\(/g, 'window.open does nothing in the sandbox: popups are not allowed.', 'Show the content inside your panel, or fetch it through net.fetch.'],
  ['sandbox-ui', /\b(?:top|parent)\.(?:document|location)\b/g, "{0} is out of reach: the host's window is another origin.", 'Talk to the host only through postMessage (the SDK).'],
];
const IMPORT_RE = /(?:(?<![.$])\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|(?<![.$])\bimport\s*\(\s*|\bnew\s+Worker\s*\(\s*)(['"])([^'"\n]+)\1/g;
const METHOD_STRING = /['"`]((?:document|app|files|net|ext|host|ui|storage)\.[a-zA-Z]+)['"`]/g;
const METHOD_ITEM = String.raw`\s*['"\x60](?:document|app|files|net|ext|host|ui|storage)\.[a-zA-Z]+['"\x60]\s*`;
const METHOD_LIST = new RegExp(String.raw`\[` + METHOD_ITEM + '(?:,' + METHOD_ITEM + String.raw`)+\]`, 'g');
const SDK_WRAPPER = /\bthis\s*\.\s*(?:call|on)\s*(?:<[^()]*>)?\s*\(\s*$/;
const SDK_CALLS: [RegExp, string][] = [
  [/\.readDocument\s*\(/g, 'document.read'],
  [/\.apply\s*\(\s*['"`]/g, 'document.apply'],
  [/\.run\s*\(\s*['"`]/g, 'app.run'],
  [/\.openFiles\s*\(/g, 'files.open'],
  [/\.saveFile\s*\(/g, 'files.save'],
  [/\.done\s*\(/g, 'ext.done'],
  [/\.onActivate\s*\(/g, 'ext.activate'],
];
const CLIENT_FETCH = /\b([A-Za-z_$][\w$]*)\.fetch\s*\(/g;
const NEEDS: Record<string, string> = { 'document.read': 'document', 'document.apply': 'document', 'app.commands': 'document', 'app.run': 'document', 'files.open': 'files-read', 'files.save': 'files-write', 'net.fetch': 'network' };

const isSdk = (t: string) => t.includes('class FormExt') && t.includes('host.hello');

function group(m: RegExpExecArray, n: number): number {
  const d = (m as RegExpExecArray & { indices?: [number, number][] }).indices;
  return d?.[n]?.[0] ?? m.index;
}

function* all(rx: RegExp, s: string): Generator<RegExpExecArray> {
  const r = new RegExp(rx.source, rx.flags.includes('d') ? rx.flags : `${rx.flags}d`);
  let m: RegExpExecArray | null;
  while ((m = r.exec(s))) {
    yield m;
    if (m[0] === '') r.lastIndex++;
  }
}

function normalise(base: string, ref: string): string | null {
  const parts = base.split('/').slice(0, -1);
  for (const p of ref.split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(p);
  }
  return parts.join('/');
}

class Linter {
  uses = new Map<string, [string, number]>();
  constructor(public folder: Folder, public prefix: string, public out: Problems) {}

  rel(p: string): string {
    return this.prefix ? `${this.prefix}/${p}` : p;
  }

  exists(base: string, ref: string): boolean | null {
    ref = ref.split('#')[0].split('?')[0];
    if (!ref) return null;
    const target = ref.startsWith('/') ? normalise('x', ref.replace(/^\/+/, '')) : normalise(base, ref);
    return target !== null && this.folder.has(target);
  }

  ref(file: string, t: Text, offset: number, ref: string, what: string): void {
    ref = ref.trim();
    if (!ref || SKIP_REF.test(ref)) return;
    const [line, col] = t.pos(offset);
    if (EXTERNAL.test(ref)) {
      this.out.add('csp-external', `${what} ${ref} is blocked: extensions load only their own files.`, this.rel(file), line, col, 'Copy the file into the package and point at it with a relative path.');
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return;
    if (what === 'import' && !ref.startsWith('.') && !ref.startsWith('/')) {
      this.out.add('missing-file', `import ${JSON.stringify(ref)} is a bare name; the browser cannot resolve it without a bundler.`, this.rel(file), line, col, 'Import with a relative path, for example "./formext.js".');
      return;
    }
    if (this.exists(file, ref) === false) this.out.add('missing-file', `${what} ${ref} is not in the package.`, this.rel(file), line, col, 'Add the file, or fix the path (it is relative to this file).');
  }

  use(method: string, file: string, t: Text, offset: number): void {
    if (!this.uses.has(method)) this.uses.set(method, [this.rel(file), t.pos(offset)[0]]);
  }

  js(file: string, src: string, base = 0, t?: Text): void {
    t = t ?? new Text(src);
    const [code, bare] = scanJs(src);
    for (const [rule, rx, message, fix] of JS_RULES) {
      for (const m of all(rx, bare)) {
        if (m[0].endsWith('(') && defines(bare, m.index + m[0].length - 1)) continue;
        const [line, col] = t.pos(base + m.index);
        this.out.add(rule, message.replace('{0}', m[0].replace(/[( ]+$/, '').trim()), this.rel(file), line, col, fix);
      }
    }
    for (const m of all(IMPORT_RE, code)) {
      if (bare[m.index] !== code[m.index]) continue;
      this.ref(file, t, base + group(m, 2), m[2], 'import');
    }
    const lists = [...all(METHOD_LIST, code)].map((m) => [m.index, m.index + m[0].length]);
    for (const m of all(METHOD_STRING, code)) {
      if (SDK_WRAPPER.test(code.slice(Math.max(0, m.index - 48), m.index)) || lists.some(([a, b]) => a <= m.index && m.index < b)) continue;
      this.use(m[1], file, t, base + m.index);
    }
    for (const [rx, method] of SDK_CALLS) for (const m of all(rx, bare)) this.use(method, file, t, base + m.index);
    for (const m of all(CLIENT_FETCH, bare)) {
      if (defines(bare, m.index + m[0].length - 1)) continue;
      if (!['window', 'globalThis', 'self'].includes(m[1])) this.use('net.fetch', file, t, base + m.index);
    }
  }

  css(file: string, src: string, base = 0, t?: Text): void {
    t = t ?? new Text(src);
    const code = stripCss(src);
    for (const m of all(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, code)) this.ref(file, t, base + group(m, 2), m[2], 'url()');
    for (const m of all(/@import\s+(['"])([^'"]+)\1/g, code)) this.ref(file, t, base + group(m, 2), m[2], '@import');
  }

  html(file: string, src: string): void {
    const t = new Text(src);
    const code = stripHtml(src);
    for (const m of all(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, code)) {
      const attrs = m[1];
      const body = m[2];
      const at1 = group(m, 1);
      const at2 = group(m, 2);
      const src2 = /\bsrc\s*=\s*(['"]?)([^'"\s>]+)\1/di.exec(attrs);
      const kind = /\btype\s*=\s*(['"]?)([^'"\s>]+)\1/i.exec(attrs);
      const kv = kind ? kind[2].toLowerCase() : '';
      if (src2) this.ref(file, t, at1 + group(src2, 2), src2[2], 'script');
      else if (body.trim() && (!kv || ['module', 'text/javascript', 'application/javascript', 'importmap'].includes(kv))) {
        const [line, col] = t.pos(m.index);
        this.out.add('csp-inline-script', 'This inline <script> never runs: the CSP allows scripts from the package only.', this.rel(file), line, col, 'Move the code into a .js file in the package and load it with <script type="module" src="...">.');
      }
      if (!src2 && !['application/json', 'application/ld+json', 'text/template', 'text/plain'].includes(kv)) this.js(file, body, at2, t);
    }
    for (const m of all(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, code)) this.css(file, m[1], group(m, 1), t);
    for (const tag of all(/<([a-zA-Z][\w-]*)\b([^>]*)>/g, code)) {
      const name = tag[1].toLowerCase();
      const attrs = tag[2];
      const offset = group(tag, 2);
      for (const a of all(/\s(on[a-z]+)\s*=/gi, attrs)) {
        const [line, col] = t.pos(offset + group(a, 1));
        this.out.add('csp-inline-script', `The ${a[1]} attribute never runs: the CSP blocks inline handlers.`, this.rel(file), line, col, `Add the listener in your module: element.addEventListener('${a[1].slice(2).toLowerCase()}', ...).`);
      }
      for (const a of all(/\s(src|href|poster|data)\s*=\s*(['"]?)([^'"\s>]*)\2/gi, attrs)) {
        const attr = a[1].toLowerCase();
        const value = a[3];
        const vat = offset + group(a, 3);
        if (value.toLowerCase().startsWith('javascript:')) {
          const [line, col] = t.pos(vat);
          this.out.add('csp-inline-script', 'A javascript: link never runs: the CSP blocks inline script.', this.rel(file), line, col, 'Use a button with a listener added in your module.');
          continue;
        }
        if (name === 'script' && attr === 'src') continue;
        if (name === 'a' && attr === 'href') {
          if (EXTERNAL.test(value)) {
            const [line, col] = t.pos(vat);
            this.out.add('sandbox-ui', `The link ${value} cannot open: the sandbox blocks navigation and popups.`, this.rel(file), line, col, 'Show the address as text, or fetch the content through net.fetch.');
          }
          continue;
        }
        if (name === 'link' && !/\brel\s*=\s*['"]?(?:stylesheet|icon|preload|modulepreload)/i.test(attrs)) continue;
        this.ref(file, t, vat, value, `<${name} ${attr}>`);
      }
      for (const a of all(/\sstyle\s*=\s*(['"])([\s\S]*?)\1/gi, attrs)) this.css(file, a[2], offset + group(a, 2), t);
      if (['iframe', 'frame', 'object', 'embed'].includes(name)) {
        const [line, col] = t.pos(tag.index);
        this.out.add('csp-frame', `<${name}> is blocked: frame-src is 'none'.`, this.rel(file), line, col, 'Show the content directly in your page.');
      } else if (name === 'base') {
        const [line, col] = t.pos(tag.index);
        this.out.add('csp-frame', "<base> is blocked: base-uri is 'none'.", this.rel(file), line, col, 'Remove it and use relative paths.');
      } else if (name === 'form' && !/\bonsubmit\b/i.test(attrs)) {
        const [line, col] = t.pos(tag.index);
        this.out.add('sandbox-ui', 'A <form> cannot submit in the sandbox.', this.rel(file), line, col, 'Handle the submit event in your module and call event.preventDefault().');
      }
      if (/\btarget\s*=\s*['"]?_blank/i.test(attrs)) {
        const [line, col] = t.pos(tag.index);
        this.out.add('sandbox-ui', 'target="_blank" does nothing: the sandbox blocks popups.', this.rel(file), line, col, 'Remove the target.');
      }
    }
  }

  run(files: string[]): void {
    for (const p of files) {
      const s = suffix(p);
      if (!LINT_TYPES.has(s)) continue;
      const data = this.folder.get(p)!;
      if (data.length > TEXT_LIMIT) continue;
      const src = decode(data);
      if (s === '.js' || s === '.mjs') {
        if (isSdk(src)) continue;
        this.js(p, src);
      } else if (s === '.css') this.css(p, src);
      else this.html(p, src);
    }
  }
}

function jsonError(raw: string, e: Error): { msg: string; line: number; col: number } {
  const m = /line (\d+) column (\d+)/.exec(e.message);
  const pos = /position (\d+)/.exec(e.message);
  let line = 1;
  let col = 1;
  if (m) [line, col] = [Number(m[1]), Number(m[2])];
  else if (pos) [line, col] = new Text(raw).pos(Number(pos[1]));
  const msg = e.message.replace(/\s*\(line \d+ column \d+\)/, '').replace(/ in JSON at position \d+/, '');
  return { msg, line, col };
}

export async function validateFolder(folder: Folder, prefix = ''): Promise<Json> {
  const started = now();
  const t0 = performance.now();
  const out = new Problems();
  const mfile = prefix ? `${prefix}/manifest.json` : 'manifest.json';
  let raw = '';
  let manifest: Json = null;
  let lines = new Map<string, number>();
  const mdata = folder.get('manifest.json');
  if (!mdata) out.add('json', 'There is no manifest.json at the package root.', mfile, 0, 0, 'Create manifest.json (the New pane writes a working one).');
  else {
    const s = strictText(mdata);
    if (s === null) out.add('json', "manifest.json cannot be read: 'utf-8' codec can't decode it", mfile, 0, 0, 'Save it as UTF-8 text.');
    else raw = s;
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isObj(parsed)) {
        manifest = parsed;
        lines = locate(raw);
      } else out.add('json', 'manifest.json must hold one JSON object.', mfile, 1, 1, 'Wrap the fields in { }.');
    } catch (e) {
      const j = jsonError(raw, e as Error);
      out.add('json', `manifest.json is not valid JSON: ${j.msg}.`, mfile, j.line, j.col, 'Fix the syntax at this line: check commas, quotes and brackets.');
    }
  }
  const lineOf = (path: Path): number => {
    let p = [...path];
    while (p.length) {
      const hit = lines.get(pkey(p));
      if (hit !== undefined) return hit;
      p = p.slice(0, -1);
    }
    return lines.get(pkey([])) ?? (manifest !== null ? 1 : 0);
  };
  const keyLine = (key: string) => (key ? lineOf(key.split('.')) : lineOf([]));
  const [files, fileErrs] = kit.filesOf(folder);
  for (const msg of fileErrs) {
    const i = msg.indexOf(': ');
    const rel = i >= 0 ? msg.slice(0, i) : msg;
    const t = i >= 0 ? msg.slice(i + 2) : '';
    if (t && folder.has(rel)) out.add('package', `${t[0].toUpperCase()}${t.slice(1)}.`, prefix ? `${prefix}/${rel}` : rel, 0, 0, t.includes('file type') ? `Only the contract's file types go into a package: ${Object.keys(kit.TYPES).sort().join(' ')}.` : t.includes('symlink') ? 'Replace the link with the file itself.' : 'Shorten the path to 200 characters.');
    else out.add('package', `${msg[0].toUpperCase()}${msg.slice(1)}.`, mfile, 0, 0, `Keep the package to ${kit.MAX_FILES} files.`);
  }
  const reported = new Set<string>();
  if (manifest !== null) {
    let pkgErrs: string[] = [];
    try {
      pkgErrs = kit.problems(folder)[0];
    } catch (e) {
      out.add('package', `The kit's package check (formpkg) stopped on this manifest (${(e as Error).name}); the schema problems say why.`, mfile, 1, 1, 'Make entry and contributes objects, entry.ui text, and panels and commands lists of objects.', 'info');
    }
    for (const msg of pkgErrs) {
      const key = pkgPath(msg);
      reported.add(key);
      const body = msg.startsWith('manifest.json: ') ? msg.split(': ').slice(1).join(': ') : msg;
      const rule = key === 'entry.ui' && body.includes('not a file') ? 'missing-entry' : 'package';
      const fix = rule === 'missing-entry' ? 'Create the page at that path, or point entry.ui at the HTML page you have.' : FIX[key] ?? '';
      out.add(rule, `${body}.`, mfile, keyLine(key), 0, fix, undefined, key);
    }
    const schema = packageSchema as Json;
    for (const [path, msg] of schemaErrors(schema, schema, manifest)) {
      const key = pathKey(path);
      if ([...reported].some((r) => key === r || key.startsWith(`${r}.`))) continue;
      out.add('schema', `${msg}.`, mfile, lineOf(path), 0, fixFor(key) || 'See contract/schema/package.schema.json.', undefined, pathText(path));
      reported.add(key);
    }
    if (!('api' in manifest)) {
      out.add('host', 'An API 1 host refuses it: there is no "api" field.', mfile, lineOf([]), 0, FIX.api, undefined, 'api');
      reported.add('api');
    }
    if (manifest.native === true && !reported.has('native')) {
      out.add('host', 'An API 1 host refuses it: native extensions are not supported.', mfile, keyLine('native'), 0, FIX.native, undefined, 'native');
      reported.add('native');
    }
    const mid = String(manifest.id ?? '');
    const product = String(manifest.product ?? '');
    if (kit.ID_RE.test(mid) && kit.PRODUCTS.includes(product)) {
      try {
        const e = kit.check(kit.extension(mid, String(manifest.version ?? '0.0.0'), 'development', ''), folder, product, '99.99.9', product);
        if (e.state === 'refused') {
          const key = hostPath(e.reason);
          if (!key || ![...reported].some((r) => key === r || key.startsWith(`${r}.`) || r.startsWith(`${key}.`))) {
            out.add('host', `An API 1 host would refuse it: ${e.reason}.`, mfile, keyLine(key), 0, FIX[key] ?? '', undefined, key);
            reported.add(key);
          }
        }
      } catch (e) {
        out.add('host', `The host check stopped: ${(e as Error).name}.`, mfile, 1, 0, '');
      }
    }
    const entry = isObj(manifest.entry) ? manifest.entry.ui : null;
    if (typeof entry === 'string' && entry && !/\.html?$/i.test(entry) && !reported.has('entry.ui')) out.add('missing-entry', `entry.ui ${entry} is not an HTML page; the host loads it in a frame.`, mfile, keyLine('entry.ui'), 0, 'Point entry.ui at an .html page.', 'warning', 'entry.ui');
    if (!manifest.description && !reported.has('description')) out.add('description', 'There is no description.', mfile, lineOf([]), 0, 'Add one sentence that says what the extension does (at most 400 characters).', undefined, 'description');
  }
  const lint = new Linter(folder, prefix, out);
  lint.run(files);
  if (manifest !== null) {
    const declared: string[] = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    const used = new Map<string, [string, number, string]>();
    for (const [method, [file, line]] of lint.uses) {
      const perm = NEEDS[method];
      if (perm && !used.has(perm)) used.set(perm, [file, line, method]);
    }
    for (const [perm, [file, line, method]] of used) if (!declared.includes(perm)) out.add('undeclared-permission', `The code calls ${method}, which needs the ${perm} permission (${PLAIN[perm]}), and the manifest does not ask for it.`, file, line, 0, `Add "${perm}" to permissions in manifest.json.`);
    if (!reported.has('permissions')) {
      declared.forEach((perm, i) => {
        if (used.has(perm) || !(perm in PLAIN)) return;
        const t = perm === 'models' || perm === 'native-code' ? `The ${perm} permission (${PLAIN[perm]}) has no API 1 method; the consent dialog shows it for nothing.` : `The manifest asks for ${perm} (${PLAIN[perm]}), but no code calls a method that needs it.`;
        out.add('unused-permission', t, mfile, lineOf(['permissions', i]), 0, `Remove "${perm}" from permissions, unless code loaded at run time calls it.`, undefined, `permissions[${i}]`);
      });
    }
    const contributes = isObj(manifest.contributes) ? manifest.contributes : {};
    const commands: Json[] = Array.isArray(contributes.commands) ? contributes.commands : [];
    const handles = lint.uses.has('ext.activate');
    const finishes = lint.uses.has('ext.done');
    commands.forEach((c, i) => {
      if (!isObj(c) || c.panel) return;
      if (!handles) out.add('headless-command', `Command ${pyRepr(c.id)} runs headless, but no code handles ext.activate.`, mfile, lineOf(['contributes', 'commands', i]), 0, 'Handle it: formext.onActivate(({ command }) => ...), or give the command a panel.', undefined, `contributes.commands[${i}]`);
      else if (!finishes) out.add('headless-command', `Command ${pyRepr(c.id)} runs headless, but no code calls ext.done; the host closes it after 120 s idle.`, mfile, lineOf(['contributes', 'commands', i]), 0, 'Call formext.done(result) when the command has finished.', undefined, `contributes.commands[${i}]`);
    });
  }
  let total = 0;
  for (const p of files) {
    const size = folder.get(p)!.length;
    total += size;
    if (size > LARGE_FILE) out.add('file-size', `This file is ${(size / 1048576).toFixed(1)} MB.`, lint.rel(p), 0, 0, 'Compress it, or load less at once; the packed package must stay under 20 MB.');
  }
  if (total > kit.MAX_BYTES) {
    let packed = 0;
    for (const p of files) packed += (await deflate(folder.get(p)!)).length + 100;
    if (packed > kit.MAX_BYTES) out.add('file-size', `The package would be about ${(packed / 1048576).toFixed(1)} MB packed; at most 20 MB.`, mfile, 0, 0, 'Remove or shrink the largest files.', 'error');
  }
  const order = (s: string) => {
    const i = SEVERITIES.indexOf(s);
    return i < 0 ? 9 : i;
  };
  out.items.sort((a, b) => order(a.severity) - order(b.severity) || Number(a.file !== mfile) - Number(b.file !== mfile) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line || a.column - b.column);
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, out.items.filter((p) => p.severity === s).length]));
  return { ok: counts.error === 0, counts, problems: out.items, files: files.length, bytes: total, manifest: mfile, id: manifest?.id ?? null, product: manifest?.product ?? null, checked_at: started, ms: Math.round(performance.now() - t0) };
}

export async function validateProject(pid: string, folder: Folder, prefix: string): Promise<Json> {
  const result = await validateFolder(folder, prefix);
  result.project = pid;
  emit('validate.done', { id: pid, ok: result.ok, counts: result.counts, checked_at: result.checked_at });
  return result;
}
