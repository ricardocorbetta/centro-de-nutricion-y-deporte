import { NextResponse } from 'next/server';
import { PACIENTE_SESSION_COOKIE_NAME } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PACIENTE_SESSION_COOKIE_NAME, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
