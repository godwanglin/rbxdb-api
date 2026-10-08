import {describe,expect,it,vi} from 'vitest';
const upsert=vi.hoisted(()=>vi.fn());
vi.mock('../../src/lib/prisma',()=>({prisma:{apiRateBucket:{upsert,deleteMany:vi.fn()},purchaseNonce:{deleteMany:vi.fn()},$transaction:vi.fn().mockResolvedValue([])}}));
import {guardAuthenticated,guardRequest} from '../../src/lib/rate-limit';
describe('rate limits',()=>{
 it('limits unauthenticated request work to 1200 per window',()=>{for(let i=0;i<1200;i++)guardRequest(60_000);expect(()=>guardRequest(60_000)).toThrow();expect(()=>guardRequest(120_000)).not.toThrow();});
 it('allows authenticated bucket count600',async()=>{upsert.mockResolvedValueOnce({count:600});await expect(guardAuthenticated('test',120_000)).resolves.toBeUndefined();});
 it('rejects authenticated bucket count601',async()=>{upsert.mockResolvedValueOnce({count:601});await expect(guardAuthenticated('test',120_000)).rejects.toMatchObject({statusCode:429});});
});
