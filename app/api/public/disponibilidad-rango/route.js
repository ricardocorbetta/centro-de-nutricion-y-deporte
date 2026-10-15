import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';
import { requireEmpresaSession } from '../../../../lib/auth';
import { hoyAR, horaAR, esFechaISO } from '../../../../lib/fechas';
import { horarioDelDia, libresDelDia, sumarDias } from '../../../../lib/disponibilidad';

export const dynamic = 'force-dynamic';

const MAX_DIAS = 31;

// GET ?empresa=<slug>&profesional=...&duracion=40&desde=YYYY-MM-DD&dias=21
// Turnos libres de un profesional en varios días seguidos, para mostrar "qué días hay lugar" sin
// tener que probar fecha por fecha. Devuelve { dias: [{ fecha, atiende, libres, horarios }] }.
// Al público no se le muestran días ni horarios pasados; al personal logueado sí.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    const profesional = searchParams.get('profesional');
    const duracion = parseInt(searchParams.get('duracion') || '40', 10);
    const dias = Math.min(MAX_DIAS, Math.max(1, parseInt(searchParams.get('dias') || '21', 10) || 21));
    const hoy = hoyAR();
    const esPersonal = !requireEmpresaSession(request).error;
    let desde = searchParams.get('desde') || hoy;
    if (!empresaSlug || !profesional || !esFechaISO(desde)) {
      return NextResponse.json({ error: 'Faltan parámetros (empresa, profesional, desde).' }, { status: 400 });
    }
    if (!(duracion >= 5 && duracion <= 240)) return NextResponse.json({ error: 'Duración inválida.' }, { status: 400 });
    if (!esPersonal && desde < hoy) desde = hoy;
    const hasta = sumarDias(desde, dias - 1);

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    const { data: cfg } = await sb.from('profesionales_config').select('nombre, activo')
      .eq('empresa_id', empresaId).eq('nombre', profesional).maybeSingle();
    if (!cfg || cfg.activo === false) return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });

    const meses = [...new Set([desde.slice(0, 7), hasta.slice(0, 7)])];
    const [horariosR, turnosR, periodosR] = await Promise.all([
      sb.from('profesional_horarios').select('dia_semana, fecha, hora_inicio, hora_fin, activo')
        .eq('empresa_id', empresaId).eq('profesional', profesional),
      sb.from('turnos_propios').select('day, time, duration')
        .eq('empresa_id', empresaId).eq('resource', profesional).neq('status', 'cancelled')
        .gte('day', desde).lte('day', hasta),
      sb.from('periods').select('events').eq('empresa_id', empresaId).in('month_key', meses)
    ]);
    for (const r of [horariosR, turnosR, periodosR]) if (r.error) throw r.error;

    const horarios = horariosR.data || [];
    const recurrentes = horarios.filter(h => h.fecha === null);
    const excepciones = horarios.filter(h => h.fecha !== null && h.fecha >= desde && h.fecha <= hasta);
    const ocupadosPorDia = {};
    const ocupar = (day, time, duration) => { (ocupadosPorDia[day] ||= []).push({ time, duration }); };
    (turnosR.data || []).forEach(t => ocupar(t.day, t.time, t.duration));
    (periodosR.data || []).forEach(p => (p.events || []).forEach(e => {
      if (e.resource === profesional && e.status !== 'cancelled' && e.day >= desde && e.day <= hasta) ocupar(e.day, e.time, e.duration);
    }));

    const ahora = horaAR();
    const resultado = [];
    for (let i = 0; i < dias; i++) {
      const fecha = sumarDias(desde, i);
      const horario = horarioDelDia(fecha, recurrentes, excepciones);
      const libres = libresDelDia(horario, ocupadosPorDia[fecha] || [], duracion, !esPersonal && fecha === hoy ? ahora : null);
      resultado.push({ fecha, atiende: !!horario.atiende, libres: libres.length, horarios: libres });
    }
    return NextResponse.json({ desde, hasta, dias: resultado });
  } catch (err) {
    console.error('GET /api/public/disponibilidad-rango', err);
    return NextResponse.json({ error: 'No se pudo calcular la disponibilidad.' }, { status: 500 });
  }
}
