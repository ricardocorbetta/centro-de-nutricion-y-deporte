import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') return { error: NextResponse.json({ error: 'Solo la dirección puede editar esto.' }, { status: 403 }) };
  return { session };
}

// POST: crea un horario recurrente (dia_semana) o una excepción puntual (fecha), para la propia empresa.
// Body: { profesional, diaSemana? , fecha?, horaInicio, horaFin, activo? }
export async function POST(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { profesional, diaSemana, fecha, horaInicio, horaFin } = body;
    const activo = body.activo === undefined ? true : !!body.activo;
    if (!profesional || (diaSemana === undefined && !fecha)) {
      return NextResponse.json({ error: 'Falta el profesional y el día (recurrente o fecha puntual).' }, { status: 400 });
    }
    if (activo && (!horaInicio || !horaFin)) {
      return NextResponse.json({ error: 'Faltan horas de inicio y fin.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const row = {
      empresa_id: session.empresaId,
      profesional,
      dia_semana: fecha ? null : diaSemana,
      fecha: fecha || null,
      hora_inicio: horaInicio || '00:00',
      hora_fin: horaFin || '00:00',
      activo
    };
    const { data, error: dbErr } = await sb.from('profesional_horarios').insert(row).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, horario: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
