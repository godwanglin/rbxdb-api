import { prisma } from './prisma';
import { ApiError } from './api-error';

let localWindow = 0;
let localRequests = 0;
let lastCleanup = 0;

// Bound unauthenticated work without trusting spoofable forwarded IP headers.
export function guardRequest(now = Date.now()) {
  const window = Math.floor(now / 60_000);
  if (window !== localWindow) { localWindow = window; localRequests = 0; }
  if (++localRequests > 1200) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan');
}

export async function guardAuthenticated(keyId: string, now = Date.now()) {
  const window = Math.floor(now / 60_000);
  const bucket = await prisma.apiRateBucket.upsert({
    where: { key: `${keyId}:${window}` },
    create: { key: `${keyId}:${window}`, count: 1, expiresAt: new Date(now + 600_000) },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > 600) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak permintaan');
  if (now - lastCleanup >= 60_000) {
    lastCleanup = now;
    // These are technical guards, not purchase history or a timeline.
    await prisma.$transaction([
      prisma.purchaseNonce.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      prisma.apiRateBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    ]);
  }
}
