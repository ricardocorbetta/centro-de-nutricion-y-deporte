import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';
import { obtenerVigenciaPaciente } from '../../../../lib/portal';

export const dynamic = 'force-dynamic';

// GET: historial de peso/medidas del paciente logueado, para mostrarle su propio progreso.
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, session.pacienteId);
    if (!vigencia.vigente) return NextResponse.json({ error: 'Tu acceso venció.', vigente: false }, { status: 403 });

    const { data, error: dbErr } = await sb.from('mediciones_pacientes')
      .select('fecha, peso, altura, perimetro_cintura, perimetro_cadera, pct_grasa, pct_musculo')
      .eq('empresa_id', session.empresaId).eq('paciente_id', session.pacienteId)
      .order('fecha', { ascending: true });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ mediciones: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
