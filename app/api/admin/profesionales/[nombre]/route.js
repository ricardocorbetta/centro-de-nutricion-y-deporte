import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') return { error: NextResponse.json({ error: 'Solo la dirección puede editar esto.' }, { status: 403 }) };
  return { session };
}

// PATCH: activar/desactivar un profesional de la propia empresa. Body: { activo }
export async function PATCH(request, { params }) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const nombre = decodeURIComponent(params.nombre);
    const { activo } = await request.json();
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('profesionales_config').update({ activo: !!activo })
      .eq('empresa_id', session.empresaId).eq('nombre', nombre).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, profesional: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
