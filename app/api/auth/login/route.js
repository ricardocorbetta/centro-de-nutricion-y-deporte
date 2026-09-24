import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data, error } = await sb.rpc('verify_login', { p_username: username, p_password: password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || !data.length) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }
    const user = data[0];
    const token = signSession({ userId: user.id, username: user.username, role: user.role, name: user.name });
    const res = NextResponse.json({ ok: true, role: user.role, name: user.name, username: user.username });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
