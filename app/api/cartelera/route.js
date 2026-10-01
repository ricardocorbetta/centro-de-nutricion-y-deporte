import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'cartelera-publica';

// GET: lista todo (incluye lo oculto) para administrarlo desde el panel.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('cartelera_publica').select('*')
      .eq('empresa_id', session.empresaId)
      .order('destacar', { ascending: false }).order('fecha', { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    const { data: { publicUrl: base } } = sb.storage.from(BUCKET).getPublicUrl('');
    const cartelera = (data || []).map(c => ({ ...c, imagenUrl: c.imagen_path ? base.replace(/\/$/, '') + '/' + c.imagen_path : null }));
    return NextResponse.json({ cartelera });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: publica un ítem nuevo (multipart/form-data). Campos: tipo, titulo, descripcion, fecha,
// destacar ("true"/"false"), image (opcional: flyer/foto).
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const form = await request.formData();
    const tipo = form.get('tipo');
    const titulo = form.get('titulo');
    const descripcion = form.get('descripcion') || null;
    const fecha = form.get('fecha') || new Date().toISOString().slice(0, 10);
    const destacar = form.get('destacar') === 'true';
    const image = form.get('image');

    if (!titulo || !['taller', 'efemeride', 'receta', 'flyer', 'comunidad', 'otro'].includes(tipo)) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    let imagenPath = null;
    if (image && typeof image !== 'string') {
      const ext = (image.name.split('.').pop() || 'jpg').toLowerCase();
      imagenPath = `${session.empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bytes = Buffer.from(await image.arrayBuffer());
      const { error: upErr } = await sb.storage.from(BUCKET).upload(imagenPath, bytes, { contentType: image.type || 'image/jpeg' });
      if (upErr) return NextResponse.json({ error: 'No se pudo subir la imagen: ' + upErr.message }, { status: 500 });
    }

    const { data: row, error: dbErr } = await sb.from('cartelera_publica').insert({
      empresa_id: session.empresaId, tipo, titulo, descripcion, fecha, destacar, imagen_path: imagenPath
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, cartelera: row });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
