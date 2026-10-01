import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';
import { overlapsAny } from '../../../lib/scheduling';
import { crearEventoCalendario } from '../../../lib/googleCalendar';
import { priceFor, DEFAULT_PRECIOS } from '../../../lib/stats';

export const dynamic = 'force-dynamic';

// POST: crea un turno "a mano" (lo carga la secretaria o la directora desde la agenda interna).
// Body: { fecha, hora, profesional, servicio, duracion, pacienteId?, pacienteNombre, pacienteTelefono, financiador, modalidad }
// pacienteId (opcional): si viene de una ficha ya creada, se usa su nombre/teléfono como snapshot del turno.
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    let { fecha, hora, profesional, servicio, duracion, pacienteId, pacienteNombre, pacienteTelefono, financiador, modalidad, precioTotal } = body;
    if (!fecha || !hora || !profesional || !servicio || !duracion) {
      return NextResponse.json({ error: 'Faltan datos para crear el turno.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresaId = session.empresaId;

    if (pacienteId) {
      const { data: pac } = await sb.from('pacientes').select('nombre, telefono').eq('id', pacienteId).eq('empresa_id', empresaId).single();
      if (!pac) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });
      pacienteNombre = pac.nombre;
      pacienteTelefono = pac.telefono;
    }
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

    let precio = precioTotal !== undefined && precioTotal !== null && precioTotal !== '' ? Number(precioTotal) : null;
    if (precio === null) {
      const { data: cfg } = await sb.from('config').select('precios').eq('empresa_id', empresaId).single();
      precio = priceFor(duracion, cfg?.precios || DEFAULT_PRECIOS);
    }

    const { data, error: dbErr } = await sb.from('turnos_propios').insert({
      empresa_id: empresaId,
      day: fecha, time: hora, resource: profesional, service: servicio, duration: duracion,
      status: 'booked', financier: financiador || 'Particular',
      paciente_id: pacienteId || null,
      paciente_nombre: pacienteNombre || null, paciente_telefono: pacienteTelefono || null,
      modalidad: modalidad === 'videollamada' ? 'videollamada' : 'presencial',
      origen: 'staff', creado_por: session.username, precio_total: precio
    }).select().single();

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    // Mejor esfuerzo: si la empresa tiene Google Calendar conectado, crea el evento ahí.
    // Nunca bloquea la respuesta ni hace fallar la creación del turno.
    const { data: empresa } = await sb.from('empresas').select('nombre, google_calendar_id').eq('id', empresaId).single();
    if (empresa?.google_calendar_id) {
      const eventId = await crearEventoCalendario({ calendarId: empresa.google_calendar_id, turno: data, empresaNombre: empresa.nombre });
      if (eventId) {
        await sb.from('turnos_propios').update({ google_event_id: eventId }).eq('id', data.id);
        data.google_event_id = eventId;
      }
    }

    return NextResponse.json({ ok: true, turno: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
