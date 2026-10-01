import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';
import { resumenCobros } from '../../../lib/cobrosTurno';

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
    const resumen = await resumenCobros(sb, session.empresaId, desde, hasta);
    return NextResponse.json(resumen);
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
