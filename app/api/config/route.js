import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('config').upsert({
      empresa_id: session.empresaId,
      consultorios: body.consultorios,
      horas_consultorio: body.horasConsultorio,
      precios: body.precios,
      updated_at: new Date().toISOString()
    }, { onConflict: 'empresa_id' });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
