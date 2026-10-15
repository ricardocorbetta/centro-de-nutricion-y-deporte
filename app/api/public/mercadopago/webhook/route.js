import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { obtenerPago } from '../../../../../lib/mercadoPago';
import { estadoPagoTurno } from '../../../../../lib/cobrosTurno';
import { hoyAR, fechaARDe } from '../../../../../lib/fechas';

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

    if (!empresaId || !/^\d+$/.test(String(paymentId || '')) || tipo !== 'payment') {
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
    const m = ref.match(/^turno:(\d+):tipo:(senia|completo|saldo)$/);
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

    const { error: insErr } = await sb.from('cobros').insert({
      empresa_id: empresaId,
      paciente_id: turno.paciente_id,
      // Día de la caja = cuándo se aprobó el pago, en hora argentina (no cuándo llegó el aviso, ni UTC).
      fecha: fechaARDe(pago.date_approved || pago.date_created),
      paciente_nombre: turno.paciente_nombre, paciente_telefono: turno.paciente_telefono,
      profesional: turno.resource,
      servicio: (tipoPago === 'senia' ? 'Seña — ' : tipoPago === 'saldo' ? 'Saldo — ' : '') + (turno.service || ''),
      monto: pago.transaction_amount,
      medio_pago: 'MercadoPago',
      comision_pct: pct,
      registrado_por: 'mercadopago (automático)',
      mp_payment_id: String(pago.id),
      turno_id: turnoId,
      tipo_cobro: tipoPago === 'senia' ? 'anticipo' : tipoPago === 'saldo' ? 'saldo' : 'completo'
    });
    if (insErr) {
      // 23505 = ya hay un cobro con este mp_payment_id (dos avisos de MP casi simultáneos): ya procesado.
      if (insErr.code === '23505') return NextResponse.json({ ok: true });
      // Otro error: 500 para que Mercado Pago reintente, y NO marcar el turno como pagado.
      console.error('webhook MP: no se pudo registrar el cobro', insErr);
      return NextResponse.json({ error: 'No se pudo registrar el cobro.' }, { status: 500 });
    }

    const patch = {
      mp_payment_status: tipoPago === 'senia' ? 'senia_pagada' : 'pagado',
      mp_payment_id: String(pago.id)
    };
    // Si con este pago se terminó de cubrir el precio total, marcamos el turno como atendido
    // automáticamente (solo si seguía "booked" — no pisa un turno ya cancelado o ya marcado a mano —
    // y solo si el turno es hoy o ya pasó: un pago adelantado no puede dar por atendida una consulta futura).
    if (turno.status === 'booked' && turno.day <= hoyAR()) {
      const estado = await estadoPagoTurno(sb, empresaId, turnoId);
      if (estado.saldoPendiente === 0 && estado.precioTotal !== null) patch.status = 'cumplido';
    }
    await sb.from('turnos_propios').update(patch).eq('id', turnoId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Siempre 200: si devolvemos error, Mercado Pago reintenta indefinidamente la misma notificación.
    return NextResponse.json({ ok: true, warning: String(err.message || err) });
  }
}
