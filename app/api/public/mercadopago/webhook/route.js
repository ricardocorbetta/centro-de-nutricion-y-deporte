import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { obtenerPago } from '../../../../../lib/mercadoPago';

export const dynamic = 'force-dynamic';

// Mercado Pago llama acá (IPN/webhook) cada vez que cambia el estado de un pago. La URL se arma
// con ?empresaId=... al crear la preferencia, así sabemos con qué Access Token consultar el pago
// (nunca confiamos en el contenido del POST en sí — siempre se vuelve a pedir el pago real a la
// API de Mercado Pago, que es la única fuente confiable).
//
// external_reference de la preferencia tiene el formato "turno:<id>:tipo:<senia|completo>".
export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');
    let body = {};
    try { body = await request.json(); } catch (e) { /* algunas notificaciones vienen solo por query string */ }
    const paymentId = body?.data?.id || searchParams.get('data.id') || searchParams.get('id');
    const tipo = body?.type || searchParams.get('type') || searchParams.get('topic');

    if (!empresaId || !paymentId || tipo !== 'payment') {
      return NextResponse.json({ ok: true }); // nada que procesar, pero respondemos 200 para que MP no reintente en loop
    }

    const sb = supabaseAdmin();
    const { data: empresa } = await sb.from('empresas').select('*').eq('id', empresaId).single();
    if (!empresa?.mercadopago_access_token) return NextResponse.json({ ok: true });

    const pago = await obtenerPago({ accessToken: empresa.mercadopago_access_token, paymentId });
    if (!pago || pago.status !== 'approved') return NextResponse.json({ ok: true });

    // Idempotencia: si ya procesamos este payment_id, no duplicar el cobro.
    const { data: yaExiste } = await sb.from('cobros').select('id').eq('mp_payment_id', String(pago.id)).maybeSingle();
    if (yaExiste) return NextResponse.json({ ok: true });

    const ref = String(pago.external_reference || '');
    const m = ref.match(/^turno:(\d+):tipo:(senia|completo)$/);
    if (!m) return NextResponse.json({ ok: true });
    const turnoId = m[1];
    const tipoPago = m[2];

    const { data: turno } = await sb.from('turnos_propios').select('*').eq('id', turnoId).eq('empresa_id', empresaId).single();
    if (!turno) return NextResponse.json({ ok: true });

    // Comisión del profesional, igual que en la carga manual de un cobro.
    const { data: cfgRow } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', turno.resource).single();
    let pct = cfgRow?.pct_profesional;
    if (pct === undefined || pct === null) {
      const { data: def } = await sb.from('comisiones_config').select('pct_profesional').eq('empresa_id', empresaId).eq('profesional', '__default__').single();
      pct = def?.pct_profesional ?? 60;
    }

    await sb.from('cobros').insert({
      empresa_id: empresaId,
      paciente_id: turno.paciente_id,
      fecha: new Date().toISOString().slice(0, 10),
      paciente_nombre: turno.paciente_nombre, paciente_telefono: turno.paciente_telefono,
      profesional: turno.resource,
      servicio: (tipoPago === 'senia' ? 'Seña — ' : '') + (turno.service || ''),
      monto: pago.transaction_amount,
      medio_pago: 'MercadoPago',
      comision_pct: pct,
      registrado_por: 'mercadopago (automático)',
      mp_payment_id: String(pago.id)
    });

    await sb.from('turnos_propios').update({
      mp_payment_status: tipoPago === 'senia' ? 'senia_pagada' : 'pagado',
      mp_payment_id: String(pago.id)
    }).eq('id', turnoId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Siempre 200: si devolvemos error, Mercado Pago reintenta indefinidamente la misma notificación.
    return NextResponse.json({ ok: true, warning: String(err.message || err) });
  }
}
