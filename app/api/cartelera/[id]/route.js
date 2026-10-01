import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'cartelera-publica';

// PATCH: activar/desactivar, destacar, o editar el contenido de un ítem (multipart/form-data si
// viene con imagen nueva; JSON si es solo texto/flags).
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const contentType = request.headers.get('content-type') || '';
    const sb = supabaseAdmin();
    const patch = {};

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      if (form.has('tipo')) patch.tipo = form.get('tipo');
      if (form.has('titulo')) patch.titulo = form.get('titulo');
      if (form.has('descripcion')) patch.descripcion = form.get('descripcion');
      if (form.has('fecha')) patch.fecha = form.get('fecha');
      if (form.has('destacar')) patch.destacar = form.get('destacar') === 'true';
      if (form.has('activo')) patch.activo = form.get('activo') === 'true';
      const image = form.get('image');
      if (image && typeof image !== 'string') {
        const { data: item } = await sb.from('cartelera_publica').select('imagen_path').eq('id', id).eq('empresa_id', session.empresaId).single();
        if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
        const ext = (image.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${session.empresaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const bytes = Buffer.from(await image.arrayBuffer());
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: image.type || 'image/jpeg' });
        if (upErr) return NextResponse.json({ error: 'No se pudo subir la imagen: ' + upErr.message }, { status: 500 });
        if (item.imagen_path) await sb.storage.from(BUCKET).remove([item.imagen_path]);
        patch.imagen_path = path;
      }
    } else {
      const body = await request.json();
      if (body.tipo !== undefined) patch.tipo = body.tipo;
      if (body.titulo !== undefined) patch.titulo = body.titulo;
      if (body.descripcion !== undefined) patch.descripcion = body.descripcion;
      if (body.fecha !== undefined) patch.fecha = body.fecha;
      if (body.activo !== undefined) patch.activo = !!body.activo;
      if (body.destacar !== undefined) patch.destacar = !!body.destacar;
    }

    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    const { data, error: dbErr } = await sb.from('cartelera_publica').update(patch)
      .eq('id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, cartelera: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE: borra definitivamente un ítem (y su imagen, si tenía).
export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data: item } = await sb.from('cartelera_publica').select('imagen_path')
      .eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    if (item.imagen_path) await sb.storage.from(BUCKET).remove([item.imagen_path]);
    const { error: dbErr } = await sb.from('cartelera_publica').delete().eq('id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
