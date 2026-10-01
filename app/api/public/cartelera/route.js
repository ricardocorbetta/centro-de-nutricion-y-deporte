import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolverEmpresaPorSlug } from '../../../../lib/empresas';

export const dynamic = 'force-dynamic';
const BUCKET = 'cartelera-publica';

// GET ?empresa=<slug>: cartelera pública (sin login) — talleres, efemérides, recetas de temporada,
// flyers y novedades de la comunidad. Solo lo publicado (activo=true).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaSlug = searchParams.get('empresa');
    if (!empresaSlug) return NextResponse.json({ error: 'Falta el parámetro empresa.' }, { status: 400 });

    const sb = supabaseAdmin();
    const empresa = await resolverEmpresaPorSlug(sb, empresaSlug);
    if (!empresa) return NextResponse.json({ error: 'Centro no encontrado.' }, { status: 404 });

    const { data, error: dbErr } = await sb.from('cartelera_publica').select('*')
      .eq('empresa_id', empresa.id).eq('activo', true)
      .order('destacar', { ascending: false }).order('fecha', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const { data: { publicUrl: base } } = sb.storage.from(BUCKET).getPublicUrl('');
    const cartelera = (data || []).map(c => ({
      id: c.id, tipo: c.tipo, titulo: c.titulo, descripcion: c.descripcion, fecha: c.fecha, destacar: c.destacar,
      imagenUrl: c.imagen_path ? base.replace(/\/$/, '') + '/' + c.imagen_path : null
    }));

    return NextResponse.json({
      empresa: { slug: empresa.slug, nombre: empresa.nombre, nombreCorto: empresa.nombre_corto, logoUrl: empresa.logo_url, colorPrimario: empresa.color_primario, colorAcento: empresa.color_acento, whatsappAdmin: empresa.whatsapp_admin },
      cartelera
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
