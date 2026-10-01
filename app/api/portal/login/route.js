import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { signSession, PACIENTE_SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

// POST: login del paciente al portal. Body: { empresaSlug, usuario, password }.
export async function POST(request) {
  try {
    const { empresaSlug, usuario, password } = await request.json();
    if (!empresaSlug || !usuario || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos.' }, { status: 400 });
    }
    const sb = supabaseAdmin();

    const { data: empresa } = await sb.from('empresas')
      .select('id, slug, nombre, nombre_corto, logo_url, color_primario, color_acento, activo')
      .eq('slug', empresaSlug).single();
    if (!empresa || !empresa.activo) {
      return NextResponse.json({ error: 'No se pudo acceder. Contactá al centro.' }, { status: 403 });
    }

    const { data, error: rpcErr } = await sb.rpc('verify_login_paciente', {
      p_empresa_slug: empresaSlug, p_usuario: usuario.trim(), p_password: password
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    if (!data || !data.length) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
    }
    const paciente = data[0];

    const token = signSession({ pacienteId: paciente.id, empresaId: paciente.empresa_id, empresaSlug });
    const res = NextResponse.json({
      ok: true, nombre: paciente.nombre,
      empresa: { slug: empresa.slug, nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento }
    });
    res.cookies.set(PACIENTE_SESSION_COOKIE_NAME, token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
