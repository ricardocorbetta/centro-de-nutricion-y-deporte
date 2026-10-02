import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// PATCH: edita un plan existente (título, secciones, notas) o cambia si está activo.
export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id, planId } = params;
    const body = await request.json();
    const sb = supabaseAdmin();
    const patch = {};
    if (body.titulo !== undefined) patch.titulo = body.titulo;
    if (body.notasGenerales !== undefined) patch.notas_generales = body.notasGenerales || null;
    if (body.secciones !== undefined) patch.secciones = Array.isArray(body.secciones) ? body.secciones : [];
    if (body.profesional !== undefined) patch.profesional = body.profesional || null;
    if (body.activo !== undefined) patch.activo = !!body.activo;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    patch.updated_at = new Date().toISOString();

    if (patch.activo === true) {
      await sb.from('planes_nutricionales').update({ activo: false })
        .eq('paciente_id', id).eq('empresa_id', session.empresaId).eq('activo', true).neq('id', planId);
    }
    const { data, error: dbErr } = await sb.from('planes_nutricionales').update(patch)
      .eq('id', planId).eq('paciente_id', id).eq('empresa_id', session.empresaId).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, plan: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE: elimina un plan (por ejemplo un borrador cargado por error).
export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id, planId } = params;
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('planes_nutricionales').delete()
      .eq('id', planId).eq('paciente_id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
