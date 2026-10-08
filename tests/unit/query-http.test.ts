import { describe, expect, it } from 'vitest';
import { parsePurchaseQuery } from '../../src/server/purchases/purchase.query';
import { MAX_BODY_BYTES, readBody } from '../../src/lib/http';

describe('query validation',()=>{
 it('defaults to 15 rows',()=>expect(parsePurchaseQuery(new URLSearchParams()).pageSize).toBe(15));
 it('accepts supported days and search',()=>expect(parsePurchaseQuery(new URLSearchParams('days=7&search=%40Player')).search).toBe('@Player'));
 it('rejects unsupported day period',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('days=2'))).toThrow());
 it('rejects duplicate parameters',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('page=1&page=2'))).toThrow());
 it('rejects invalid pagination',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('pageSize=101'))).toThrow());
 it('rejects incompatible date and days filters',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('days=7&from=2026-01-01T00:00:00Z'))).toThrow());
 it('accepts from/to filters',()=>expect(parsePurchaseQuery(new URLSearchParams('from=2026-01-01T00:00:00Z&to=2026-02-01T00:00:00Z')).from).toBeInstanceOf(Date));
 it('rejects reversed dates',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z'))).toThrow());
 it('rejects malformed date filter',()=>expect(()=>parsePurchaseQuery(new URLSearchParams('from=not-date'))).toThrow());
 it('rejects oversized search',()=>expect(()=>parsePurchaseQuery(new URLSearchParams({search:'x'.repeat(121)}))).toThrow());
});
describe('body reader',()=>{
 it('reads valid UTF8 body',async()=>expect(await readBody(new Request('https://example.test',{method:'POST',body:'{}'}))).toBe('{}'));
 it('rejects declared oversized body',async()=>expect(readBody(new Request('https://example.test',{method:'POST',headers:{'content-length':String(MAX_BODY_BYTES+1)},body:'{}'}))).rejects.toMatchObject({statusCode:413}));
 it('rejects actual oversized body',async()=>expect(readBody(new Request('https://example.test',{method:'POST',body:'x'.repeat(MAX_BODY_BYTES+1)}))).rejects.toMatchObject({statusCode:413}));
 it('rejects invalid UTF8',async()=>expect(readBody(new Request('https://example.test',{method:'POST',body:new Uint8Array([0xff])}))).rejects.toMatchObject({statusCode:400}));
});
