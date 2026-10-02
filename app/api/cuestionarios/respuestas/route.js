import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Respuestas a cuestionarios, cruzando todos los tipos (prefiltro, seguimiento, satisfacción,
// anamnesis, etc.) — usado tanto para la bandeja de "nuevas sin revisar" en el listado de
// pacientes como para la sección de un paciente puntual en su ficha.
// ?pacienteId= filtra por paciente. ?sinRevisar=1 trae solo las que no se revisaron todavía.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const sinRevisar = searchParams.get('sinRevisar');
    const sb = supabaseAdmin();
    let q = sb.from('cuestionario_respuestas').select('*, cuestionarios(nombre, slug, campos), pacientes(nombre)')
      .eq('empresa_id', session.empresaId).order('created_at', { ascending: false });
    if (pacienteId) q = q.eq('paciente_id', pacienteId);
    if (sinRevisar) q = q.is('revisado_at', null);
    const { data, error: dbErr } = await q;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    const respuestas = (data || []).map(r => ({
      ...r,
      cuestionario_nombre: r.cuestionarios?.nombre || null,
      cuestionario_slug: r.cuestionarios?.slug || null,
      cuestionario_campos: r.cuestionarios?.campos || [],
      paciente_nombre: r.pacientes?.nombre || null,
      cuestionarios: undefined, pacientes: undefined
    }));
    return NextResponse.json({ respuestas });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id.' }, { status: 400 });
    const body = await request.json();
    const update = {};
    if (body.revisado) update.revisado_at = new Date().toISOString();
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('cuestionario_respuestas').update(update).eq('id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
