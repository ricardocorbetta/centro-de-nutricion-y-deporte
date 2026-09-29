import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';
import { overlapsAny } from '../../../lib/scheduling';

export const dynamic = 'force-dynamic';

// POST: crea un turno "a mano" (lo carga la secretaria o la directora desde la agenda interna).
// Body: { fecha, hora, profesional, servicio, duracion, pacienteNombre, pacienteTelefono, financiador, modalidad }
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { fecha, hora, profesional, servicio, duracion, pacienteNombre, pacienteTelefono, financiador, modalidad } = body;
    if (!fecha || !hora || !profesional || !servicio || !duracion) {
      return NextResponse.json({ error: 'Faltan datos para crear el turno.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresaId = session.empresaId;
    const monthKey = fecha.slice(0, 7);

    // Revalida que el horario siga libre (contra turnos importados de drManager + los ya cargados acá)
    const [{ data: periodo }, { data: propios }] = await Promise.all([
      sb.from('periods').select('events').eq('empresa_id', empresaId).eq('month_key', monthKey).single(),
      sb.from('turnos_propios').select('time, duration').eq('empresa_id', empresaId).eq('day', fecha).eq('resource', profesional).neq('status', 'cancelled')
    ]);
    const existentesImportados = (periodo?.events || [])
      .filter(e => e.day === fecha && e.resource === profesional && e.status !== 'cancelled')
      .map(e => ({ time: e.time, duration: e.duration }));
    const existentes = [...existentesImportados, ...(propios || [])];

    if (overlapsAny(existentes, hora, duracion)) {
      return NextResponse.json({ error: 'Ese horario se superpone con otro turno de ese profesional.' }, { status: 409 });
    }

    const { data, error: dbErr } = await sb.from('turnos_propios').insert({
      empresa_id: empresaId,
      day: fecha, time: hora, resource: profesional, service: servicio, duration: duracion,
      status: 'booked', financier: financiador || 'Particular',
      paciente_nombre: pacienteNombre || null, paciente_telefono: pacienteTelefono || null,
      modalidad: modalidad === 'videollamada' ? 'videollamada' : 'presencial',
      origen: 'staff', creado_por: session.username
    }).select().single();

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, turno: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
