import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function monthKeysInRange(desde, hasta) {
  const keys = [];
  const d = new Date(desde + 'T00:00:00');
  const end = new Date(hasta + 'T00:00:00');
  d.setDate(1);
  while (d <= end) {
    keys.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

// Devuelve los turnos de un rango de fechas (para la vista semanal), combinando
// lo importado de drManager + lo reservado en turnos_propios, para la empresa de la sesión.
// Params: desde=YYYY-MM-DD, hasta=YYYY-MM-DD
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return NextResponse.json({ error: 'Parámetros desde/hasta inválidos (esperado YYYY-MM-DD).' }, { status: 400 });
    }
    const empresaId = session.empresaId;
    const sb = supabaseAdmin();
    const keys = monthKeysInRange(desde, hasta);

    const [{ data: periodos }, { data: propios }] = await Promise.all([
      sb.from('periods').select('month_key, events').eq('empresa_id', empresaId).in('month_key', keys),
      sb.from('turnos_propios').select('*').eq('empresa_id', empresaId).gte('day', desde).lte('day', hasta)
    ]);

    const importados = (periodos || [])
      .flatMap(p => p.events || [])
      .filter(e => e.day >= desde && e.day <= hasta);
    const propiosMapeados = (propios || []).map(t => ({
      id: t.id, day: t.day, time: t.time, resource: t.resource, service: t.service, duration: t.duration,
      status: t.status, financier: t.financier, origen: t.origen || 'reserva_publica',
      modalidad: t.modalidad || 'presencial',
      paciente_nombre: t.paciente_nombre, paciente_telefono: t.paciente_telefono
    }));

    const turnos = [...importados, ...propiosMapeados].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
    return NextResponse.json({ desde, hasta, turnos });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
