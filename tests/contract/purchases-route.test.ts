import crypto from 'node:crypto';
import {afterAll,describe,expect,it} from 'vitest';
import {NextRequest} from 'next/server';
import {POST,GET} from '../../src/app/api/v1/purchases/route';
import {prisma} from '../../src/lib/prisma';
import {GET as HEALTH} from '../../src/app/api/health/route';
import {GET as DETAIL} from '../../src/app/api/v1/purchases/[purchaseId]/route';
process.env.RBX_API_SECRET=crypto.randomBytes(32).toString('hex');
const prefix='test_'+crypto.randomUUID();
const nonces:string[]=[];
const payload={purchaseId:prefix,userId:'987654321',username:'contract_player',displayName:'Contract Player',productId:'98765',itemId:'contract_item',itemName:'Contract Item',category:prefix,robux:10,paymentStatus:'VERIFIED',grantStatus:'PENDING',grantAttempts:1,receiptCreatedAt:new Date().toISOString()};
function req(method:string,path:string,body='') {
 const timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();nonces.push(nonce);
 const canonical=['v1',method,path,timestamp,nonce,crypto.createHash('sha256').update(body).digest('hex')].join('\n');
 const signature=crypto.createHmac('sha256',process.env.RBX_API_SECRET!).update(canonical).digest('hex');
 return new NextRequest('https://example.test'+path,{method,headers:{'content-type':'application/json','x-rbx-key-id':process.env.RBX_API_KEY_ID??'roblox','x-rbx-timestamp':timestamp,'x-rbx-nonce':nonce,'x-rbx-signature':signature},...(body?{body}:{})});
}
describe('purchase route contract',()=>{
 afterAll(async()=>{await prisma.purchase.deleteMany({where:{category:prefix}});await prisma.purchaseNonce.deleteMany({where:{nonce:{in:nonces}}});await prisma.$disconnect();});
 it('stores verified receipt with stable envelope',async()=>{const response=await POST(req('POST','/api/v1/purchases',JSON.stringify(payload)));expect(response.status).toBe(200);const body=await response.json();expect(body.status).toBe('success');expect(body.error).toBeNull();expect(body.data.purchaseId).toBe(prefix);});
 it('duplicate POST keeps one receipt row',async()=>{expect((await POST(req('POST','/api/v1/purchases',JSON.stringify(payload)))).status).toBe(200);expect(await prisma.purchase.count({where:{purchaseId:prefix}})).toBe(1);});
 it('immutable identity returns conflict',async()=>{const response=await POST(req('POST','/api/v1/purchases',JSON.stringify({...payload,userId:'12345'})));expect(response.status).toBe(409);expect((await response.json()).error.code).toBe('RECEIPT_IDENTITY_CONFLICT');});
 it('filters with pagination 15 by default',async()=>{const response=await GET(req('GET','/api/v1/purchases?category='+prefix));expect(response.status).toBe(200);const body=await response.json();expect(body.data.pageSize).toBe(15);expect(body.data.items).toHaveLength(1);});
 it('rejects unauthorized requests',async()=>{const response=await GET(new NextRequest('https://example.test/api/v1/purchases'));expect(response.status).toBe(401);expect((await response.json()).status).toBe('error');});
 it('rejects malformed JSON',async()=>{const response=await POST(req('POST','/api/v1/purchases','{'));expect(response.status).toBe(400);});
 it('updates PENDING to APPLIED without late downgrade',async()=>{expect((await POST(req('POST','/api/v1/purchases',JSON.stringify({...payload,grantStatus:'APPLIED',grantAttempts:2})))).status).toBe(200);await POST(req('POST','/api/v1/purchases',JSON.stringify({...payload,grantAttempts:3})));expect((await prisma.purchase.findUnique({where:{purchaseId:prefix}}))?.grantStatus).toBe('APPLIED');});
 it('supports days/status/category/search filters',async()=>{for(const search of ['@contract_player','Contract Player','987654321','Contract Item']){const path='/api/v1/purchases?days=1&grantStatus=APPLIED&category='+prefix+'&search='+encodeURIComponent(search);const response=await GET(req('GET',path));expect(response.status).toBe(200);expect((await response.json()).data.total).toBe(1);}});
 it('validates page and status filters',async()=>{for(const query of ['page=0','grantStatus=OTHER']){expect((await GET(req('GET','/api/v1/purchases?'+query))).status).toBe(400);}});
 it('returns missing detail 404',async()=>{const id=prefix+'_missing',r=req('GET','/api/v1/purchases/'+id);expect((await DETAIL(r,{params:Promise.resolve({purchaseId:id})})).status).toBe(404);});
 it('rejects malformed payload and absent receipt id',async()=>{for(const data of [{...payload,userId:'bad'},{...payload,purchaseId:undefined}]){expect((await POST(req('POST','/api/v1/purchases',JSON.stringify(data)))).status).toBe(400);}});
 it('rejects unsupported media type',async()=>{const r=req('POST','/api/v1/purchases',JSON.stringify(payload));r.headers.set('content-type','text/plain');expect((await POST(r)).status).toBe(415);});
 it('rejects body larger than 128KB',async()=>expect((await POST(req('POST','/api/v1/purchases','x'.repeat(128*1024+1)))).status).toBe(413));
 it('reports database health',async()=>{const response=await HEALTH();expect(response.status).toBe(200);expect((await response.json()).data.database).toBe('ok');});
});
