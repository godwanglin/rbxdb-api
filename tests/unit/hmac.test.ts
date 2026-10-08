import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const nonceCreate = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/rate-limit', () => ({guardAuthenticated: vi.fn().mockResolvedValue(undefined)}));
vi.mock('../../src/lib/prisma', () => ({prisma:{purchaseNonce:{create:nonceCreate}}}));
import {verifyHmac} from '../../src/lib/hmac';
const secret = 'test-only-64-character-server-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
function request(timestamp = Math.floor(Date.now()/1000), nonce = 'unit-nonce-123456789', body = '{}', signature?:string) {
 const ts=String(timestamp), path='/api/v1/purchases';
 const hash=crypto.createHash('sha256').update(body).digest('hex');
 const sig=signature ?? crypto.createHmac('sha256',secret).update(['v1','POST',path,ts,nonce,hash].join('\n')).digest('hex');
 return new Request('https://example.test'+path,{method:'POST',headers:{'x-rbx-key-id':'roblox','x-rbx-timestamp':ts,'x-rbx-nonce':nonce,'x-rbx-signature':sig},body});
}
describe('HMAC authentication',()=>{
 beforeEach(()=>{process.env.RBX_API_SECRET=secret;process.env.RBX_API_KEY_ID='roblox';nonceCreate.mockReset();nonceCreate.mockResolvedValue({});});
 it('accepts valid body and signature',async()=>expect(await verifyHmac(request(),'{}','/api/v1/purchases')).toEqual({ok:true}));
 it('rejects invalid signature',async()=>expect((await verifyHmac(request(undefined,undefined,undefined,'a'.repeat(64)),'{}','/api/v1/purchases')).ok).toBe(false));
 it('rejects expired timestamp',async()=>expect((await verifyHmac(request(Math.floor(Date.now()/1000)-1000),'{}','/api/v1/purchases')).ok).toBe(false));
 it('rejects modified body',async()=>expect((await verifyHmac(request(),'not-the-signed-body','/api/v1/purchases')).ok).toBe(false));
 it('rejects replay',async()=>{nonceCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('duplicate',{code:'P2002',clientVersion:'test'}));expect(await verifyHmac(request(),'{}','/api/v1/purchases')).toEqual({ok:false,code:'REPLAYED_NONCE'});});
 it('throws service unavailable on database outage',async()=>{nonceCreate.mockRejectedValueOnce(new Error('database offline'));await expect(verifyHmac(request(),'{}','/api/v1/purchases')).rejects.toMatchObject({statusCode:503});});
 it('rejects a future timestamp',async()=>expect((await verifyHmac(request(Math.floor(Date.now()/1000)+1000),'{}','/api/v1/purchases')).ok).toBe(false));
 it('rejects wrong key id',async()=>{const r=request();r.headers.set('x-rbx-key-id','other');expect((await verifyHmac(r,'{}','/api/v1/purchases')).ok).toBe(false);});
 it('rejects non-hex signature',async()=>expect((await verifyHmac(request(undefined,undefined,undefined,'z'.repeat(64)),'{}','/api/v1/purchases')).ok).toBe(false));
});
