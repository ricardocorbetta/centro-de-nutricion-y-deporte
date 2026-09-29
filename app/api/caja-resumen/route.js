import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// Devuelve el resumen de caja para un rango de fechas: totales por medio de pago,
// por profesional, y comisiones a pagar (monto x comision_pct guardado en cada cobro).
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    if (!desde || !hasta) return NextResponse.json({ error: 'Faltan parámetros desde/hasta.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('cobros').select('*')
      .eq('empresa_id', session.empresaId).gte('fecha', desde).lte('fecha', hasta);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const porMedioPago = {};
    const porProfesional = {};
    let totalCobrado = 0, totalComisionProfesionales = 0, totalEstimado = 0, cantidadEstimados = 0;

    (data || []).forEach(c => {
      const monto = parseFloat(c.monto) || 0;
      const comision = monto * ((c.comision_pct || 0) / 100);
      totalCobrado += monto;
      totalComisionProfesionales += comision;
      if (c.registrado_por === 'estimado_backfill') { totalEstimado += monto; cantidadEstimados += 1; }
      porMedioPago[c.medio_pago] = (porMedioPago[c.medio_pago] || 0) + monto;
      if (!porProfesional[c.profesional]) porProfesional[c.profesional] = { monto: 0, comision: 0, count: 0 };
      porProfesional[c.profesional].monto += monto;
      porProfesional[c.profesional].comision += comision;
      porProfesional[c.profesional].count += 1;
    });

    return NextResponse.json({
      desde, hasta,
      totalCobrado, totalComisionProfesionales, totalCentro: totalCobrado - totalComisionProfesionales,
      porMedioPago, porProfesional, cantidadCobros: (data || []).length,
      totalEstimado, cantidadEstimados
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
