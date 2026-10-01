import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const sb = supabaseAdmin();
    let q = sb.from('cobros').select('*').eq('empresa_id', session.empresaId)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false });
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);
    const { data, error: dbErr } = await q;
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ cobros: data || [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    let { fecha, pacienteId, pacienteNombre, pacienteTelefono, profesional, servicio, monto, medioPago } = body;
    if (!fecha || !profesional || !monto || !medioPago) {
      return NextResponse.json({ error: 'Faltan datos obligatorios (fecha, profesional, monto, medio de pago).' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const empresaId = session.empresaId;

    if (pacienteId) {
      const { data: pac } = await sb.from('pacientes').select('nombre, telefono').eq('id', pacienteId).eq('empresa_id', empresaId).single();
      if (pac) { pacienteNombre = pac.nombre; pacienteTelefono = pac.telefono; }
    }
    const { data: cfgRow } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', profesional).single();
    let pct = cfgRow?.pct_profesional;
    if (pct === undefined || pct === null) {
      const { data: def } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', '__default__').single();
      pct = def?.pct_profesional ?? 60;
    }
    const { error: dbErr } = await sb.from('cobros').insert({
      empresa_id: empresaId,
      paciente_id: pacienteId || null,
      fecha, paciente_nombre: pacienteNombre || null, paciente_telefono: pacienteTelefono || null,
      profesional, servicio: servicio || null, monto, medio_pago: medioPago,
      comision_pct: pct, registrado_por: session.username
    });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
