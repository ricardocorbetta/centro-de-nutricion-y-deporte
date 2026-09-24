import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const sb = supabaseAdmin();
    let q = sb.from('cobros').select('*').order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ cobros: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const body = await request.json();
    const { fecha, pacienteNombre, pacienteTelefono, profesional, servicio, monto, medioPago } = body;
    if (!fecha || !profesional || !monto || !medioPago) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (fecha, profesional, monto, medio de pago).' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data: cfgRow } = await sb.from('comisiones_config').select('pct_profesional').eq('profesional', profesional).single();
    let pct = cfgRow?.pct_profesional;
    if (pct === undefined || pct === null) {
      const { data: def } = await sb.from('comisiones_config').select('pct_profesional').eq('profesional', '__default__').single();
      pct = def?.pct_profesional ?? 60;
    }
    const { error } = await sb.from('cobros').insert({
      fecha, paciente_nombre: pacienteNombre || null, paciente_telefono: pacienteTelefono || null,
      profesional, servicio: servicio || null, monto, medio_pago: medioPago,
      comision_pct: pct, registrado_por: session.username
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
