import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'cartelera-publica';

// PATCH: activar/desactivar o destacar un ítem.
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const patch = {};
    if (body.activo !== undefined) patch.activo = !!body.activo;
    if (body.destacar !== undefined) patch.destacar = !!body.destacar;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    const sb = supabaseAdmin();
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
