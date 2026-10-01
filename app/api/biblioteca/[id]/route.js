import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
const BUCKET = 'biblioteca-cnd';

// PATCH: activar/desactivar contenido (el contenido no se "borra" para no perder el historial de lo publicado).
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const patch = {};
    if (body.activo !== undefined) patch.activo = !!body.activo;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('contenido_biblioteca').update(patch)
      .eq('id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, contenido: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE: borra definitivamente un ítem (y su archivo del storage, si tenía).
export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const sb = supabaseAdmin();
    const { data: item } = await sb.from('contenido_biblioteca').select('storage_path')
      .eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!item) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    if (item.storage_path) await sb.storage.from(BUCKET).remove([item.storage_path]);
    await sb.from('contenido_biblioteca_pacientes').delete().eq('contenido_id', id);
    const { error: dbErr } = await sb.from('contenido_biblioteca').delete().eq('id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
