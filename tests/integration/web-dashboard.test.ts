import { randomUUID, scryptSync } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../../src/lib/prisma';
import { GET as list } from '../../src/app/api/admin/purchases/route';
import { GET as detail } from '../../src/app/api/admin/purchases/[purchaseId]/route';
import { createSession } from '../../src/server/auth/session';

const prefix = `web_test_${randomUUID()}`;
describe('private dashboard database flow', () => {
  beforeAll(async () => {
    await prisma.purchase.createMany({ data: Array.from({ length: 16 }, (_, i) => ({
      purchaseId: `${prefix}_${i}`, userId: BigInt(123456), username: prefix, displayName: 'Web Test',
      productId: BigInt(999), itemId: `fixture_${i}`, itemName: 'Dashboard Fixture', category: prefix,
      robux: 10, paymentStatus: 'VERIFIED', grantStatus: i < 14 ? 'APPLIED' : i === 14 ? 'PENDING' : 'FAILED',
      receiptCreatedAt: new Date(), grantAttempts: 1, failureMessage: i === 15 ? 'fixture failure' : null,
    })) });
  });
  beforeEach(() => {
    const salt = 'a'.repeat(32);
    vi.stubEnv('WEB_ADMIN_USERNAME', 'admin');
    vi.stubEnv('WEB_ADMIN_PASSWORD_HASH', `scrypt:${salt}:${scryptSync('test-password', salt, 64).toString('hex')}`);
    vi.stubEnv('WEB_SESSION_SECRET', 'c'.repeat(64));
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => { await prisma.purchase.deleteMany({ where: { category: prefix } }); await prisma.$disconnect(); });
  function request(path: string) { return new NextRequest(`https://example.com${path}`, { headers: { cookie: `rbxdb_admin=${createSession()}` } }); }
  it('paginates 15 rows and aggregates whole filtered dataset, not current page', async () => {
    const response = await list(request(`/api/admin/purchases?category=${prefix}&days=1`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toHaveLength(15);
    expect(body.data.total).toBe(16);
    expect(body.data.summary).toEqual({ total: 16, robux: 160, applied: 14, pending: 1, failed: 1, unknown: 0 });
    expect(body.data.categories).toContain(prefix);
    const next = await list(request(`/api/admin/purchases?category=${prefix}&page=2`));
    expect((await next.json()).data.items).toHaveLength(1);
  });
  it('applies status and username search to rows and summary', async () => {
    const response = await list(request(`/api/admin/purchases?category=${prefix}&grantStatus=FAILED&search=@${prefix}`));
    const body = await response.json();
    expect(body.data.total).toBe(1); expect(body.data.summary.robux).toBe(10);
    expect(body.data.items[0].userId).toBe('123456');
    expect(body.data.summary.failed).toBe(1);
  });
  it('loads full receipt detail, handles missing/invalid IDs and rejects expired cookie', async () => {
    const id = `${prefix}_15`;
    const response = await detail(request(`/api/admin/purchases/${id}`), { params: Promise.resolve({ purchaseId: id }) });
    expect(response.status).toBe(200); expect((await response.json()).data.failureMessage).toBe('fixture failure');
    expect((await detail(request('/api/admin/purchases/missing'), { params: Promise.resolve({ purchaseId: `${prefix}_missing` }) })).status).toBe(404);
    expect((await detail(request('/api/admin/purchases/bad'), { params: Promise.resolve({ purchaseId: '../bad' }) })).status).toBe(400);
    const expired = new NextRequest('https://example.com/api/admin/purchases', { headers: { cookie: `rbxdb_admin=${createSession(Date.now() - 9 * 3600_000)}` } });
    expect((await list(expired)).status).toBe(401);
  });
});
