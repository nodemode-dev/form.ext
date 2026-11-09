import { request } from '../../frontend/src/demo/transport';

export { ApiError, readBody, errorMessage } from '../../frontend/src/shell/api';
export { apiUrl, request, pending, whenIdle } from '../../frontend/src/demo/transport';

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
};
