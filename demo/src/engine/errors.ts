export class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
  body(): Record<string, unknown> {
    return { detail: this.message, ...this.extra };
  }
}

export const bad = (m: string) => new HttpError(400, m);
export const notFound = (m: string) => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);
export const refused = (m: string, extra: Record<string, unknown> = {}) => new HttpError(422, m, extra);
export const locked = (m: string) => new HttpError(401, m);
