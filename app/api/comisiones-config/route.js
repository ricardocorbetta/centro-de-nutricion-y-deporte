import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('comisiones_config').select('*').eq('empresa_id', session.empresaId);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ config: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  if (session.role !== 'director') {
    return NextResponse.json({ error: 'Solo la dirección puede modificar las comisiones.' }, { status: 403 });
  }
  try {
    const { profesional, pctProfesional } = await request.json();
    if (!profesional || pctProfesional === undefined) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('comisiones_config').upsert({
      empresa_id: session.empresaId, profesional, pct_profesional: pctProfesional, updated_at: new Date().toISOString()
    }, { onConflict: 'empresa_id,profesional' });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
