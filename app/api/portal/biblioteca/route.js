import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'biblioteca-cnd';

// GET: contenido de la biblioteca visible para este paciente — no depende de la vigencia de 18 meses
// (eso solo rige para el Sector A, planes y evaluaciones). Un paciente ve:
//  - lo "para todos los pacientes de CND",
//  - lo "propio" de cualquier profesional con el que haya tenido al menos un turno,
//  - y lo que se le haya habilitado puntualmente ("específicos").
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();

    const { data: turnos } = await sb.from('turnos_propios').select('resource')
      .eq('empresa_id', session.empresaId).eq('paciente_id', session.pacienteId);
    const misProfesionales = [...new Set((turnos || []).map(t => t.resource).filter(Boolean))];

    const { data: especificos } = await sb.from('contenido_biblioteca_pacientes').select('contenido_id')
      .eq('paciente_id', session.pacienteId);
    const idsEspecificos = (especificos || []).map(e => e.contenido_id);

    // Tres consultas separadas y merge en JS (evita problemas de parseo de .or() con nombres
    // de profesional que puedan tener comas, comillas, etc.)
    const base = () => sb.from('contenido_biblioteca').select('*').eq('empresa_id', session.empresaId).eq('activo', true);
    const [todosCnd, propios, especificosData] = await Promise.all([
      base().eq('visibilidad', 'todos_cnd'),
      misProfesionales.length ? base().eq('visibilidad', 'propios').in('profesional', misProfesionales) : Promise.resolve({ data: [] }),
      idsEspecificos.length ? base().eq('visibilidad', 'especificos').in('id', idsEspecificos) : Promise.resolve({ data: [] })
    ]);
    const vistos = new Set();
    const contenido = [...(todosCnd.data || []), ...(propios.data || []), ...(especificosData.data || [])]
      .filter(c => (vistos.has(c.id) ? false : (vistos.add(c.id), true)))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

    const conLink = await Promise.all((contenido || []).map(async c => {
      let url = null;
      if (c.storage_path) {
        const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(c.storage_path, 60 * 10);
        url = signed?.signedUrl || null;
      }
      return { id: c.id, tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion, fecha: c.fecha, profesional: c.profesional, url };
    }));
    return NextResponse.json({ contenido: conLink });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
