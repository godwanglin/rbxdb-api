import { NextRequest } from 'next/server';
import { requestId } from '@/src/lib/request-id';
import { fail, ok } from '@/src/lib/response';
import { requireHmac } from '@/src/lib/hmac';
import { guardRequest } from '@/src/lib/rate-limit';
import { readBody, handleError } from '@/src/lib/http';
import { ApiError } from '@/src/lib/api-error';
import { ingest, listPurchases } from '@/src/server/purchases/purchase.service';
import { parsePurchaseQuery } from '@/src/server/purchases/purchase.query';
import { serialize } from '@/src/server/purchases/purchase.mapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rid = requestId();
  try {
    guardRequest();
    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Gunakan application/json');
    }
    const body = await readBody(req);
    await requireHmac(req, body);
    return ok(serialize(await ingest(JSON.parse(body))), rid);
  } catch (error) { return handleError(error, rid); }
}

export async function GET(req: NextRequest) {
  const rid = requestId();
  try {
    guardRequest();
    await requireHmac(req, '');
    const query = parsePurchaseQuery(req.nextUrl.searchParams);
    const result = await listPurchases(query);
    return ok(serialize({ items: result.data, total: result.total, page: query.page, pageSize: query.pageSize }), rid);
  } catch (error) { return handleError(error, rid); }
}

function unsupported() { return fail(405, 'METHOD_NOT_ALLOWED', 'Metode tidak didukung', requestId()); }
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const OPTIONS = unsupported;
