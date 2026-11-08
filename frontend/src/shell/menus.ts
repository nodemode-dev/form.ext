export type MenuItem = string;

export interface MenuDef {
  label: string;
  items: MenuItem[];
}

export const SEP = '-';

export const SYSTEM_ITEMS: Record<string, { label: string; keys: string; exec: string }> = {
  'sys:undo': { label: 'Undo', keys: 'Mod+Z', exec: 'undo' },
  'sys:redo': { label: 'Redo', keys: 'Mod+Shift+Z', exec: 'redo' },
  'sys:cut': { label: 'Cut', keys: 'Mod+X', exec: 'cut' },
  'sys:copy': { label: 'Copy', keys: 'Mod+C', exec: 'copy' },
  'sys:paste': { label: 'Paste', keys: 'Mod+V', exec: 'paste' },
  'sys:select-all': { label: 'Select All', keys: 'Mod+A', exec: 'selectAll' },
};

export const APP_MENU: MenuDef = { label: 'form.ext', items: ['shell.about', 'settings'] };

export const MENUS: MenuDef[] = [
  { label: 'File', items: ['shell.home', SEP, 'new.extension', 'shell.project', 'home.open-folder', 'home.import', SEP, 'edit.save', 'edit.save-all', 'edit.close-file', 'shell.close-project'] },
  { label: 'Edit', items: ['sys:undo', 'sys:redo', SEP, 'sys:cut', 'sys:copy', 'sys:paste', 'sys:select-all', SEP, 'edit.manifest'] },
  { label: 'View', items: ['shell.palette', 'shell.theme', 'shell.reconnect', SEP, 'terminal.toggle', 'terminal.new', 'terminal.claude', 'terminal.chat'] },
  { label: 'Project', items: ['check.run', 'run.toggle', 'run.reload', SEP, 'preview.reload', 'preview.undo', SEP, 'library.examples', 'library.compare', 'library.import'] },
  { label: 'Package', items: ['package.build', 'package.reproduce', 'package.sign', 'package.new-key'] },
  { label: 'Publish', items: ['publish.prepare', 'publish.registry'] },
  { label: 'Help', items: ['docs.manual', 'docs.contract', 'docs.sdk', SEP, 'docs.search'] },
];
