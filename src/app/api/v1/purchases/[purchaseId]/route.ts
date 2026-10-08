import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requestId } from '@/src/lib/request-id';
import { fail, ok } from '@/src/lib/response';
import { requireHmac } from '@/src/lib/hmac';
import { guardRequest } from '@/src/lib/rate-limit';
import { handleError } from '@/src/lib/http';
import { findPurchase } from '@/src/server/purchases/purchase.service';
import { serialize } from '@/src/server/purchases/purchase.mapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const rid = requestId();
  try {
    guardRequest();
    await requireHmac(req, '');
    const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).parse((await params).purchaseId);
    const row = await findPurchase(id);
    if (!row) return fail(404, 'NOT_FOUND', 'Pembelian tidak ditemukan', rid);
    return ok(serialize(row), rid);
  } catch (error) { return handleError(error, rid); }
}

function unsupported() { return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung', requestId()); }
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
