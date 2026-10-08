import { NextResponse } from 'next/server';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export function ok<T>(data:T, requestId:string, meta:Record<string,unknown>={}) { return NextResponse.json({status:'success',data,error:null,meta:{...meta,requestId}}, { headers }); }
export function fail(status:number, code:string, message:string, requestId:string) { return NextResponse.json({status:'error',data:null,error:{code,message},meta:{requestId}}, {status, headers: { ...headers, ...(status === 429 ? { 'Retry-After': '60' } : {}) }}); }
