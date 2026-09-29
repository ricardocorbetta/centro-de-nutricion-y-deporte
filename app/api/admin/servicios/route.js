import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') return { error: NextResponse.json({ error: 'Solo la dirección puede editar esto.' }, { status: 403 }) };
  return { session };
}

// POST: crea un servicio para un profesional de la propia empresa. Body: { profesional, nombre, duracion }
export async function POST(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const { profesional, nombre, duracion } = await request.json();
    if (!profesional || !nombre || !duracion) return NextResponse.json({ error: 'Faltan datos del servicio.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('servicios_config').insert({
      empresa_id: session.empresaId, profesional, nombre, duracion: parseInt(duracion, 10), activo: true
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, servicio: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
