import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdminPlataforma } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// PATCH: edita branding/plan/estado de una empresa (tenant) existente.
// Body: { nombre?, nombreCorto?, ciudad?, logoUrl?, colorPrimario?, colorAcento?, plan?, activo? }
export async function PATCH(request, { params }) {
  const { error } = requireAdminPlataforma(request);
  if (error) return error;
  try {
    const { id } = params;
    const body = await request.json();
    const patch = {};
    if (body.nombre !== undefined) patch.nombre = body.nombre;
    if (body.nombreCorto !== undefined) patch.nombre_corto = body.nombreCorto;
    if (body.ciudad !== undefined) patch.ciudad = body.ciudad;
    if (body.logoUrl !== undefined) patch.logo_url = body.logoUrl;
    if (body.colorPrimario !== undefined) patch.color_primario = body.colorPrimario;
    if (body.colorAcento !== undefined) patch.color_acento = body.colorAcento;
    if (body.plan !== undefined) patch.plan = body.plan;
    if (body.activo !== undefined) patch.activo = !!body.activo;
    if (body.whatsappAdmin !== undefined) patch.whatsapp_admin = body.whatsappAdmin;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nada para actualizar.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error: upErr } = await sb.from('empresas').update(patch).eq('id', id).select().single();
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, empresa: data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
