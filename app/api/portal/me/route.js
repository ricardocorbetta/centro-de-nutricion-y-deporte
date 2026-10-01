import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requirePacienteSession } from '../../../../lib/auth';
import { obtenerVigenciaPaciente } from '../../../../lib/portal';

export const dynamic = 'force-dynamic';

// GET: datos del paciente logueado + vigencia de acceso + branding de la empresa (para el shell del portal).
export async function GET(request) {
  const { session, error } = requirePacienteSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const [{ data: paciente }, { data: empresa }] = await Promise.all([
      sb.from('pacientes').select('id, nombre, telefono, email').eq('id', session.pacienteId).single(),
      sb.from('empresas').select('slug, nombre, nombre_corto, logo_url, color_primario, color_acento, activo')
        .eq('id', session.empresaId).single()
    ]);
    if (!paciente || !empresa || !empresa.activo) {
      return NextResponse.json({ error: 'No se pudo acceder.' }, { status: 403 });
    }
    const vigencia = await obtenerVigenciaPaciente(sb, session.empresaId, session.pacienteId);
    return NextResponse.json({
      paciente: { nombre: paciente.nombre },
      empresa: { slug: empresa.slug, nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento },
      ...vigencia
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
