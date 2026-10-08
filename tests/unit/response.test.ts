import { describe, expect, it } from 'vitest';
import { fail, ok } from '@/src/lib/response';

describe('response envelope', () => {
  it('returns a stable success envelope', async () => {
    const body = await (await ok({id: 'x'}, 'req-1')).json();
    expect(body).toEqual({status:'success',data:{id:'x'},error:null,meta:{requestId:'req-1'}});
  });
  it('returns a stable error envelope and status', async () => {
    const response = fail(400, 'VALIDATION_ERROR', 'invalid', 'req-2');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({status:'error',data:null,error:{code:'VALIDATION_ERROR',message:'invalid'},meta:{requestId:'req-2'}});
  });
});
