import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';
import { resumenCobros } from '../../../../lib/cobrosTurno';

export const dynamic = 'force-dynamic';

// GET ?fecha=YYYY-MM-DD: si ese día ya tiene un cierre de caja guardado, lo devuelve.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    if (!fecha) return NextResponse.json({ error: 'Falta la fecha.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { data } = await sb.from('cierres_caja').select('*').eq('empresa_id', session.empresaId).eq('fecha', fecha).maybeSingle();
    return NextResponse.json({ cierre: data || null });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// POST: cierra la caja de un día (toma una foto de los totales de ese día — por medio de pago,
// por profesional y comisiones — y la guarda). Si ya estaba cerrado, lo vuelve a calcular y
// actualiza la foto (por ejemplo si se cargó un cobro tarde) y registra quién lo hizo de último.
// Body: { fecha }
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const fecha = body.fecha;
    if (!fecha) return NextResponse.json({ error: 'Falta la fecha.' }, { status: 400 });
    const sb = supabaseAdmin();
    const resumen = await resumenCobros(sb, session.empresaId, fecha, fecha);

    const { data, error: dbErr } = await sb.from('cierres_caja').upsert({
      empresa_id: session.empresaId,
      fecha,
      total_cobrado: resumen.totalCobrado,
      total_comision: resumen.totalComisionProfesionales,
      total_centro: resumen.totalCentro,
      cantidad_cobros: resumen.cantidadCobros,
      detalle: { porMedioPago: resumen.porMedioPago, porProfesional: resumen.porProfesional },
      cerrado_por: session.name || session.username,
      cerrado_en: new Date().toISOString()
    }, { onConflict: 'empresa_id,fecha' }).select().single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, cierre: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// DELETE ?fecha=YYYY-MM-DD: reabre la caja de ese día (por si se cerró por error).
export async function DELETE(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    if (!fecha) return NextResponse.json({ error: 'Falta la fecha.' }, { status: 400 });
    const sb = supabaseAdmin();
    const { error: dbErr } = await sb.from('cierres_caja').delete().eq('empresa_id', session.empresaId).eq('fecha', fecha);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
