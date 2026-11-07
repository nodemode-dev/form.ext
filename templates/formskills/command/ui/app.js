import { formext } from './formext.js';
import { headless, plural } from './kit.js';

function finding(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  return f.message ?? f.text ?? JSON.stringify(f);
}

headless(async () => {
  const view = await formext.readDocument('selection');
  const r = view.reading;
  if (!r) throw new Error('Open a skill in the reader first.');
  const report = (await formext.run('check', { app: r.app, skill: r.folder, copy: r.app === 'yours' || !!r.editing })) ?? {};
  const errors = report.errors ?? 0;
  const warnings = report.warnings ?? 0;
  const first = finding((report.findings ?? [])[0]);
  const level = errors ? 'error' : warnings ? 'warning' : 'success';
  const text = errors || warnings ? `${report.name ?? r.name}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}${first ? `. ${first}` : ''}` : `${report.name ?? r.name} follows the skill format`;
  await formext.notify(text, level);
  return { errors, warnings };
});

await formext.hello();
