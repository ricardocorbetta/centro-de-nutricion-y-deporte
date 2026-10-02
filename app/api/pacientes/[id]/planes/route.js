import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET: historial de planes nutricionales del paciente, más reciente primero.
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('planes_nutricionales').select('*')
      .eq('paciente_id', id).eq('empresa_id', session.empresaId)
      .order('activo', { ascending: false }).order('fecha', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ planes: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: crea un plan nutricional nuevo. Si se marca activo, desactiva los anteriores
// (el paciente ve en su portal solo el plan activo, pero el historial queda guardado).
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    if (!body.titulo || !String(body.titulo).trim()) {
      return NextResponse.json({ error: 'El plan necesita un título.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data: paciente } = await sb.from('pacientes').select('id').eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!paciente) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });

    const activo = body.activo !== false;
    if (activo) {
      await sb.from('planes_nutricionales').update({ activo: false })
        .eq('paciente_id', id).eq('empresa_id', session.empresaId).eq('activo', true);
    }
    const row = {
      empresa_id: session.empresaId,
      paciente_id: Number(id),
      titulo: String(body.titulo).trim(),
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      profesional: body.profesional || session.name || null,
      notas_generales: body.notasGenerales || null,
      secciones: Array.isArray(body.secciones) ? body.secciones : [],
      activo
    };
    const { data, error: dbErr } = await sb.from('planes_nutricionales').insert(row).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, plan: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
