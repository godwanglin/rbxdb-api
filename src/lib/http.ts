import { ZodError } from 'zod';
import { ApiError } from './api-error';
import { fail } from './response';

export const MAX_BODY_BYTES = 128 * 1024;

export async function readBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new ApiError(413, 'BODY_TOO_LARGE', 'Payload terlalu besar');
  }
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  let expired = false;
  const timeout = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 10_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'BODY_TOO_LARGE', 'Payload terlalu besar');
      }
      chunks.push(value);
    }
    if (expired) throw new ApiError(408, 'REQUEST_TIMEOUT', 'Pembacaan request melewati batas waktu');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new ApiError(400, 'VALIDATION_ERROR', 'Payload harus UTF-8'); }
  } finally { clearTimeout(timeout); reader.releaseLock(); }
}

export function handleError(error: unknown, requestId: string) {
  if (error instanceof ApiError) return fail(error.statusCode, error.code, error.message, requestId);
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return fail(400, 'VALIDATION_ERROR', 'Data pembelian atau filter tidak valid', requestId);
  }
  if (error instanceof Error && error.message === 'RECEIPT_IDENTITY_CONFLICT') {
    return fail(409, 'RECEIPT_IDENTITY_CONFLICT', 'Identitas receipt tidak boleh diubah', requestId);
  }
  // Never expose SQL, credential, stack trace, or untrusted exception text.
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && /^P\d{4}$/.test(code)) {
    return fail(503, 'DATABASE_UNAVAILABLE', 'Database sementara tidak tersedia', requestId);
  }
  return fail(500, 'INTERNAL_ERROR', 'Permintaan tidak dapat diproses', requestId);
}
