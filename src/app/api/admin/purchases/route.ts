import { NextRequest } from 'next/server';
import { requireSession } from '@/src/server/auth/session';
import { guardRequest } from '@/src/lib/rate-limit';
import { handleError } from '@/src/lib/http';
import { requestId } from '@/src/lib/request-id';
import { ok } from '@/src/lib/response';
import { parsePurchaseQuery } from '@/src/server/purchases/purchase.query';
import { dashboardPurchases } from '@/src/server/purchases/purchase.repository';
import { serialize } from '@/src/server/purchases/purchase.mapper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const rid = requestId();
  try {
    guardRequest(); requireSession(request);
    const query = parsePurchaseQuery(request.nextUrl.searchParams);
    return ok(serialize(await dashboardPurchases(query)), rid);
  } catch (error) { return handleError(error, rid); }
}
