import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { generateSlots, overlapsAny } from '../../../../lib/scheduling';
import { resolverHorarioDia } from '../../../../lib/horarios';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';
import { hoyAR, horaAR } from '../../../../lib/fechas';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET ?empresa=<slug>&profesional=...&fecha=YYYY-MM-DD&duracion=40
// Devuelve los horarios libres para ese profesional ese día, considerando lo ya
// agendado (importado de drManager + reservado por este mismo link).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    const profesional = searchParams.get('profesional');
    const fecha = searchParams.get('fecha');
    const duracion = parseInt(searchParams.get('duracion') || '40', 10);
    if (!(duracion >= 5 && duracion <= 240)) return NextResponse.json({ error: 'Duración inválida.' }, { status: 400 });
    if (!empresaSlug || !profesional || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: 'Faltan parámetros (empresa, profesional, fecha).' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    const { data: cfg } = await sb.from('profesionales_config').select('*').eq('empresa_id', empresaId).eq('nombre', profesional).single();
    if (!cfg || cfg.activo === false) return NextResponse.json({ error: 'Profesional no encontrado.' }, { status: 404 });

    // Al público no se le ofrecen días ni horarios pasados; al personal logueado sí (cargar un turno
    // que ya ocurrió, o uno de recién).
    const esPersonal = !requireEmpresaSession(request).error;
    const hoy = hoyAR();
    if (!esPersonal && fecha < hoy) return NextResponse.json({ fecha, profesional, horarios: [], atiende: true });

    const horarioDia = await resolverHorarioDia(sb, empresaId, profesional, fecha);
    if (!horarioDia.atiende) {
      return NextResponse.json({ fecha, profesional, horarios: [], atiende: false });
    }

    const monthKey = fecha.slice(0, 7);
    const [{ data: periodo }, { data: propios }] = await Promise.all([
      sb.from('periods').select('events').eq('empresa_id', empresaId).eq('month_key', monthKey).single(),
      sb.from('turnos_propios').select('time, duration').eq('empresa_id', empresaId).eq('day', fecha).eq('resource', profesional).neq('status', 'cancelled')
    ]);

    const existentesImportados = (periodo?.events || [])
      .filter(e => e.day === fecha && e.resource === profesional && e.status !== 'cancelled')
      .map(e => ({ time: e.time, duration: e.duration }));
    const existentes = [...existentesImportados, ...(propios || [])];

    const candidatos = generateSlots(horarioDia.horaInicio, horarioDia.horaFin, duracion);
    const ahora = !esPersonal && fecha === hoy ? horaAR() : null;
    const libres = candidatos.filter(h => (!ahora || h > ahora) && !overlapsAny(existentes, h, duracion));

    return NextResponse.json({ fecha, profesional, horarios: libres, atiende: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
