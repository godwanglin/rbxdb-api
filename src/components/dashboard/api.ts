import type { Envelope } from './types';

export class WebApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function webRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
  let body: Envelope<T>;
  try { body = await response.json(); }
  catch { throw new WebApiError('Server tidak merespons. Coba lagi.', response.status); }
  if (!response.ok || body.status === 'error' || body.data === null) {
    throw new WebApiError(body.error?.message || 'Permintaan tidak dapat diproses.', response.status);
  }
  return body.data;
}
