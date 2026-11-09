import { iso, now, utf8 } from './bytes';
import { keys } from './keys';
import { importRegistry } from './library';
import { packages } from './package';
import { PORTAL_ROOT } from './portal';
import { settings } from './settings';
import { storage } from '../../shell/storage';
import * as templates from './templates';
import * as fs from './vfs';
import { DATA, workspace, writeJson } from './workspace';

const SEED = `${DATA}/demo-seed.json`;
const SEED_VERSION = 2;
export const SAMPLE = 'golden-hour';

const APPS: [string, string, string][] = [
  ['formlit', 'FormLit', '0.50.0'],
  ['formpdf', 'FormPDF', '0.59.0'],
  ['formcut', 'FormCut', '2.14.0'],
  ['formvis', 'FormVis', '2.1.0'],
  ['formportal', 'FormPortal', '0.63.0'],
];

function portalFolder(): void {
  const installed = APPS.map(([product, name, version]) => {
    const path = `${fs.HOME}/Applications/${name}`;
    fs.write(`${path}/${name}-${version}.AppImage`, utf8('#!/bin/sh\necho "This file stands in for the app in the form.ext browser demo."\n'));
    if (product === 'formportal') fs.write(`${path}/bin/formportal-cli`, utf8('#!/bin/sh\necho "This file stands in for the FormPortal command line in the form.ext browser demo."\n'));
    return { product, channel: 'stable', current: { version, path, installed_at: iso(now() - 86400 * 3) } };
  });
  writeJson(`${PORTAL_ROOT}/installed.json`, { format: 'formportal-installed', format_version: 1, installs: installed });
}

function disk(): void {
  for (const [rel, t] of templates.exampleFiles('hello')) fs.write(`${fs.HOME}/Extensions/hello/${rel}`, utf8(t));
}

function seeded(): boolean {
  try {
    const raw = fs.read(SEED);
    return Boolean(raw) && JSON.parse(new TextDecoder().decode(raw!)).version === SEED_VERSION;
  } catch {
    return false;
  }
}

export async function seed(): Promise<void> {
  if (fs.restore() && seeded() && workspace.exists(SAMPLE)) return;
  fs.forget();
  settings.update({ author: 'Demo Author' });
  disk();
  portalFolder();
  const rating = templates.create('formlit', 'panel', 'Rating Desk');
  await packages.build(rating.id);
  await importRegistry('mail-merge').catch(() => null);
  await importRegistry('golden-hour').catch(() => null);
  await keys.create('demo-publisher', 'Demo Publisher', '', '');
  if (workspace.exists(SAMPLE)) workspace.touch(SAMPLE);
  writeJson(SEED, { version: SEED_VERSION, at: now() });
  storage.set('formext.project', SAMPLE);
}

export function resetDemo(): void {
  fs.forget();
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('formext')) localStorage.removeItem(k);
  } catch {
    return;
  }
}
