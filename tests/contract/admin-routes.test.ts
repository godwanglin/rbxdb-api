import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scryptSync } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as list } from '../../src/app/api/admin/purchases/route';
import { GET as detail } from '../../src/app/api/admin/purchases/[purchaseId]/route';
import { POST, GET, DELETE } from '../../src/app/api/admin/session/route';

beforeEach(() => {
  const salt = 'f'.repeat(32);
  vi.stubEnv('WEB_ADMIN_USERNAME', 'admin');
  vi.stubEnv('WEB_ADMIN_PASSWORD_HASH', `scrypt:${salt}:${scryptSync('password-test', salt, 64).toString('hex')}`);
  vi.stubEnv('WEB_SESSION_SECRET', 'd'.repeat(64));
  vi.stubEnv('WEB_ORIGIN', 'https://example.com');
});
afterEach(() => vi.unstubAllEnvs());
it('protects purchase list and detail without database access', async () => {
  expect((await list(new NextRequest('https://example.com/api/admin/purchases'))).status).toBe(401);
  expect((await detail(new NextRequest('https://example.com'), { params: Promise.resolve({ purchaseId: 'test' }) })).status).toBe(401);
});
it('logs in, reads session, and clears session cookie', async () => {
  const response = await POST(new NextRequest('https://example.com/api/admin/session', { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'password-test' }) }));
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie')!;
  expect((await GET(new NextRequest('https://example.com', { headers: { cookie } }))).status).toBe(200);
  const logout = await DELETE(new NextRequest('https://example.com', { method: 'DELETE', headers: { origin: 'https://example.com' } }));
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
});
it('rejects missing origin, bad credentials, and oversized login', async () => {
  expect((await POST(new NextRequest('https://example.com', { method: 'POST' }))).status).toBe(403);
  const headers = { origin: 'https://example.com', 'content-type': 'application/json' };
  expect((await POST(new NextRequest('https://example.com', { method: 'POST', headers, body: JSON.stringify({ username: 'admin', password: 'bad' }) }))).status).toBe(401);
  expect((await POST(new NextRequest('https://example.com', { method: 'POST', headers, body: 'a'.repeat(2049) }))).status).toBe(413);
});
