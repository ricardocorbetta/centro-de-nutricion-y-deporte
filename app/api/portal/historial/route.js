import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';
import { obtenerVigenciaPaciente } from '../../../../lib/portal';

export const dynamic = 'force-dynamic';

// GET: historial de consultas del paciente (turnos cumplidos), solo si su acceso está vigente.
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, session.pacienteId);
    if (!vigencia.vigente) return NextResponse.json({ error: 'Tu acceso venció.', vigente: false }, { status: 403 });

    const { data, error: dbErr } = await sb.from('turnos_propios')
      .select('day, time, resource, service, modalidad')
      .eq('empresa_id', session.empresaId).eq('paciente_id', session.pacienteId).eq('status', 'cumplido')
      .order('day', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ consultas: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
