import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';
import { obtenerVigenciaPaciente } from '../../../../lib/portal';

export const dynamic = 'force-dynamic';

// GET: el plan nutricional activo del paciente logueado (si hay uno).
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, session.pacienteId);
    if (!vigencia.vigente) return NextResponse.json({ error: 'Tu acceso venció.', vigente: false }, { status: 403 });

    const { data, error: dbErr } = await sb.from('planes_nutricionales')
      .select('titulo, fecha, profesional, notas_generales, secciones, updated_at')
      .eq('empresa_id', session.empresaId).eq('paciente_id', session.pacienteId).eq('activo', true)
      .order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ plan: data || null });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
