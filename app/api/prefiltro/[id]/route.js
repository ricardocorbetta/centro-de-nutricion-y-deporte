import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const sb = supabaseAdmin();
    const update = {};
    if (body.revisado) update.revisado_at = new Date().toISOString();
    if (body.pacienteId !== undefined) update.paciente_id = body.pacienteId;
    const { error: dbErr } = await sb.from('entrevistas_prefiltro').update(update)
      .eq('id', params.id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
