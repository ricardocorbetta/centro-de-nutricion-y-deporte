import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET: lista los valores de "financiador" ya usados por esta empresa (pacientes + turnos), para
// ofrecerlos como autocompletado al cargar un turno y evitar que typos como "Particular " vs
// "particular" fragmenten los reportes de "Auditar financiadores" en Resumen.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const [{ data: pacientes }, { data: turnos }] = await Promise.all([
      sb.from('pacientes').select('financiador').eq('empresa_id', session.empresaId).not('financiador', 'is', null),
      sb.from('turnos_propios').select('financier').eq('empresa_id', session.empresaId).not('financier', 'is', null)
    ]);
    const set = new Set();
    (pacientes || []).forEach(p => { if (p.financiador && p.financiador.trim()) set.add(p.financiador.trim()); });
    (turnos || []).forEach(t => { if (t.financier && t.financier.trim()) set.add(t.financier.trim()); });
    return NextResponse.json({ financiadores: Array.from(set).sort() });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
