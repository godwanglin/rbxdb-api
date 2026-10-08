import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { ApiError } from './api-error';
import { guardAuthenticated } from './rate-limit';

export async function verifyHmac(req: Request, rawBody: string, pathname: string) {
  const secret = process.env.RBX_API_SECRET;
  const key = process.env.RBX_API_KEY_ID ?? 'roblox';
  const max = Number(process.env.RBX_HMAC_MAX_SKEW_SECONDS ?? 300);
  if (!secret || secret.length < 32 || !Number.isInteger(max) || max < 1 || max > 300) {
    return { ok: false, code: 'SERVER_MISCONFIGURED' } as const;
  }
  if (req.headers.get('x-rbx-key-id') !== key) return { ok: false, code: 'UNAUTHORIZED' } as const;
  const ts = req.headers.get('x-rbx-timestamp') ?? '';
  const nonce = req.headers.get('x-rbx-nonce') ?? '';
  const signature = req.headers.get('x-rbx-signature') ?? '';
  const timestamp = Number(ts);
  if (!/^\d{1,12}$/.test(ts) || !Number.isSafeInteger(timestamp)
    || Math.abs(Date.now() / 1000 - timestamp) > max
    || !/^[a-zA-Z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) {
    return { ok: false, code: 'INVALID_SIGNATURE' } as const;
  }
  const digest = crypto.createHash('sha256').update(rawBody).digest('hex');
  const canonical = ['v1', req.method, pathname, ts, nonce, digest].join('\n');
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest();
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expected)) {
    return { ok: false, code: 'INVALID_SIGNATURE' } as const;
  }
  try {
    await guardAuthenticated(key);
    await prisma.purchaseNonce.create({ data: { nonce, expiresAt: new Date((timestamp + max + 1) * 1000) } });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, code: 'REPLAYED_NONCE' } as const;
    }
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database sementara tidak tersedia');
  }
  return { ok: true } as const;
}

export async function requireHmac(request: Request, rawBody: string) {
  const url = new URL(request.url);
  const result = await verifyHmac(request, rawBody, url.pathname + url.search);
  if (!result.ok) throw new ApiError(result.code === 'SERVER_MISCONFIGURED' ? 503 : 401, result.code, 'Autentikasi gagal');
}
