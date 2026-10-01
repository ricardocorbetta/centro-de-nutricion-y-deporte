import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';
import { generarClavePortal, generarUsuarioPortal, obtenerVigenciaPaciente } from '../../../../../lib/portal';

export const dynamic = 'force-dynamic';

// GET: estado del acceso al portal de este paciente (si ya tiene usuario generado, y su vigencia).
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data: paciente, error: e1 } = await sb.from('pacientes')
      .select('id, nombre, telefono, dni, portal_username, portal_generado_en')
      .eq('id', id).eq('empresa_id', session.empresaId).single();
    if (e1 || !paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, id);
    return NextResponse.json({
      tieneAcceso: !!paciente.portal_username,
      username: paciente.portal_username || null,
      generadoEn: paciente.portal_generado_en || null,
      ...vigencia
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: genera (o regenera) el usuario/clave del portal para este paciente. Body opcional: { username }.
// Devuelve la clave en texto plano UNA sola vez, para que la secretaria se la pase al paciente por WhatsApp.
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const sb = supabaseAdmin();
    const { data: paciente, error: e1 } = await sb.from('pacientes')
      .select('id, nombre, telefono, dni, portal_username')
      .eq('id', id).eq('empresa_id', session.empresaId).single();
    if (e1 || !paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });

    const username = (body.username && body.username.trim()) || paciente.portal_username || generarUsuarioPortal(paciente);
    const password = generarClavePortal();

    const { error: rpcErr } = await sb.rpc('set_paciente_password', {
      p_paciente_id: Number(id), p_username: username, p_password: password
    });
    if (rpcErr) {
      if (String(rpcErr.message).includes('duplicate') || rpcErr.code === '23505') {
        return NextResponse.json({ error: 'Ese usuario ya está en uso por otro paciente. Probá con otro.' }, { status: 409 });
      }
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, username, password });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
