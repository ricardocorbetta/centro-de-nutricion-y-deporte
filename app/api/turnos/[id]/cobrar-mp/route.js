import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';
import { crearPreferencia } from '../../../../../lib/mercadoPago';
import { priceFor, DEFAULT_PRECIOS } from '../../../../../lib/stats';
import { estadoPagoTurno } from '../../../../../lib/cobrosTurno';

export const dynamic = 'force-dynamic';

// Genera un link de pago de Mercado Pago para un turno puntual (cobro en el momento, desde la
// agenda). La secretaria comparte ese link (o lo abre y muestra el QR que arma la propia página
// de Mercado Pago) — cuando el paciente paga, el webhook carga el cobro solo en la caja del día.
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const sb = supabaseAdmin();

    const [{ data: empresa }, { data: turno }, { data: cfg }] = await Promise.all([
      sb.from('empresas').select('*').eq('id', session.empresaId).single(),
      sb.from('turnos_propios').select('*').eq('id', params.id).eq('empresa_id', session.empresaId).single(),
      sb.from('config').select('precios').eq('empresa_id', session.empresaId).single()
    ]);

    if (!empresa?.mercadopago_access_token) {
      return NextResponse.json({ error: 'Esta clínica todavía no conectó Mercado Pago (⚙ Configurar → Mercado Pago).' }, { status: 400 });
    }
    if (!turno) return NextResponse.json({ error: 'Turno no encontrado.' }, { status: 404 });

    const estado = await estadoPagoTurno(sb, session.empresaId, turno.id);
    const yaCobrado = estado.totalCobrado > 0;
    const precioReferencia = estado.precioTotal ?? priceFor(turno.duration, cfg?.precios || DEFAULT_PRECIOS);
    const sugerido = yaCobrado ? Math.max(0, precioReferencia - estado.totalCobrado) : precioReferencia;
    const monto = body.monto || sugerido;
    if (!monto || monto <= 0) return NextResponse.json({ error: 'No se pudo determinar un monto a cobrar (¿ya está todo cobrado?).' }, { status: 400 });
    const tipoRef = yaCobrado ? 'saldo' : 'completo';

    const origen = request.headers.get('origin') || new URL(request.url).origin;
    const pref = await crearPreferencia({
      accessToken: empresa.mercadopago_access_token,
      titulo: `${tipoRef === 'saldo' ? 'Saldo — ' : ''}${turno.service || 'Consulta'} — ${empresa.nombre}`,
      monto,
      externalReference: `turno:${turno.id}:tipo:${tipoRef}`,
      backUrl: `${origen}/reservar/${empresa.slug}`,
      notificationUrl: `${origen}/api/public/mercadopago/webhook?empresaId=${empresa.id}`
    });
    if (!pref) return NextResponse.json({ error: 'Mercado Pago no devolvió un link de pago. Revisá el Access Token conectado.' }, { status: 502 });

    await sb.from('turnos_propios').update({ mp_preference_id: pref.id, mp_payment_status: 'pendiente' }).eq('id', turno.id);

    return NextResponse.json({ ok: true, link: pref.initPoint, monto });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
