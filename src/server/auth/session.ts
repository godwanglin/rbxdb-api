import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '@/src/lib/api-error';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'rbxdb_admin';
export const SESSION_SECONDS = 8 * 60 * 60;
type Session = { username: string; issuedAt: number; expiresAt: number; nonce: string };

function config() {
  const username = process.env.WEB_ADMIN_USERNAME;
  const passwordHash = process.env.WEB_ADMIN_PASSWORD_HASH;
  const secret = process.env.WEB_SESSION_SECRET;
  if (!username || !passwordHash || !secret || secret.length < 32 || secret.includes('replace-with')
    || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) {
    throw new ApiError(503, 'WEB_AUTH_UNAVAILABLE', 'Login admin belum dikonfigurasi');
  }
  return { username, passwordHash, secret };
}

export async function verifyCredentials(username: string, password: string) {
  const settings = config();
  const [, salt, expected] = settings.passwordHash.split(':');
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && username === settings.username;
}

export function createSession(now = Date.now()) {
  const settings = config();
  const session: Session = {
    username: settings.username,
    issuedAt: Math.floor(now / 1000), expiresAt: Math.floor(now / 1000) + SESSION_SECONDS,
    nonce: randomBytes(16).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = createHmac('sha256', settings.secret).update(`${body}:${settings.passwordHash}`).digest('base64url');
  return `${body}.${signature}`;
}

export function getSession(token: string | null | undefined, now = Date.now()): Session | null {
  if (!token || token.length > 1024) return null;
  const settings = config();
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const expected = createHmac('sha256', settings.secret).update(`${body}:${settings.passwordHash}`).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
    const time = Math.floor(now / 1000);
    if (session.username !== settings.username || !Number.isInteger(session.issuedAt) || !Number.isInteger(session.expiresAt)
      || session.issuedAt > time + 30 || session.expiresAt <= time || session.expiresAt - session.issuedAt !== SESSION_SECONDS
      || typeof session.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(session.nonce)) return null;
    return session;
  } catch { return null; }
}

export function requireSession(request: Request) {
  const cookies = request.headers.get('cookie')?.split(';').map(v => v.trim()).filter(v => v.startsWith(`${SESSION_COOKIE}=`)) ?? [];
  const session = cookies.length === 1 ? getSession(cookies[0].slice(SESSION_COOKIE.length + 1)) : null;
  if (!session) throw new ApiError(401, 'UNAUTHORIZED', 'Sesi berakhir. Silakan masuk kembali.');
  return session;
}

export function requireOrigin(request: Request) {
  const configured = process.env.WEB_ORIGIN;
  if (!configured) throw new ApiError(503, 'WEB_AUTH_UNAVAILABLE', 'Login admin belum dikonfigurasi');
  let origin: URL;
  try { origin = new URL(configured); } catch { throw new ApiError(503, 'WEB_AUTH_UNAVAILABLE', 'Login admin belum dikonfigurasi'); }
  if (origin.origin !== configured || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) {
    throw new ApiError(503, 'WEB_AUTH_UNAVAILABLE', 'Origin admin tidak valid');
  }
  if (request.headers.get('origin') !== configured || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'INVALID_ORIGIN', 'Origin request tidak diizinkan');
  }
}
