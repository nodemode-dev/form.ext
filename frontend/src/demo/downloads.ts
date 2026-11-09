import { dispatch } from './engine/router';

function save(name: string, data: ArrayBuffer, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function catchDownloads(): void {
  document.addEventListener(
    'click',
    (ev) => {
      const a = (ev.target as HTMLElement | null)?.closest?.('a[href^="/api/"]');
      if (!a) return;
      ev.preventDefault();
      const href = a.getAttribute('href')!;
      const url = new URL(href, 'http://engine.invalid');
      void dispatch({ method: 'GET', path: url.pathname, query: url.searchParams, body: undefined }).then((res) => {
        const body = res.body as { __raw?: Uint8Array; __name?: string } | null;
        if (res.status === 200 && body?.__raw) save(a.getAttribute('download') || body.__name || 'download.formpkg', body.__raw.slice().buffer as ArrayBuffer, 'application/zip');
      });
    },
    true,
  );
}
