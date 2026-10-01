import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { overlapsAny } from '../../../../lib/scheduling';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';
import { crearEventoCalendario } from '../../../../lib/googleCalendar';
import { crearPreferencia } from '../../../../lib/mercadoPago';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { empresa: empresaSlug, profesional, fecha, hora, servicio, duracion, pacienteNombre, pacienteTelefono } = body;
    if (!empresaSlug || !profesional || !fecha || !hora || !servicio || !duracion || !pacienteNombre) {
      return NextResponse.json({ error: 'Faltan datos para confirmar la reserva.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    // Re-validar disponibilidad en el momento de confirmar (evita que dos personas reserven el mismo horario)
    const monthKey = fecha.slice(0, 7);
    const [{ data: periodo }, { data: propios }] = await Promise.all([
      sb.from('periods').select('events').eq('empresa_id', empresaId).eq('month_key', monthKey).single(),
      sb.from('turnos_propios').select('time, duration').eq('empresa_id', empresaId).eq('day', fecha).eq('resource', profesional)
    ]);
    const existentesImportados = (periodo?.events || [])
      .filter(e => e.day === fecha && e.resource === profesional && e.status !== 'cancelled')
      .map(e => ({ time: e.time, duration: e.duration }));
    const existentes = [...existentesImportados, ...(propios || [])];

    if (overlapsAny(existentes, hora, duracion)) {
      return NextResponse.json({ error: 'Ese horario se acaba de ocupar. Elegí otro, por favor.' }, { status: 409 });
    }

    // Busca si ya existe una ficha con ese teléfono (identificador más confiable acá, no hay login);
    // si no existe, crea una nueva. Mejor esfuerzo: si falla, el turno igual se guarda sin ficha vinculada.
    let pacienteId = null;
    try {
      if (pacienteTelefono) {
        const { data: existente } = await sb.from('pacientes').select('id').eq('empresa_id', empresaId).eq('telefono', pacienteTelefono).limit(1).maybeSingle();
        if (existente) pacienteId = existente.id;
      }
      if (!pacienteId) {
        const { data: nuevo } = await sb.from('pacientes').insert({
          empresa_id: empresaId, nombre: pacienteNombre, telefono: pacienteTelefono || null
        }).select('id').single();
        if (nuevo) pacienteId = nuevo.id;
      }
    } catch (e) { /* no bloquea la reserva */ }

    const { data: turno, error } = await sb.from('turnos_propios').insert({
      empresa_id: empresaId,
      day: fecha, time: hora, resource: profesional, service: servicio, duration: duracion,
      status: 'booked', financier: 'Particular',
      paciente_id: pacienteId,
      paciente_nombre: pacienteNombre, paciente_telefono: pacienteTelefono || null,
      origen: 'reserva_publica'
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mejor esfuerzo: si la empresa tiene Google Calendar conectado, crea el evento ahí.
    if (empresa.google_calendar_id && turno) {
      const eventId = await crearEventoCalendario({ calendarId: empresa.google_calendar_id, turno, empresaNombre: empresa.nombre });
      if (eventId) await sb.from('turnos_propios').update({ google_event_id: eventId }).eq('id', turno.id);
    }

    // Si la empresa pide seña para confirmar, generamos el link de pago y lo devolvemos:
    // el turno ya queda reservado (bloquea el horario), pero se marca "pendiente" hasta que
    // el webhook confirme el pago. Si no hay seña configurada, la reserva queda confirmada ya.
    let pagoUrl = null;
    if (empresa.mercadopago_access_token && empresa.mercadopago_senia_monto > 0 && turno) {
      const origen = request.headers.get('origin') || new URL(request.url).origin;
      const pref = await crearPreferencia({
        accessToken: empresa.mercadopago_access_token,
        titulo: `Seña — ${servicio} con ${profesional} — ${empresa.nombre}`,
        monto: empresa.mercadopago_senia_monto,
        externalReference: `turno:${turno.id}:tipo:senia`,
        backUrl: `${origen}/reservar/${empresaSlug}?pago=ok`,
        notificationUrl: `${origen}/api/public/mercadopago/webhook?empresaId=${empresaId}`
      });
      if (pref) {
        pagoUrl = pref.initPoint;
        await sb.from('turnos_propios').update({ mp_preference_id: pref.id, mp_payment_status: 'pendiente' }).eq('id', turno.id);
      }
    }

    return NextResponse.json({ ok: true, pagoUrl, seniaMonto: pagoUrl ? empresa.mercadopago_senia_monto : null });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
