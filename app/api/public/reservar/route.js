import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { overlapsAny, generateSlots } from '../../../../lib/scheduling';
import { resolverHorarioDia } from '../../../../lib/horarios';
import { hoyAR, horaAR, esFechaISO, esHoraHHMM } from '../../../../lib/fechas';
import { normalizarTelAR, mismoTelefono } from '../../../../lib/telefono';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';
import { crearEventoCalendario } from '../../../../lib/googleCalendar';
import { crearPreferencia } from '../../../../lib/mercadoPago';
import { priceFor, DEFAULT_PRECIOS } from '../../../../lib/stats';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { empresa: empresaSlug, profesional, fecha, hora, servicio } = body;
    const pacienteNombre = String(body.pacienteNombre || '').trim().slice(0, 120);
    const pacienteTelefono = String(body.pacienteTelefono || '').trim().slice(0, 40);
    if (!empresaSlug || !profesional || !fecha || !hora || !servicio || !pacienteNombre) {
      return NextResponse.json({ error: 'Faltan datos para confirmar la reserva.' }, { status: 400 });
    }
    if (!normalizarTelAR(pacienteTelefono)) {
      return NextResponse.json({ error: 'Revisá el teléfono: poné el código de área y el número (ej. 299 555 1234).' }, { status: 400 });
    }
    if (!esFechaISO(fecha) || !esHoraHHMM(hora)) {
      return NextResponse.json({ error: 'Fecha u hora inválida.' }, { status: 400 });
    }
    const hoy = hoyAR();
    if (fecha < hoy || (fecha === hoy && hora <= horaAR())) {
      return NextResponse.json({ error: 'Ese horario ya pasó. Elegí otro, por favor.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    // Todo lo que manda el navegador se vuelve a validar acá: profesional activo, servicio real de ese
    // profesional (la duración sale de la configuración, no del cliente) y horario dentro de su atención.
    const [{ data: prof }, { data: serv }] = await Promise.all([
      sb.from('profesionales_config').select('nombre, activo').eq('empresa_id', empresaId).eq('nombre', profesional).maybeSingle(),
      sb.from('servicios_config').select('nombre, duracion, activo').eq('empresa_id', empresaId).eq('profesional', profesional).eq('nombre', servicio).limit(1).maybeSingle()
    ]);
    if (!prof || prof.activo === false || !serv || serv.activo === false || !(serv.duracion > 0)) {
      return NextResponse.json({ error: 'Ese profesional o servicio no está disponible.' }, { status: 400 });
    }
    const duracion = serv.duracion;
    const horarioDia = await resolverHorarioDia(sb, empresaId, profesional, fecha);
    if (!horarioDia.atiende || !generateSlots(horarioDia.horaInicio, horarioDia.horaFin, duracion).includes(hora)) {
      return NextResponse.json({ error: 'Ese horario no está disponible. Elegí otro, por favor.' }, { status: 409 });
    }

    // Re-validar disponibilidad en el momento de confirmar (evita que dos personas reserven el mismo horario)
    const monthKey = fecha.slice(0, 7);
    const [{ data: periodo }, { data: propios }] = await Promise.all([
      sb.from('periods').select('events').eq('empresa_id', empresaId).eq('month_key', monthKey).single(),
      sb.from('turnos_propios').select('time, duration').eq('empresa_id', empresaId).eq('day', fecha).eq('resource', profesional).neq('status', 'cancelled')
    ]);
    const existentesImportados = (periodo?.events || [])
      .filter(e => e.day === fecha && e.resource === profesional && e.status !== 'cancelled')
      .map(e => ({ time: e.time, duration: e.duration }));
    const existentes = [...existentesImportados, ...(propios || [])];

    if (overlapsAny(existentes, hora, duracion)) {
      return NextResponse.json({ error: 'Ese horario se acaba de ocupar. Elegí otro, por favor.' }, { status: 409 });
    }

    // Busca si ya existe una ficha con ese teléfono (identificador más confiable acá, no hay login),
    // comparando el número normalizado ("0299 15 555-1234" = "+54 9 299 555 1234"); si no existe, crea
    // una nueva. Mejor esfuerzo: si falla, el turno igual se guarda sin ficha vinculada.
    let pacienteId = null;
    try {
      const { data: conTel } = await sb.from('pacientes').select('id, telefono').eq('empresa_id', empresaId).not('telefono', 'is', null);
      const existente = (conTel || []).find(p => mismoTelefono(p.telefono, pacienteTelefono));
      if (existente) pacienteId = existente.id;
      if (!pacienteId) {
        const { data: nuevo } = await sb.from('pacientes').insert({
          empresa_id: empresaId, nombre: pacienteNombre, telefono: pacienteTelefono || null
        }).select('id').single();
        if (nuevo) pacienteId = nuevo.id;
      }
    } catch (e) { /* no bloquea la reserva */ }

    const { data: cfg } = await sb.from('config').select('precios').eq('empresa_id', empresaId).single();
    const precioTotal = priceFor(duracion, cfg?.precios || DEFAULT_PRECIOS);

    const { data: turno, error } = await sb.from('turnos_propios').insert({
      empresa_id: empresaId,
      day: fecha, time: hora, resource: profesional, service: servicio, duration: duracion,
      status: 'booked', financier: 'Particular',
      paciente_id: pacienteId,
      paciente_nombre: pacienteNombre, paciente_telefono: pacienteTelefono || null,
      origen: 'reserva_publica', precio_total: precioTotal
    }).select().single();
    if (error) {
      console.error('reservar: insert turno', error);
      return NextResponse.json({ error: 'No se pudo guardar el turno. Probá de nuevo en un minuto.' }, { status: 500 });
    }

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
      // No usar el header Origin: lo manda el cliente y podría desviar el pago y el webhook a otro dominio.
      const origen = process.env.APP_URL || new URL(request.url).origin;
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
