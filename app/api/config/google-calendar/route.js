import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';
import { serviceAccountConfigurado, serviceAccountEmail, probarCalendario } from '../../../../lib/googleCalendar';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') {
    return { error: NextResponse.json({ error: 'Solo la dirección puede cambiar esta configuración.' }, { status: 403 }) };
  }
  return { session };
}

// GET: estado actual de la integración con Google Calendar para la empresa de la sesión.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data: empresa, error: dbErr } = await sb.from('empresas').select('google_calendar_id').eq('id', session.empresaId).single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({
      calendarId: empresa?.google_calendar_id || '',
      serviceAccountEmail: serviceAccountEmail(),
      disponibleEnLaPlataforma: serviceAccountConfigurado()
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// PATCH: guarda (o borra, si viene vacío) el Google Calendar ID de la empresa. Body: { calendarId }
export async function PATCH(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const body = await request.json();
    const calendarId = (body.calendarId || '').trim();

    if (calendarId) {
      const test = await probarCalendario(calendarId);
      if (!test.ok) {
        return NextResponse.json({ error: 'No se pudo conectar con ese calendario: ' + test.error }, { status: 400 });
      }
    }

    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('empresas').update({ google_calendar_id: calendarId || null }).eq('id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, calendarId });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
