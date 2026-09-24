import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('comisiones_config').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ config: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== 'director') {
    return NextResponse.json({ error: 'Solo la dirección puede modificar las comisiones.' }, { status: 403 });
  }
  try {
    const { profesional, pctProfesional } = await request.json();
    if (!profesional || pctProfesional === undefined) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { error } = await sb.from('comisiones_config').upsert({
      profesional, pct_profesional: pctProfesional, updated_at: new Date().toISOString()
    }, { onConflict: 'profesional' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
