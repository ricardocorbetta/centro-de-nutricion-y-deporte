import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// DELETE: borra una medición cargada por error.
export async function DELETE(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id, medicionId } = params;
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('mediciones_pacientes').delete()
      .eq('id', medicionId).eq('paciente_id', id).eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
