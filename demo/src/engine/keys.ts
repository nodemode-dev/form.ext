import { emit } from '../../../frontend/src/shell/events';
import { arrayBuffer, fromB64, hex, isB64, now, sha256, toB64, utf8 } from './bytes';
import { bad, conflict, HttpError, locked, notFound, refused } from './errors';
import type { Json } from './kit';
import * as fs from './vfs';
import { dataDir, readJson, writeJson } from './workspace';

const PUBLISHER_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;
const FORMAT = 'formext-publisher-key';
const ALGORITHM = 'ed25519';
const MIN_PASSPHRASE = 8;
const ED = { name: 'Ed25519' } as const;

export async function fingerprint(publicKey: string): Promise<string> {
  const raw = isB64(publicKey) ? fromB64(publicKey) : new Uint8Array();
  const d = hex(await sha256(raw)).slice(0, 20);
  return [0, 4, 8, 12, 16].map((i) => d.slice(i, i + 4)).join(' ');
}

export async function verify(body: Uint8Array, signature: string, keys: string[]): Promise<void> {
  if (!keys.length) throw refused('this build trusts no catalogue key yet');
  if (!isB64(signature.trim())) throw refused('its signature is not valid base64');
  const raw = fromB64(signature.trim());
  if (raw.length !== 64) throw refused('its signature is not 64 bytes');
  for (const key of keys) {
    if (!isB64(key)) continue;
    const data = fromB64(key);
    if (data.length !== 32) continue;
    try {
      const k = await crypto.subtle.importKey('raw', arrayBuffer(data), ED, false, ['verify']);
      if (await crypto.subtle.verify(ED, k, arrayBuffer(raw), arrayBuffer(body))) return;
    } catch {
      continue;
    }
  }
  throw refused('its signature does not match a key this build trusts');
}

export async function checkSignature(body: Uint8Array, sig: Json, publishers: Json[]): Promise<string> {
  const pub = publishers.find((p) => p.id === sig.publisher);
  if (!pub) throw refused(`the package names a publisher, ${JSON.stringify(sig.publisher ?? null)}, that the index does not list`);
  if (sig.algorithm !== ALGORITHM) throw refused(`the package's signature uses ${JSON.stringify(sig.algorithm ?? null)}, not ed25519`);
  try {
    await verify(body, String(sig.value ?? ''), [String(pub.public_key ?? '')]);
  } catch {
    throw refused(`the package's signature does not match ${pub.name}'s key`);
  }
  return String(pub.id);
}

async function wrapKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', arrayBuffer(utf8(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: arrayBuffer(salt), iterations: 210000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

class Keys {
  private dir(): string {
    return dataDir('keys');
  }

  private file(kid: string): string {
    if (typeof kid !== 'string' || !PUBLISHER_RE.test(kid)) throw notFound('no such publisher key');
    return `${this.dir()}/${kid}.json`;
  }

  private load(kid: string): Json {
    const path = this.file(kid);
    if (!fs.isFile(path)) throw notFound(`no publisher key ${kid}`);
    const data = readJson(path);
    if (!data || data.format !== FORMAT) throw bad(`the key file of ${kid} is not a form.ext publisher key`);
    return data;
  }

  async public(d: Json): Promise<Json> {
    return { id: d.id, name: d.name, url: d.url || '', algorithm: ALGORITHM, public_key: d.public_key, fingerprint: await fingerprint(d.public_key), encrypted: Boolean(d.encrypted), created: d.created ?? 0 };
  }

  publisher(d: Json): Json {
    const out: Json = { id: d.id, name: d.name, public_key: d.public_key };
    if (d.url) out.url = d.url;
    return out;
  }

  async list(): Promise<Json[]> {
    const out: Json[] = [];
    for (const name of fs.children(this.dir()).sort()) {
      if (name.startsWith('.') || !name.endsWith('.json')) continue;
      try {
        out.push(await this.public(this.load(name.slice(0, -5))));
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => a.created - b.created);
  }

  async get(kid: string): Promise<Json> {
    return this.public(this.load(kid));
  }

  async export(kid: string): Promise<Json> {
    const d = this.load(kid);
    return { publisher: this.publisher(d), fingerprint: await fingerprint(d.public_key), algorithm: ALGORITHM };
  }

  async create(kid: string, name: string, url = '', passphrase = ''): Promise<Json> {
    kid = (kid || '').trim();
    name = (name || '').trim();
    url = (url || '').trim();
    if (!PUBLISHER_RE.test(kid)) throw bad('A publisher id is 2 to 39 lower-case letters, digits and hyphens, starting with a letter or digit.');
    if (!name) throw bad('Give the publisher a name; FormPortal shows it beside the package.');
    if (url && !url.startsWith('https://')) throw bad('The publisher address must start with https://.');
    if (passphrase && passphrase.length < MIN_PASSPHRASE) throw bad(`A passphrase needs at least ${MIN_PASSPHRASE} characters, or leave it empty.`);
    if (fs.isFile(this.file(kid))) throw conflict(`a publisher key ${kid} already exists`);
    const pair = (await crypto.subtle.generateKey(ED, true, ['sign', 'verify'])) as CryptoKeyPair;
    const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    let privateKey: Json;
    if (passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrapKey(passphrase, salt), arrayBuffer(pkcs8)));
      privateKey = { scheme: 'pbkdf2-sha256-210000+aes-256-gcm', salt: toB64(salt), iv: toB64(iv), data: toB64(sealed) };
    } else privateKey = { scheme: 'pkcs8', data: toB64(pkcs8) };
    const data = { format: FORMAT, format_version: 1, id: kid, name, url, algorithm: ALGORITHM, public_key: toB64(rawPublic), private_key: privateKey, encrypted: Boolean(passphrase), created: now() };
    writeJson(this.file(kid), data);
    emit('keys.changed', { id: kid, kind: 'created' });
    return this.public(data);
  }

  remove(kid: string): Json {
    const path = this.file(kid);
    if (!fs.isFile(path)) throw notFound(`no publisher key ${kid}`);
    const kept = `${dataDir('trash')}/key-${kid}-${Math.floor(now())}.json`;
    fs.move(path, kept);
    emit('keys.changed', { id: kid, kind: 'removed' });
    return { id: kid, removed: true, kept };
  }

  private async privateKey(d: Json, passphrase: string): Promise<CryptoKey> {
    const pk = d.private_key;
    let pkcs8: Uint8Array;
    if (d.encrypted) {
      if (!passphrase) throw locked(`the key ${d.id} is protected: give its passphrase`);
      try {
        pkcs8 = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: arrayBuffer(fromB64(pk.iv)) }, await wrapKey(passphrase, fromB64(pk.salt)), arrayBuffer(fromB64(pk.data))));
      } catch {
        throw locked(`the passphrase does not open the key ${d.id}`);
      }
    } else pkcs8 = fromB64(pk.data);
    try {
      return await crypto.subtle.importKey('pkcs8', arrayBuffer(pkcs8), ED, false, ['sign']);
    } catch {
      throw new HttpError(400, `the key ${d.id} is not an Ed25519 key`);
    }
  }

  async sign(kid: string, body: Uint8Array, passphrase = ''): Promise<Json> {
    const d = this.load(kid);
    const key = await this.privateKey(d, passphrase || '');
    const value = toB64(new Uint8Array(await crypto.subtle.sign(ED, key, arrayBuffer(body))));
    await verify(body, value, [d.public_key]);
    return { publisher: d.id, algorithm: ALGORITHM, value };
  }
}

export const keys = new Keys();
