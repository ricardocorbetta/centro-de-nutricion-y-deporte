import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// POST { resuelto: boolean, comentario? }: la clínica confirma si un pedido marcado "Hecho" quedó
// resuelto. Si dice que no, el pedido vuelve a "En análisis" y suma una reapertura.
export async function POST(request, { params }) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const resuelto = body.resuelto === true;
    const comentario = String(body.comentario || '').trim().slice(0, 4000);
    if (!resuelto && !comentario) {
      return NextResponse.json({ error: 'Contanos qué sigue sin funcionar.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: mejora } = await sb.from('mejoras').select('id, estado, reaperturas')
      .eq('id', params.id).eq('empresa_id', session.empresaId).maybeSingle();
    if (!mejora) return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    if (mejora.estado !== 'hecho') return NextResponse.json({ error: 'Este pedido todavía no está marcado como hecho.' }, { status: 409 });

    const patch = resuelto
      ? { confirmacion: 'resuelto', confirmado_en: new Date().toISOString() }
      : { confirmacion: 'no_resuelto', confirmado_en: new Date().toISOString(), estado: 'en_analisis', reaperturas: (mejora.reaperturas || 0) + 1 };
    const { error: upErr } = await sb.from('mejoras').update(patch).eq('id', mejora.id);
    if (upErr) throw upErr;

    const autor = session.name || session.username || 'Usuario';
    const texto = resuelto
      ? 'Confirmó que quedó resuelto.' + (comentario ? ' ' + comentario : '')
      : 'Indicó que no quedó resuelto: ' + comentario;
    await sb.from('mejoras_comentarios').insert({ mejora_id: mejora.id, autor_nombre: autor, texto });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/mejoras/[id]/confirmar', err);
    return NextResponse.json({ error: 'No se pudo guardar la confirmación.' }, { status: 500 });
  }
}
