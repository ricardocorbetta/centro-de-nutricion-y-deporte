import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

export const dynamic = 'force-dynamic';

// Endpoint público (sin login): datos de marca de una empresa por su slug — nombre, logo y colores.
// Lo usan las páginas públicas (portal, reserva, prefiltro, cartelera) para mostrar el logo y los
// colores propios del centro incluso antes de que la persona se identifique.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    if (!empresaSlug) return NextResponse.json({ error: 'Falta el parámetro empresa.' }, { status: 400 });

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });

    return NextResponse.json({
      empresa: {
        slug: empresa.slug, nombre: empresa.nombre, nombreCorto: empresa.nombre_corto,
        logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento
      }
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
