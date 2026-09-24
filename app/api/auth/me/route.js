import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE_NAME } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = verifySession(token);
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, role: session.role, name: session.name, username: session.username });
}
