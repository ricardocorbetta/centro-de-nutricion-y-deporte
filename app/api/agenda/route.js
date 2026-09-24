import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// Devuelve los turnos de un día puntual (fecha=YYYY-MM-DD): los importados de drManager
// + los reservados por el link público de turnos (turnos_propios).
export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Parámetro fecha inválido (esperado YYYY-MM-DD).' }, { status: 400 });
    }
    const monthKey = fecha.slice(0, 7);
    const sb = supabaseAdmin();
    const [{ data: periodo }, { data: propios }] = await Promise.all([
      sb.from('periods').select('events').eq('month_key', monthKey).single(),
      sb.from('turnos_propios').select('*').eq('day', fecha)
    ]);
    const importados = (periodo?.events || []).filter(e => e.day === fecha);
    const propiosMapeados = (propios || []).map(t => ({
      day: t.day, time: t.time, resource: t.resource, service: t.service, duration: t.duration,
      status: t.status, financier: t.financier, origen: 'reserva_publica',
      paciente_nombre: t.paciente_nombre, paciente_telefono: t.paciente_telefono
    }));
    const turnos = [...importados, ...propiosMapeados].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return NextResponse.json({ fecha, turnos });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
