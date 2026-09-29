import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') return { error: NextResponse.json({ error: 'Solo la dirección puede editar esto.' }, { status: 403 }) };
  return { session };
}

// PATCH: edita horas o activo de un horario/excepción existente, de la propia empresa.
export async function PATCH(request, { params }) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const patch = {};
    if (body.horaInicio !== undefined) patch.hora_inicio = body.horaInicio;
    if (body.horaFin !== undefined) patch.hora_fin = body.horaFin;
    if (body.activo !== undefined) patch.activo = !!body.activo;
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('profesional_horarios').update(patch)
      .eq('id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, horario: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE: borra un horario recurrente o una excepción, de la propia empresa.
export async function DELETE(request, { params }) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('profesional_horarios').delete().eq('id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
