import { NextRequest } from 'next/server';
import { requireSession } from '@/src/server/auth/session';
import { guardRequest } from '@/src/lib/rate-limit';
import { handleError } from '@/src/lib/http';
import { requestId } from '@/src/lib/request-id';
import { ok } from '@/src/lib/response';
import { ApiError } from '@/src/lib/api-error';
import { findPurchase } from '@/src/server/purchases/purchase.repository';
import { serialize } from '@/src/server/purchases/purchase.mapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ purchaseId: string }> }) {
  const rid = requestId();
  try {
    guardRequest(); requireSession(request);
    const { purchaseId } = await context.params;
    if (!/^[\w-]{1,128}$/.test(purchaseId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Purchase ID tidak valid');
    const result = await findPurchase(purchaseId);
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Transaksi tidak ditemukan');
    return ok(serialize(result), rid);
  } catch (error) { return handleError(error, rid); }
}
