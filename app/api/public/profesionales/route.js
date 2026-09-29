import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

export const dynamic = 'force-dynamic';

// Endpoint público (sin login): lista de profesionales activos con sus servicios y horario semanal,
// para armar el formulario de reserva y la agenda interna.
// GET ?empresa=<slug> (requerido) &fecha=YYYY-MM-DD (opcional): si se pasa fecha, el horario de ese día
// de cada profesional refleja también las excepciones puntuales cargadas para esa fecha.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    const fecha = searchParams.get('fecha');
    if (!empresaSlug) return NextResponse.json({ error: 'Falta el parámetro empresa.' }, { status: 400 });

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });
    const empresaId = empresa.id;

    const queries = [
      sb.from('profesionales_config').select('*').eq('empresa_id', empresaId).eq('activo', true),
      sb.from('servicios_config').select('*').eq('empresa_id', empresaId).eq('activo', true),
      sb.from('profesional_horarios').select('*').eq('empresa_id', empresaId).eq('activo', true).is('fecha', null)
    ];
    if (fecha) queries.push(sb.from('profesional_horarios').select('*').eq('empresa_id', empresaId).eq('fecha', fecha));

    const results = await Promise.all(queries);
    const [{ data: profs, error: e1 }, { data: servicios, error: e2 }, { data: horarios, error: e3 }] = results;
    const excepciones = fecha ? (results[3].data || []) : [];
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
    if (fecha && results[3].error) return NextResponse.json({ error: results[3].error.message }, { status: 500 });

    const diaSemana = fecha ? new Date(fecha + 'T00:00:00').getDay() : null;

    const result = (profs || []).map(p => {
      const horariosProf = (horarios || []).filter(h => h.profesional === p.nombre)
        .map(h => ({ diaSemana: h.dia_semana, horaInicio: h.hora_inicio, horaFin: h.hora_fin }))
        .sort((a, b) => a.diaSemana - b.diaSemana);

      let horarioHoy = null;
      if (fecha) {
        const excepcion = excepciones.find(e => e.profesional === p.nombre);
        if (excepcion) {
          horarioHoy = excepcion.activo ? { diaSemana, horaInicio: excepcion.hora_inicio, horaFin: excepcion.hora_fin, excepcion: true } : null;
        } else {
          horarioHoy = horariosProf.find(h => h.diaSemana === diaSemana) || null;
        }
      }

      return {
        nombre: p.nombre,
        diasSemana: horariosProf.map(h => h.diaSemana),
        horarios: horariosProf,
        horarioHoy,
        servicios: (servicios || []).filter(s => s.profesional === p.nombre).map(s => ({ nombre: s.nombre, duracion: s.duracion }))
      };
    });
    return NextResponse.json({
      empresa: { nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, ciudad: empresa.ciudad, logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento },
      profesionales: result
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
