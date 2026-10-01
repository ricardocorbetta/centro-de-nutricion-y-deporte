import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';
import { obtenerVigenciaPaciente } from '../../../../lib/portal';

export const dynamic = 'force-dynamic';
const BUCKET = 'paciente-archivos';

// GET: planes y evaluaciones del paciente, con un link de descarga temporal cada uno, solo si está vigente.
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, session.pacienteId);
    if (!vigencia.vigente) return NextResponse.json({ error: 'Tu acceso venció.', vigente: false }, { status: 403 });

    const { data: archivos, error: dbErr } = await sb.from('paciente_archivos').select('*')
      .eq('empresa_id', session.empresaId).eq('paciente_id', session.pacienteId)
      .order('fecha', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const conLink = await Promise.all((archivos || []).map(async a => {
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(a.storage_path, 60 * 10);
      return { id: a.id, tipo: a.tipo, categoria: a.categoria, nombre: a.nombre, fecha: a.fecha, url: signed?.signedUrl || null };
    }));
    return NextResponse.json({ archivos: conLink });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
