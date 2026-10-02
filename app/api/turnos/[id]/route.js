import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';
import { ESTADOS_VALIDOS } from '../../../../lib/agendaEstados';
import { eliminarEventoCalendario } from '../../../../lib/googleCalendar';

export const dynamic = 'force-dynamic';

// PATCH: cambia el estado de un turno cargado desde este sistema (no aplica a los importados de drManager,
// que no tienen id acá). Body: { status } y/o { recordatorioEnviado: true } para marcar que ya se
// le mandó el recordatorio de WhatsApp (no dispara el envío, solo registra que se hizo a mano).
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const { status, recordatorioEnviado } = body;
    const patch = {};
    if (status !== undefined) {
      if (!ESTADOS_VALIDOS.includes(status)) {
        return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
      }
      patch.status = status;
    }
    if (recordatorioEnviado !== undefined) {
      patch.recordatorio_enviado_at = recordatorioEnviado ? new Date().toISOString() : null;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('turnos_propios').update(patch)
      .eq('id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    // Mejor esfuerzo: si se cancela y hay un evento de Google Calendar asociado, se borra.
    if (status === 'cancelled' && data?.google_event_id) {
      const { data: empresa } = await sb.from('empresas').select('google_calendar_id').eq('id', session.empresaId).single();
      if (empresa?.google_calendar_id) {
        await eliminarEventoCalendario({ calendarId: empresa.google_calendar_id, eventId: data.google_event_id });
      }
    }

    return NextResponse.json({ ok: true, turno: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
