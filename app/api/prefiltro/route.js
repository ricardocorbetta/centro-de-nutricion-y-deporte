import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// Listado interno de entrevistas de prefiltro recibidas, más recientes primero.
// ?pacienteId= filtra por un paciente puntual (usado desde la ficha).
// ?sinRevisar=1 trae solo las que todavía no se marcaron como revisadas.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const pacienteId = searchParams.get('pacienteId');
    const sinRevisar = searchParams.get('sinRevisar');
    const sb = supabaseAdmin();
    let q = sb.from('entrevistas_prefiltro').select('*').eq('empresa_id', session.empresaId).order('created_at', { ascending: false });
    if (pacienteId) q = q.eq('paciente_id', pacienteId);
    if (sinRevisar) q = q.is('revisado_at', null);
    const { data, error: dbErr } = await q;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ entrevistas: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
