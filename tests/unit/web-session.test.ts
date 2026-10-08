import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { scryptSync } from 'node:crypto';
import { createSession, getSession, requireOrigin, requireSession, SESSION_SECONDS, verifyCredentials } from '../../src/server/auth/session';
import { guardLogin, boundedVerification } from '../../src/server/auth/rate-limit';

describe('private web sessions', () => {
  beforeEach(() => {
    const salt = 'a'.repeat(32);
    vi.stubEnv('WEB_ADMIN_USERNAME', 'admin');
    vi.stubEnv('WEB_ADMIN_PASSWORD_HASH', `scrypt:${salt}:${scryptSync('test-password', salt, 64).toString('hex')}`);
    vi.stubEnv('WEB_SESSION_SECRET', 'b'.repeat(64));
    vi.stubEnv('WEB_ORIGIN', 'https://example.com');
  });
  afterEach(() => { vi.unstubAllEnvs(); });
  it('checks password hash and username', async () => {
    expect(await verifyCredentials('admin', 'test-password')).toBe(true);
    expect(await verifyCredentials('admin', 'bad')).toBe(false);
    expect(await verifyCredentials('other', 'test-password')).toBe(false);
  });
  it('accepts signed sessions and rejects tampering', () => {
    const token = createSession();
    expect(getSession(token)?.username).toBe('admin');
    expect(getSession(`${token}x`)).toBeNull();
    expect(getSession(`${token}.extra`)).toBeNull();
    expect(getSession('x'.repeat(1025))).toBeNull();
    expect(requireSession(new Request('https://example.com', { headers: { cookie: `rbxdb_admin=${token}` } })).username).toBe('admin');
    expect(() => requireSession(new Request('https://example.com', { headers: { cookie: `rbxdb_admin=${token}; rbxdb_admin=${token}` } }))).toThrow();
    expect(() => requireSession(new Request('https://example.com'))).toThrow();
  });
  it('expires sessions and rejects rotation', () => {
    const now = Date.now(), token = createSession(now);
    expect(getSession(token, now + SESSION_SECONDS * 1000)).toBeNull();
    expect(getSession(token, now - 31_000)).toBeNull();
    vi.stubEnv('WEB_SESSION_SECRET', 'c'.repeat(64));
    expect(getSession(token)).toBeNull();
  });
  it('rejects cross-origin and absent-origin writes', () => {
    expect(() => requireOrigin(new Request('https://example.com', { headers: { origin: 'https://evil.test' } }))).toThrow();
    expect(() => requireOrigin(new Request('https://example.com'))).toThrow();
    expect(() => requireOrigin(new Request('https://example.com', { headers: { origin: 'https://example.com' } }))).not.toThrow();
    expect(() => requireOrigin(new Request('https://example.com', { headers: { origin: 'https://example.com', 'sec-fetch-site': 'cross-site' } }))).toThrow();
  });
  it('fails closed when auth unconfigured', async () => {
    vi.stubEnv('WEB_SESSION_SECRET', '');
    expect(() => createSession()).toThrow();
    await expect(verifyCredentials('admin', 'test-password')).rejects.toThrow();
    expect(getSession(null)).toBeNull();
  });
  it('limits login attempts and releases verification slot', async () => {
    const now = Date.now() + 600_000;
    for (let i = 0; i < 6; i++) guardLogin(new Request('https://example.com', { headers: { 'x-real-ip': `1.1.1.${i}` } }), now);
    expect(() => guardLogin(new Request('https://example.com'), now)).toThrow();
    let release!: () => void;
    const first = boundedVerification(() => new Promise<void>(resolve => { release = resolve; }));
    let releaseSecond!: () => void;
    const second = boundedVerification(() => new Promise<void>(resolve => { releaseSecond = resolve; }));
    await expect(boundedVerification(async () => true)).rejects.toThrow();
    release(); releaseSecond(); await Promise.all([first, second]);
    await expect(boundedVerification(async () => { throw new Error('fixture'); })).rejects.toThrow('fixture');
    expect(await boundedVerification(async () => true)).toBe(true);
  });
});
