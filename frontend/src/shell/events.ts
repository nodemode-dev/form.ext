type Listener = (data: any) => void;

const listeners = new Map<string, Set<Listener>>();
let socket: WebSocket | null = null;
let connected = false;
let retry = 0;
let timer = 0;

export function on(name: string, cb: Listener): () => void {
  let set = listeners.get(name);
  if (!set) listeners.set(name, (set = new Set()));
  set.add(cb);
  return () => {
    set!.delete(cb);
  };
}

export function emit(name: string, data?: unknown): void {
  for (const key of [name, '*']) {
    const set = listeners.get(key);
    if (!set) continue;
    for (const cb of [...set]) {
      try {
        cb(key === '*' ? { name, data } : data);
      } catch (err) {
        console.error(err);
      }
    }
  }
}

export function isLive(): boolean {
  return connected;
}

function liveUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/live`;
}

function setConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  emit('live.status', { connected: value });
}

export function connect(): void {
  if (location.protocol === 'file:' || socket || document.documentElement.dataset.demo === 'studio') return;
  clearTimeout(timer);
  let ws: WebSocket;
  try {
    ws = new WebSocket(liveUrl());
  } catch {
    schedule();
    return;
  }
  socket = ws;
  ws.onopen = () => {
    retry = 0;
    setConnected(true);
  };
  ws.onmessage = (ev) => {
    let msg: { name?: string; data?: unknown };
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
    } catch {
      return;
    }
    if (msg && typeof msg.name === 'string') emit(msg.name, msg.data);
  };
  ws.onclose = () => {
    socket = null;
    setConnected(false);
    schedule();
  };
  ws.onerror = () => {
    ws.close();
  };
}

function schedule(): void {
  clearTimeout(timer);
  const delay = Math.min(10000, 500 * 2 ** retry++);
  timer = window.setTimeout(connect, delay);
}

export function reconnect(): void {
  retry = 0;
  if (socket) socket.close();
  else connect();
}

export const events = { on };
