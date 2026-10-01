import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';
import { estadoPagoTurno, comisionDe } from '../../../../../lib/cobrosTurno';

export const dynamic = 'force-dynamic';
const BUCKET = 'comprobantes-pago';

// GET: precio total / cobrado / saldo pendiente de un turno, y el detalle de cada cobro vinculado
// (con un link de descarga temporal del comprobante, si lo tiene).
export async function GET(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const estado = await estadoPagoTurno(sb, session.empresaId, params.id);
    const cobros = await Promise.all(estado.cobros.map(async c => {
      let comprobanteUrl = null;
      if (c.comprobante_path) {
        const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(c.comprobante_path, 60 * 10);
        comprobanteUrl = signed?.signedUrl || null;
      }
      return { ...c, comprobanteUrl };
    }));
    return NextResponse.json({ ...estado, cobros });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: registra un cobro manual contra este turno (anticipo, saldo o completo), con comprobante
// opcional adjunto (obligatorio en la práctica cuando el medio no es Efectivo ni Mercado Pago).
// multipart/form-data: monto, medioPago, tipoCobro (anticipo|saldo|completo), comprobante? (file), fecha?
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { id } = params;
    const form = await request.formData();
    const monto = Number(form.get('monto'));
    const medioPago = form.get('medioPago');
    const tipoCobro = form.get('tipoCobro') || 'completo';
    const fecha = form.get('fecha') || new Date().toISOString().slice(0, 10);
    const comprobante = form.get('comprobante');

    if (!monto || monto <= 0 || !medioPago) {
      return NextResponse.json({ error: 'Faltan el monto o el medio de pago.' }, { status: 400 });
    }
    if (!['anticipo', 'saldo', 'completo'].includes(tipoCobro)) {
      return NextResponse.json({ error: 'Tipo de cobro inválido.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: turno } = await sb.from('turnos_propios').select('*').eq('id', id).eq('empresa_id', session.empresaId).single();
    if (!turno) return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });

    let comprobantePath = null;
    if (comprobante && typeof comprobante !== 'string') {
      const ext = (comprobante.name.split('.').pop() || 'pdf').toLowerCase();
      comprobantePath = `${session.empresaId}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bytes = Buffer.from(await comprobante.arrayBuffer());
      const { error: upErr } = await sb.storage.from(BUCKET).upload(comprobantePath, bytes, { contentType: comprobante.type || 'application/octet-stream' });
      if (upErr) return NextResponse.json({ error: 'No se pudo subir el comprobante: ' + upErr.message }, { status: 500 });
    }

    const pct = await comisionDe(sb, session.empresaId, turno.resource);
    const prefijo = tipoCobro === 'anticipo' ? 'Anticipo — ' : tipoCobro === 'saldo' ? 'Saldo — ' : '';

    const { data: row, error: dbErr } = await sb.from('cobros').insert({
      empresa_id: session.empresaId,
      paciente_id: turno.paciente_id,
      fecha, paciente_nombre: turno.paciente_nombre, paciente_telefono: turno.paciente_telefono,
      profesional: turno.resource, servicio: prefijo + (turno.service || ''),
      monto, medio_pago: medioPago, comision_pct: pct,
      registrado_por: session.name || session.username,
      turno_id: Number(id), tipo_cobro: tipoCobro, comprobante_path: comprobantePath
    }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    // Si con este cobro se terminó de pagar todo, marcamos el turno como atendido automáticamente
    // (hecho acá en el servidor, no solo en el cliente, para que valga para cualquier llamador de
    // este endpoint — solo si todavía estaba "booked", nunca pisa un "cancelled" ni algo ya manual).
    let marcadoAtendido = false;
    if (turno.status === 'booked') {
      const estadoNuevo = await estadoPagoTurno(sb, session.empresaId, id);
      if (estadoNuevo.saldoPendiente === 0 && estadoNuevo.precioTotal !== null) {
        await sb.from('turnos_propios').update({ status: 'cumplido' }).eq('id', id).eq('empresa_id', session.empresaId);
        marcadoAtendido = true;
      }
    }

    return NextResponse.json({ ok: true, cobro: row, marcadoAtendido });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
