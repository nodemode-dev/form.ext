let open: () => void = () => undefined;

export const ready = new Promise<void>((resolve) => {
  open = resolve;
});

export function start(work: () => Promise<void>): void {
  work().then(open, (err) => {
    console.warn('form.ext demo: the sample workspace could not be prepared', err);
    open();
  });
}
