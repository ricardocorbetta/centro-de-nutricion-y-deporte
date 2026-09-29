import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { overlapsAny } from '../../../../lib/scheduling';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

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

    const { error } = await sb.from('turnos_propios').insert({
      empresa_id: empresaId,
      day: fecha, time: hora, resource: profesional, service: servicio, duration: duracion,
      status: 'booked', financier: 'Particular',
      paciente_nombre: pacienteNombre, paciente_telefono: pacienteTelefono || null,
      origen: 'reserva_publica'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
