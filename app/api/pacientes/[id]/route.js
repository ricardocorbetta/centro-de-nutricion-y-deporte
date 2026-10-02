import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET: ficha de un paciente + su historial de turnos y cobros (propios del sistema, no importados de drManager
// — esos no tienen forma de vincularse a una ficha porque no traían paciente_id en el export).
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const [{ data: paciente, error: e1 }, { data: turnos }, { data: cobros }, { data: respuestasCuestionarios }] = await Promise.all([
      sb.from('pacientes').select('*').eq('id', id).eq('empresa_id', session.empresaId).single(),
      sb.from('turnos_propios').select('*').eq('paciente_id', id).eq('empresa_id', session.empresaId).order('day', { ascending: false }),
      sb.from('cobros').select('*').eq('paciente_id', id).eq('empresa_id', session.empresaId).order('fecha', { ascending: false }),
      sb.from('cuestionario_respuestas').select('*, cuestionarios(nombre, slug, campos)').eq('paciente_id', id).eq('empresa_id', session.empresaId).order('created_at', { ascending: false })
    ]);
    if (e1 || !paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
    const cuestionarios = (respuestasCuestionarios || []).map(r => ({
      id: r.id, created_at: r.created_at, respuestas: r.respuestas,
      cuestionario_nombre: r.cuestionarios?.nombre || null, cuestionario_campos: r.cuestionarios?.campos || []
    }));
    return NextResponse.json({ paciente, turnos: turnos || [], cobros: cobros || [], cuestionarios });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// PATCH: edita los datos de la ficha. Body: campos a cambiar (mismos nombres que en el POST de creación).
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const patch = {};
    if (body.nombre !== undefined) patch.nombre = body.nombre;
    if (body.telefono !== undefined) patch.telefono = body.telefono || null;
    if (body.email !== undefined) patch.email = body.email || null;
    if (body.dni !== undefined) patch.dni = body.dni || null;
    if (body.fechaNacimiento !== undefined) patch.fecha_nacimiento = body.fechaNacimiento || null;
    if (body.financiador !== undefined) patch.financiador = body.financiador || null;
    if (body.notas !== undefined) patch.notas = body.notas || null;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('pacientes').update(patch)
      .eq('id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, paciente: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
