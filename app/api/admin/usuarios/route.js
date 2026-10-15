import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireDirectorSession } from '../../../../lib/auth';
import { ROLES_VALIDOS, validarContrasena, normalizarUsuario, usuarioValido } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const COLUMNAS = 'id, username, name, role, activo, created_at, ultimo_ingreso';

// GET: usuarios de la propia clínica (solo dirección).
export async function GET(request) {
  const { session, error } = requireDirectorSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('app_users').select(COLUMNAS)
      .eq('empresa_id', session.empresaId).order('activo', { ascending: false }).order('name');
    if (dbErr) throw dbErr;
    return NextResponse.json({ usuarios: data || [], yo: session.userId });
  } catch (err) {
    console.error('GET /api/admin/usuarios', err);
    return NextResponse.json({ error: 'No se pudieron cargar los usuarios.' }, { status: 500 });
  }
}

// POST { nombre, usuario, rol, password }: alta de un usuario de la clínica (solo dirección).
export async function POST(request) {
  const { session, error } = requireDirectorSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const nombre = String(body.nombre || '').trim().slice(0, 120);
    const usuario = normalizarUsuario(body.usuario);
    const rol = String(body.rol || '');
    if (nombre.length < 3) return NextResponse.json({ error: 'Poné el nombre y apellido.' }, { status: 400 });
    if (!usuarioValido(usuario)) return NextResponse.json({ error: 'El usuario tiene que ser un mail o un nombre corto sin espacios.' }, { status: 400 });
    if (!ROLES_VALIDOS.includes(rol)) return NextResponse.json({ error: 'Elegí un rol.' }, { status: 400 });
    const errPass = validarContrasena(body.password);
    if (errPass) return NextResponse.json({ error: errPass }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: existe } = await sb.from('app_users').select('id').eq('username', usuario).maybeSingle();
    if (existe) return NextResponse.json({ error: 'Ese usuario ya existe. Elegí otro.' }, { status: 409 });

    const { data, error: rpcErr } = await sb.rpc('crear_app_user', {
      p_username: usuario, p_password: body.password, p_role: rol, p_name: nombre, p_empresa_id: session.empresaId
    });
    if (rpcErr) throw rpcErr;
    return NextResponse.json({ ok: true, usuario: data?.[0] || null });
  } catch (err) {
    console.error('POST /api/admin/usuarios', err);
    return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 });
  }
}
