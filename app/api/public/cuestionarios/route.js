import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

export const dynamic = 'force-dynamic';

// Definición pública de un cuestionario activo, para renderizar el formulario dinámico.
// ?empresa=<slug de la empresa>&cuestionario=<slug del cuestionario, ej: "prefiltro">
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    const cuestionarioSlug = searchParams.get('cuestionario');
    if (!empresaSlug || !cuestionarioSlug) return NextResponse.json({ error: 'Faltan parámetros.' }, { status: 400 });

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });

    const { data: cuestionario } = await sb.from('cuestionarios').select('id, nombre, descripcion, campos')
      .eq('empresa_id', empresa.id).eq('slug', cuestionarioSlug).eq('activo', true).maybeSingle();
    if (!cuestionario) return NextResponse.json({ error: 'No encontramos este cuestionario.' }, { status: 404 });

    return NextResponse.json({
      empresa: { nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, ciudad: empresa.ciudad, logoUrl: empresa.logo_url },
      cuestionario
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
