import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleError, readBody } from '@/src/lib/http';
import { ApiError } from '@/src/lib/api-error';
import { requestId } from '@/src/lib/request-id';
import { ok } from '@/src/lib/response';
import { guardRequest } from '@/src/lib/rate-limit';
import { createSession, requireOrigin, requireSession, SESSION_COOKIE, SESSION_SECONDS, verifyCredentials } from '@/src/server/auth/session';
import { boundedVerification, guardLogin } from '@/src/server/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const credentials = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(256) }).strict();
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

export async function GET(request: NextRequest) {
  const rid = requestId();
  try { guardRequest(); const session = requireSession(request); return ok({ username: session.username }, rid); }
  catch (error) { return handleError(error, rid); }
}

export async function POST(request: NextRequest) {
  const rid = requestId();
  try {
    guardRequest(); requireOrigin(request); guardLogin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Gunakan application/json');
    }
    const body = await readBody(request, 2048);
    const input = credentials.parse(JSON.parse(body));
    if (!await boundedVerification(() => verifyCredentials(input.username, input.password))) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Username atau password salah');
    }
    const response = ok({ username: input.username }, rid);
    response.cookies.set(SESSION_COOKIE, createSession(), { ...cookieOptions, maxAge: SESSION_SECONDS });
    return response;
  } catch (error) { return handleError(error, rid); }
}

export async function DELETE(request: NextRequest) {
  const rid = requestId();
  try {
    guardRequest(); requireOrigin(request);
    const response: NextResponse = ok({ signedOut: true }, rid);
    response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) { return handleError(error, rid); }
}
