import { prisma } from '@/src/lib/prisma';
import { requestId } from '@/src/lib/request-id';
import { guardRequest } from '@/src/lib/rate-limit';
import { ApiError } from '@/src/lib/api-error';
import { fail, ok } from '@/src/lib/response';
import { handleError } from '@/src/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let lastSuccess = 0;

export async function GET() {
  const rid = requestId();
  try {
    guardRequest();
    if (Date.now() - lastSuccess > 5000) { await prisma.$queryRaw`SELECT 1`; lastSuccess = Date.now(); }
    return ok({ service: 'APIRbxDB', database: 'ok' }, rid);
  } catch (error) {
    if (error instanceof ApiError) return handleError(error, rid);
    return fail(503, 'DATABASE_UNAVAILABLE', 'Database sementara tidak tersedia', rid);
  }
}
