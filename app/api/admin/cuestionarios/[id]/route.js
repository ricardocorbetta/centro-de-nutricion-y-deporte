import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const update = { updated_at: new Date().toISOString() };
    if (body.nombre !== undefined) update.nombre = body.nombre;
    if (body.descripcion !== undefined) update.descripcion = body.descripcion;
    if (body.vinculaPaciente !== undefined) update.vincula_paciente = !!body.vinculaPaciente;
    if (body.activo !== undefined) update.activo = !!body.activo;
    if (body.campos !== undefined) update.campos = body.campos;

    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('cuestionarios').update(update)
      .eq('id', params.id).eq('empresa_id', session.empresaId).select('*').single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ cuestionario: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('cuestionarios').delete().eq('id', params.id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
