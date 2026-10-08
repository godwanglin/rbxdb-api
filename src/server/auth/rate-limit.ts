import { ApiError } from '@/src/lib/api-error';

type Bucket = { count: number; expires: number };
const buckets = new Map<string, Bucket>();
let global: Bucket = { count: 0, expires: 0 };
let concurrent = 0;

export function guardLogin(request: Request, now = Date.now()) {
  if (now >= global.expires) global = { count: 0, expires: now + 60_000 };
  if (++global.count > 30 || concurrent >= 2) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
  // X-Real-IP must be overwritten by the trusted local reverse proxy.
  const address = process.env.WEB_TRUST_PROXY === '1' ? request.headers.get('x-real-ip') : null;
  const key = address && /^[a-fA-F0-9:.]{3,45}$/.test(address) ? address : 'direct';
  for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id);
  const bucket = buckets.get(key) ?? { count: 0, expires: now + 300_000 };
  if (buckets.size >= 5000 && !buckets.has(key)) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
  buckets.set(key, bucket);
  if (++bucket.count > 6) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
}

export async function boundedVerification<T>(verify: () => Promise<T>): Promise<T> {
  if (concurrent >= 2) throw new ApiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
  concurrent++;
  try { return await verify(); } finally { concurrent--; }
}
