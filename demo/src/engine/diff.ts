export type Op = ['equal' | 'replace' | 'delete' | 'insert', number, number, number, number];

function script(a: string[], b: string[]): ('=' | '-' | '+')[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) x++, y++;
      v[off + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  trace.push(v.slice());
  const out: ('=' | '-' | '+')[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 2; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1]) ? k + 1 : k - 1;
    const px = d === 0 ? 0 : vv[off + prevK];
    const py = px - prevK;
    while (x > px && y > py && x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
      out.push('=');
      x--, y--;
    }
    if (d === 0) break;
    if (x === px) out.push('+'), y--;
    else out.push('-'), x--;
  }
  while (x > 0 && y > 0) out.push('='), x--, y--;
  return out.reverse();
}

export function opcodes(a: string[], b: string[]): Op[] {
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  const steps = script(a, b);
  let k = 0;
  while (k < steps.length) {
    if (steps[k] === '=') {
      const i0 = i;
      const j0 = j;
      while (k < steps.length && steps[k] === '=') i++, j++, k++;
      ops.push(['equal', i0, i, j0, j]);
      continue;
    }
    const i0 = i;
    const j0 = j;
    while (k < steps.length && steps[k] !== '=') {
      if (steps[k] === '-') i++;
      else j++;
      k++;
    }
    ops.push([i > i0 && j > j0 ? 'replace' : i > i0 ? 'delete' : 'insert', i0, i, j0, j]);
  }
  return ops;
}

export function grouped(a: string[], b: string[], n = 3): Op[][] {
  let codes = opcodes(a, b);
  if (!codes.length) codes = [['equal', 0, 1, 0, 1]];
  if (codes[0][0] === 'equal') {
    const [t, i1, i2, j1, j2] = codes[0];
    codes[0] = [t, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2];
  }
  if (codes[codes.length - 1][0] === 'equal') {
    const [t, i1, i2, j1, j2] = codes[codes.length - 1];
    codes[codes.length - 1] = [t, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)];
  }
  const out: Op[][] = [];
  let group: Op[] = [];
  for (const code of codes) {
    let [t, i1, i2, j1, j2] = code;
    if (t === 'equal' && i2 - i1 > n + n) {
      group.push([t, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
      out.push(group);
      group = [];
      [i1, j1] = [Math.max(i1, i2 - n), Math.max(j1, j2 - n)];
    }
    group.push([t, i1, i2, j1, j2]);
  }
  if (group.length && !(group.length === 1 && group[0][0] === 'equal')) out.push(group);
  return out;
}

export function lineCounts(a: string[], b: string[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const [t, i1, i2, j1, j2] of opcodes(a, b)) {
    if (t === 'equal') continue;
    removed += i2 - i1;
    added += j2 - j1;
  }
  return { added, removed };
}

export function splitLines(t: string): string[] {
  const out = t.split(/\r\n|\r|\n/);
  if (out.length && out[out.length - 1] === '') out.pop();
  return out;
}
