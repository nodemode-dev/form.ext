import { arrayBuffer, concat, utf8 } from './bytes';

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([arrayBuffer(data)]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export const deflate = (data: Uint8Array) => pipe(data, new CompressionStream('deflate-raw'));
export const inflate = (data: Uint8Array) => pipe(data, new DecompressionStream('deflate-raw'));

const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export interface ZipInput {
  path: string;
  data: Uint8Array;
}

export async function writeZip(entries: ZipInput[]): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = utf8(e.path);
    const packed = await deflate(e.data);
    const crc = crc32(e.data);
    const flags = /[^\x00-\x7f]/.test(e.path) ? 0x800 : 0;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, flags, true);
    lh.setUint16(8, 8, true);
    lh.setUint16(10, 0, true);
    lh.setUint16(12, DOS_DATE, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, packed.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    const local = concat([new Uint8Array(lh.buffer), name, packed]);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, (3 << 8) | 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, flags, true);
    ch.setUint16(10, 8, true);
    ch.setUint16(12, 0, true);
    ch.setUint16(14, DOS_DATE, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, packed.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, (0o100644 << 16) >>> 0, true);
    ch.setUint32(42, offset, true);
    central.push(concat([new Uint8Array(ch.buffer), name]));
    locals.push(local);
    offset += local.length;
  }
  const dir = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dir.length, true);
  end.setUint32(16, offset, true);
  return concat([...locals, dir, new Uint8Array(end.buffer)]);
}

export interface ZipInfo {
  filename: string;
  file_size: number;
  compress_size: number;
  compress_type: number;
  date_time: number[];
  external_attr: number;
  create_system: number;
  flag_bits: number;
  crc: number;
  offset: number;
  is_dir: boolean;
}

export class ZipError extends Error {}

export function readInfos(data: Uint8Array): ZipInfo[] {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('File is not a zip file');
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: ZipInfo[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (at + 46 > data.length || v.getUint32(at, true) !== 0x02014b50) throw new ZipError('Bad magic number for central directory');
    const made = v.getUint16(at + 4, true);
    const flags = v.getUint16(at + 8, true);
    const method = v.getUint16(at + 10, true);
    const time = v.getUint16(at + 12, true);
    const date = v.getUint16(at + 14, true);
    const nameLen = v.getUint16(at + 28, true);
    const extraLen = v.getUint16(at + 30, true);
    const commentLen = v.getUint16(at + 32, true);
    const filename = dec.decode(data.subarray(at + 46, at + 46 + nameLen));
    out.push({
      filename,
      crc: v.getUint32(at + 16, true),
      compress_size: v.getUint32(at + 20, true),
      file_size: v.getUint32(at + 24, true),
      compress_type: method,
      date_time: [((date >> 9) & 0x7f) + 1980, (date >> 5) & 0xf, date & 0x1f, (time >> 11) & 0x1f, (time >> 5) & 0x3f, (time & 0x1f) * 2],
      external_attr: v.getUint32(at + 38, true),
      create_system: made >> 8,
      flag_bits: flags,
      offset: v.getUint32(at + 42, true),
      is_dir: filename.endsWith('/'),
    });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export async function readEntry(data: Uint8Array, info: ZipInfo): Promise<Uint8Array> {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const at = info.offset;
  if (at + 30 > data.length || v.getUint32(at, true) !== 0x04034b50) throw new ZipError('Bad magic number for file header');
  const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true);
  const raw = data.subarray(start, start + info.compress_size);
  if (info.flag_bits & 1) throw new ZipError('the entry is encrypted');
  let body: Uint8Array;
  if (info.compress_type === 0) body = raw;
  else if (info.compress_type === 8) body = await inflate(raw);
  else throw new ZipError(`compression method ${info.compress_type} is not supported`);
  if (crc32(body) !== info.crc) throw new ZipError(`Bad CRC-32 for file '${info.filename}'`);
  return body;
}

export async function unzip(data: Uint8Array): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const info of readInfos(data)) if (!info.is_dir) out.set(info.filename, await readEntry(data, info));
  return out;
}
