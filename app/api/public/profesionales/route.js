import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Endpoint público (sin login): lista de profesionales activos con sus servicios,
// para armar el formulario de reserva.
export async function GET() {
  try {
    const sb = supabaseAdmin();
    const [{ data: profs, error: e1 }, { data: servicios, error: e2 }] = await Promise.all([
      sb.from('profesionales_config').select('*').eq('activo', true),
      sb.from('servicios_config').select('*').eq('activo', true)
    ]);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    const result = (profs || []).map(p => ({
      nombre: p.nombre,
      diasSemana: p.dias_semana,
      horaInicio: p.hora_inicio,
      horaFin: p.hora_fin,
      servicios: (servicios || []).filter(s => s.profesional === p.nombre).map(s => ({ nombre: s.nombre, duracion: s.duracion }))
    }));
    return NextResponse.json({ profesionales: result });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
