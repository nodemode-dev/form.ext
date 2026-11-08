import { EditorState, EditorSelection, StateEffect, StateField, Text } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, HighlightStyle, indentUnit } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { linter, lintGutter, lintKeymap } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { tags as t } from '@lezer/highlight';

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: 'var(--edit-syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--edit-syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--edit-syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--edit-syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--edit-syn-function)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--edit-syn-property)' },
  { tag: [t.typeName, t.className, t.namespace, t.tagName], color: 'var(--edit-syn-type)' },
  { tag: [t.definition(t.variableName), t.labelName], color: 'var(--edit-syn-def)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket], color: 'var(--edit-syn-punct)' },
  { tag: [t.heading], color: 'var(--edit-syn-keyword)', fontWeight: '600' },
  { tag: [t.link, t.url], color: 'var(--edit-syn-string)', textDecoration: 'underline' },
  { tag: [t.emphasis], fontStyle: 'italic' },
  { tag: [t.strong], fontWeight: '600' },
  { tag: [t.invalid], color: 'var(--error)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--ink)', backgroundColor: 'var(--main)', fontSize: 'var(--edit-font, var(--fs-13))' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--accent-color)', padding: 'var(--sp-2) 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-color)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--edit-selection)' },
  '.cm-gutters': { backgroundColor: 'var(--ground)', color: 'var(--ink-faint)', border: 'none', borderRight: '1px solid var(--border-soft)' },
  '.cm-activeLine': { backgroundColor: 'var(--edit-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--edit-active-line)', color: 'var(--ink-soft)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 var(--sp-2) 0 var(--sp-3)', minWidth: '3ch' },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 var(--sp-1)', color: 'var(--ink-faint)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--edit-match)', outline: '1px solid var(--edge-strong)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--edit-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--edit-match)', outline: '1px solid var(--warning)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent-color-dim)' },
  '.cm-panels': { backgroundColor: 'var(--pane)', color: 'var(--ink)', borderColor: 'var(--edge)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--edge)' },
  '.cm-panel input, .cm-panel button': { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-12)' },
  '.cm-textfield': { backgroundColor: 'var(--bg-input)', border: '1px solid var(--edge-strong)', borderRadius: 'var(--radius-xs)', color: 'var(--ink)' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--control)', border: '1px solid var(--edge-strong)', borderRadius: 'var(--radius-xs)', color: 'var(--ink)' },
  '.cm-tooltip': { backgroundColor: 'var(--float)', color: 'var(--ink)', border: '1px solid var(--edge-strong)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-color-dim)', color: 'var(--ink)' },
  '.cm-diagnostic': { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-12)' },
  '.cm-flash-line': { backgroundColor: 'var(--accent-color-dim)' },
});

const flashEffect = StateEffect.define<number | null>();
const flashLine = Decoration.line({ class: 'cm-flash-line' });
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(flashEffect)) deco = e.value === null ? Decoration.none : Decoration.set([flashLine.range(e.value)]);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function languageFor(path: string): Extension {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return javascript();
  if (ext === 'ts' || ext === 'mts') return javascript({ typescript: true });
  if (ext === 'jsx') return javascript({ jsx: true });
  if (ext === 'tsx') return javascript({ jsx: true, typescript: true });
  if (ext === 'json') return [json(), linter(jsonParseLinter(), { delay: 300 })];
  if (ext === 'css') return css();
  if (ext === 'html' || ext === 'htm' || ext === 'svg') return html({ selfClosingTags: ext === 'svg' });
  if (ext === 'md' || ext === 'markdown') return markdown();
  return [];
}

export function languageName(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  const names: Record<string, string> = { js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'TypeScript', mts: 'TypeScript', jsx: 'JSX', tsx: 'TSX', json: 'JSON', css: 'CSS', html: 'HTML', htm: 'HTML', svg: 'SVG', md: 'Markdown', markdown: 'Markdown', txt: 'Text', cube: 'LUT' };
  return names[ext] ?? 'Text';
}

function detectIndent(text: string): string {
  const m = /^( +|\t)\S/m.exec(text);
  if (!m) return '  ';
  if (m[1] === '\t') return '\t';
  return m[1].length >= 4 ? '    ' : '  ';
}

export interface StateHooks {
  onSave: () => void;
  onUpdate: (u: ViewUpdate) => void;
}

export const editorPrefs = { tab: 2, wrap: false };

export function makeState(path: string, text: string, hooks: StateHooks): EditorState {
  return EditorState.create({
    doc: text,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({ markerDOM: (open) => { const s = document.createElement('span'); s.className = 'cm-fold-mark'; s.textContent = open ? '▾' : '▸'; return s; } }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of(detectIndent(text)),
      EditorState.tabSize.of(editorPrefs.tab),
      ...(editorPrefs.wrap ? [EditorView.lineWrapping] : []),
      syntaxHighlighting(highlight),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      lintGutter(),
      flashField,
      keymap.of([
        { key: 'Mod-s', preventDefault: true, run: () => { hooks.onSave(); return true; } },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap,
        indentWithTab,
      ]),
      languageFor(path),
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged || u.selectionSet) hooks.onUpdate(u);
      }),
    ],
  });
}

export function createView(parent: HTMLElement): EditorView {
  return new EditorView({ parent, state: EditorState.create({ doc: '', extensions: [theme, EditorView.editable.of(false)] }) });
}

export function minimalChange(doc: Text, next: string): { from: number; to: number; insert: string } | null {
  const prev = doc.toString();
  if (prev === next) return null;
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)) {
    endPrev--;
    endNext--;
  }
  return { from: start, to: endPrev, insert: next.slice(start, endNext) };
}

export function goTo(view: EditorView, line: number, column: number): void {
  const doc = view.state.doc;
  const ln = doc.line(Math.max(1, Math.min(doc.lines, line || 1)));
  const pos = Math.min(ln.to, ln.from + Math.max(0, (column || 1) - 1));
  view.dispatch({
    selection: EditorSelection.cursor(pos),
    effects: [EditorView.scrollIntoView(pos, { y: 'center' }), flashEffect.of(ln.from)],
  });
  view.focus();
  window.setTimeout(() => {
    if (view.state.field(flashField, false)) view.dispatch({ effects: flashEffect.of(null) });
  }, 1400);
}

export { EditorView, EditorState, Text };
