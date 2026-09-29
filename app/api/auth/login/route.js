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

    let empresa = null;
    if (user.empresa_id) {
      const { data: empresaRow } = await sb.from('empresas').select('id, slug, nombre, nombre_corto, ciudad, logo_url, color_primario, color_acento, activo')
        .eq('id', user.empresa_id).single();
      if (empresaRow && !empresaRow.activo) {
        return NextResponse.json({ error: 'Esta cuenta está suspendida. Contactá a Xenom.' }, { status: 403 });
      }
      empresa = empresaRow;
    }

    const token = signSession({
      userId: user.id, username: user.username, role: user.role, name: user.name,
      empresaId: user.empresa_id || null,
      esAdminPlataforma: !!user.es_admin_plataforma,
      empresaSlug: empresa?.slug || null,
      empresaNombre: empresa?.nombre || null,
      empresaNombreCorto: empresa?.nombre_corto || null,
      empresaCiudad: empresa?.ciudad || null,
      empresaLogoUrl: empresa?.logo_url || null,
      empresaColorPrimario: empresa?.color_primario || null,
      empresaColorAcento: empresa?.color_acento || null
    });
    const res = NextResponse.json({
      ok: true, role: user.role, name: user.name, username: user.username,
      esAdminPlataforma: !!user.es_admin_plataforma,
      empresa: empresa ? { slug: empresa.slug, nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, ciudad: empresa.ciudad, logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento } : null
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
