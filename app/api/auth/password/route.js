import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';
import { validarContrasena } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

// POST { actual, nueva }: cada usuario de la clínica cambia su propia contraseña.
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { actual, nueva } = await request.json();
    if (!actual || !nueva) return NextResponse.json({ error: 'Completá la contraseña actual y la nueva.' }, { status: 400 });
    const errPass = validarContrasena(nueva);
    if (errPass) return NextResponse.json({ error: errPass }, { status: 400 });
    if (actual === nueva) return NextResponse.json({ error: 'La nueva contraseña tiene que ser distinta de la actual.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error: rpcErr } = await sb.rpc('verify_login', { p_username: session.username, p_password: actual });
    if (rpcErr) throw rpcErr;
    if (!data?.length || data[0].id !== session.userId) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
    }
    const { error: setErr } = await sb.rpc('set_app_user_password', { p_user_id: session.userId, p_password: nueva });
    if (setErr) throw setErr;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/password', err);
    return NextResponse.json({ error: 'No se pudo cambiar la contraseña.' }, { status: 500 });
  }
}
