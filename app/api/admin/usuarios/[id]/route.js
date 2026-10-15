import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireDirectorSession } from '../../../../../lib/auth';
import { ROLES_VALIDOS, validarContrasena } from '../../../../../lib/roles';

export const dynamic = 'force-dynamic';

// PATCH { nombre?, rol?, activo?, password? }: edita un usuario de la propia clínica (solo dirección).
// Reglas: nadie se puede dar de baja ni quitarse el rol de dirección a sí mismo, y la clínica tiene
// que conservar al menos una persona activa con rol de dirección.
export async function PATCH(request, { params }) {
  const { session, error } = requireDirectorSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const sb = supabaseAdmin();
    const { data: usuario } = await sb.from('app_users').select('id, role, activo')
      .eq('id', params.id).eq('empresa_id', session.empresaId).maybeSingle();
    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });

    const soyYo = usuario.id === session.userId;
    const patch = {};
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre || '').trim().slice(0, 120);
      if (nombre.length < 3) return NextResponse.json({ error: 'Poné el nombre y apellido.' }, { status: 400 });
      patch.name = nombre;
    }
    if (body.rol !== undefined) {
      if (!ROLES_VALIDOS.includes(body.rol)) return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
      if (soyYo && body.rol !== 'director') return NextResponse.json({ error: 'No podés quitarte el rol de dirección a vos mismo.' }, { status: 400 });
      patch.role = body.rol;
    }
    if (body.activo !== undefined) {
      if (soyYo && !body.activo) return NextResponse.json({ error: 'No podés darte de baja a vos mismo.' }, { status: 400 });
      patch.activo = !!body.activo;
    }

    const dejaDeSerDirectorActivo = usuario.role === 'director' && usuario.activo &&
      ((patch.role && patch.role !== 'director') || patch.activo === false);
    if (dejaDeSerDirectorActivo) {
      const { count } = await sb.from('app_users').select('id', { count: 'exact', head: true })
        .eq('empresa_id', session.empresaId).eq('role', 'director').eq('activo', true);
      if ((count || 0) <= 1) return NextResponse.json({ error: 'La clínica tiene que tener al menos una persona con rol de dirección.' }, { status: 400 });
    }

    if (Object.keys(patch).length) {
      const { error: upErr } = await sb.from('app_users').update(patch).eq('id', usuario.id).eq('empresa_id', session.empresaId);
      if (upErr) throw upErr;
    }
    if (body.password !== undefined) {
      const errPass = validarContrasena(body.password);
      if (errPass) return NextResponse.json({ error: errPass }, { status: 400 });
      const { error: rpcErr } = await sb.rpc('set_app_user_password', { p_user_id: usuario.id, p_password: body.password });
      if (rpcErr) throw rpcErr;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/usuarios/[id]', err);
    return NextResponse.json({ error: 'No se pudo actualizar el usuario.' }, { status: 500 });
  }
}
