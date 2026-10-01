import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';
import { validarAccessToken } from '../../../../lib/mercadoPago';

export const dynamic = 'force-dynamic';

function requireDirector(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return { error };
  if (session.role !== 'director') {
    return { error: NextResponse.json({ error: 'Solo la dirección puede cambiar esta configuración.' }, { status: 403 }) };
  }
  return { session };
}

// GET: estado actual de la integración con Mercado Pago para la empresa de la sesión.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data: empresa } = await sb.from('empresas')
      .select('mercadopago_access_token, mercadopago_senia_monto').eq('id', session.empresaId).single();
    return NextResponse.json({
      conectado: !!empresa?.mercadopago_access_token,
      seniaMonto: empresa?.mercadopago_senia_monto || null
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

// PATCH: guarda el Access Token (valida contra la API antes de guardar) y/o el monto de seña.
// Body: { accessToken } | { seniaMonto }
export async function PATCH(request) {
  const { session, error } = requireDirector(request);
  if (error) return error;
  try {
    const body = await request.json();
    const sb = supabaseAdmin();

    if (body.accessToken !== undefined) {
      const token = (body.accessToken || '').trim();
      if (!token) {
        await sb.from('empresas').update({ mercadopago_access_token: null }).eq('id', session.empresaId);
        return NextResponse.json({ ok: true, conectado: false });
      }
      const cuenta = await validarAccessToken(token);
      if (!cuenta) {
        return NextResponse.json({ error: 'No se pudo validar ese Access Token contra Mercado Pago. Revisá que esté completo y sea de Producción.' }, { status: 400 });
      }
      await sb.from('empresas').update({ mercadopago_access_token: token }).eq('id', session.empresaId);
      return NextResponse.json({ ok: true, conectado: true, cuenta });
    }

    if (body.seniaMonto !== undefined) {
      await sb.from('empresas').update({ mercadopago_senia_monto: body.seniaMonto || null }).eq('id', session.empresaId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
