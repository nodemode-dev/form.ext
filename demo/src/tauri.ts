export function invoke(): Promise<never> {
  return Promise.reject(new Error('the browser demo has no desktop shell'));
}
