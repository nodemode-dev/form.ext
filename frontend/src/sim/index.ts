import type { AppSim } from './types';
import formvis from './apps/formvis';
import formcut from './apps/formcut';
import formwav from './apps/formwav';
import formpdf from './apps/formpdf';
import formdeck from './apps/formdeck';
import formlit from './apps/formlit';
import formmd from './apps/formmd';
import formencoder from './apps/formencoder';
import formvfx from './apps/formvfx';
import formmcp from './apps/formmcp';
import formtray from './apps/formtray';
import formskills from './apps/formskills';

export type { AppSim } from './types';
export { SimHost } from './host';
export type { LogEntry, SimUI } from './host';
export { sampleFile, accepts } from './samples';
export type { SimFile } from './samples';

export const SIMS: Record<string, AppSim> = { formvis, formcut, formwav, formpdf, formdeck, formlit, formmd, formencoder, formvfx, formmcp, formtray, formskills };

export function simFor(product: string): AppSim | null {
  return SIMS[product] ?? null;
}

export { tokensFor } from './tokens';
