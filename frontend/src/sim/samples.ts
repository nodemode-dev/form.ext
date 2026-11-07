import { textToB64, bytesToB64, buildWav, buildPdf, canvasPng } from './util';

export interface SimFile {
  name: string;
  type: string;
  size: number;
  data: string;
}

const TEXT: Record<string, [string, string]> = {
  'members.csv': ['text/csv', 'full_name,email,membership,start_date\nAda Lovelace,ada@example.org,Adult,2027-01-01\nGrace Hopper,grace@example.org,Senior,2027-01-15\nKatherine Johnson,katherine@example.org,Adult,2027-02-01\nAlan Turing,alan@example.org,Student,2027-02-14\n'],
  'shots.csv': ['text/csv', 'shot,start,end,note\n1,0,8,Wide pier, slow push in\n2,8,14,Boats close, handheld\n3,14,24,Lighthouse hold\n'],
  'figures.csv': ['text/csv', 'quarter,revenue,members\nQ1,41200,212\nQ2,45800,231\nQ3,48600,254\n'],
  'places.csv': ['text/csv', 'name,lat,lon\nHarbourside,51.4483,-2.5979\nClifton Suspension Bridge,51.4545,-2.6295\n'],
  'chapters.json': ['application/json', JSON.stringify({ version: '1.2.0', chapters: [{ startTime: 0, title: 'Intro' }, { startTime: 95, title: 'Guest joins' }, { startTime: 600, title: 'Ad break' }] }, null, 2)],
  'library.bib': ['text/x-bibtex', '@book{pugh2004,\n  author = {Pugh, David},\n  title = {Changing Sea Levels: Effects of Tides, Weather and Climate},\n  publisher = {Cambridge University Press},\n  year = {2004}\n}\n\n@techreport{ukho2025,\n  author = {{UK Hydrographic Office}},\n  title = {Admiralty Tide Tables 2025},\n  institution = {UKHO},\n  year = {2025}\n}\n\n@article{smith2020,\n  author = {Smith, Jane and Ortiz, Luis},\n  title = {Rowing on tidal rivers},\n  journal = {Journal of Coastal Recreation},\n  volume = {12},\n  pages = {33--51},\n  year = {2020},\n  doi = {10.1000/jcr.2020.33}\n}\n'],
  'library.json': ['application/json', JSON.stringify([{ id: 'pugh2004', type: 'book', title: 'Changing Sea Levels', author: [{ family: 'Pugh', given: 'David' }], issued: { 'date-parts': [[2004]] }, publisher: 'Cambridge University Press' }], null, 2)],
  'tracking.json': ['application/json', JSON.stringify({ fps: 30, points: [[0, 960, 540], [1, 972, 538], [2, 985, 536]] })],
  'profile.json': ['application/json', JSON.stringify({ name: 'focus', apps_off: ['formlit'], tools_off: [] }, null, 2)],
  'notes.txt': ['text/plain', 'Harbour shoot notes\n- golden hour at 07:10\n- tide high at 08:42\n'],
  'SKILL.md': ['text/markdown', '---\nname: my-skill\ndescription: An example skill picked in the preview.\nlicense: Apache-2.0\n---\n\n# my-skill\n'],
  'logo.svg': ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="48" fill="#4f6bff"/><circle cx="128" cy="128" r="64" fill="#fff"/></svg>'],
};

export const SAMPLE_TYPES: Record<string, string> = { 'photo.png': 'image/png', 'song.wav': 'audio/wav', 'episode.wav': 'audio/wav', 'membership-form.pdf': 'application/pdf', ...Object.fromEntries(Object.entries(TEXT).map(([k, v]) => [k, v[0]])) };

function photo(): string {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 533;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const sky = g.createLinearGradient(0, 0, 0, 533);
  sky.addColorStop(0, '#2b4c7e');
  sky.addColorStop(0.6, '#f0a35e');
  sky.addColorStop(1, '#2a1d14');
  g.fillStyle = sky;
  g.fillRect(0, 0, 800, 533);
  g.fillStyle = '#ffe2a8';
  g.beginPath();
  g.arc(560, 300, 60, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b130d';
  g.fillRect(0, 400, 800, 133);
  for (let i = 0; i < 9; i++) g.fillRect(60 + i * 80, 330 - (i % 3) * 20, 8, 80 + (i % 3) * 20);
  return canvasPng(c);
}

export function sampleFile(name: string): SimFile | null {
  let data = '';
  if (name in TEXT) data = textToB64(TEXT[name][1]);
  else if (name === 'photo.png') data = photo();
  else if (name.endsWith('.wav')) data = bytesToB64(buildWav(name === 'episode.wav' ? 8 : 4));
  else if (name === 'membership-form.pdf') data = bytesToB64(buildPdf([{ w: 595.276, h: 841.89, text: ['Harbour Rowing Club', 'Membership form 2027', 'Full name', 'Email'] }], [{ name: 'full_name', page: 1, x: 200, y: 130, w: 300, h: 22, value: '' }, { name: 'email', page: 1, x: 200, y: 152, w: 300, h: 22, value: '' }], 'Membership form'));
  else return null;
  return { name, type: SAMPLE_TYPES[name] ?? 'application/octet-stream', size: Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0), data };
}

export function accepts(name: string, type: string, accept: string[]): boolean {
  if (!accept.length) return true;
  const lower = name.toLowerCase();
  return accept.some((a) => {
    const x = a.trim().toLowerCase();
    if (x.startsWith('.')) return lower.endsWith(x);
    if (x.endsWith('/*')) return type.startsWith(x.slice(0, -1));
    return type === x;
  });
}
