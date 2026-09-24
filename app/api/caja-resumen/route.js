import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getSessionFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// Devuelve el resumen de caja para un rango de fechas: totales por medio de pago,
// por profesional, y comisiones a pagar (monto x comision_pct guardado en cada cobro).
export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    if (!desde || !hasta) return NextResponse.json({ error: 'Faltan parámetros desde/hasta.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error } = await sb.from('cobros').select('*').gte('fecha', desde).lte('fecha', hasta);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const porMedioPago = {};
    const porProfesional = {};
    let totalCobrado = 0, totalComisionProfesionales = 0;

    (data || []).forEach(c => {
      const monto = parseFloat(c.monto) || 0;
      const comision = monto * ((c.comision_pct || 0) / 100);
      totalCobrado += monto;
      totalComisionProfesionales += comision;
      porMedioPago[c.medio_pago] = (porMedioPago[c.medio_pago] || 0) + monto;
      if (!porProfesional[c.profesional]) porProfesional[c.profesional] = { monto: 0, comision: 0, count: 0 };
      porProfesional[c.profesional].monto += monto;
      porProfesional[c.profesional].comision += comision;
      porProfesional[c.profesional].count += 1;
    });

    return NextResponse.json({
      desde, hasta,
      totalCobrado, totalComisionProfesionales, totalCentro: totalCobrado - totalComisionProfesionales,
      porMedioPago, porProfesional, cantidadCobros: (data || []).length
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
