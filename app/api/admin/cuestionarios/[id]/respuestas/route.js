import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireDirectorSession } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Listado interno de respuestas recibidas para un cuestionario puntual, más recientes primero.
// ?pacienteId= filtra por un paciente puntual (usado desde la ficha).
export async function GET(request, { params }) {
  const { session, error } = requireDirectorSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const sb = supabaseAdmin();
    let q = sb.from('cuestionario_respuestas').select('*, pacientes(nombre)')
      .eq('empresa_id', session.empresaId).eq('cuestionario_id', params.id).order('created_at', { ascending: false });
    if (pacienteId) q = q.eq('paciente_id', pacienteId);
    const { data, error: dbErr } = await q;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    const respuestas = (data || []).map(r => ({ ...r, paciente_nombre: r.pacientes?.nombre || null, pacientes: undefined }));
    return NextResponse.json({ respuestas });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { session, error } = requireDirectorSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const respuestaId = searchParams.get('respuestaId');
    if (!respuestaId) return NextResponse.json({ error: 'Falta respuestaId.' }, { status: 400 });
    const update = {};
    if (body.revisado) update.revisado_at = new Date().toISOString();
    const sb = supabaseAdmin();
    if (body.pacienteId !== undefined) {
      if (body.pacienteId !== null) {
        const { data: pac } = await sb.from('pacientes').select('id')
          .eq('id', body.pacienteId).eq('empresa_id', session.empresaId).maybeSingle();
        if (!pac) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
      }
      update.paciente_id = body.pacienteId;
    }
    const { error: dbErr } = await sb.from('cuestionario_respuestas').update(update)
      .eq('id', respuestaId).eq('empresa_id', session.empresaId).eq('cuestionario_id', params.id);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
