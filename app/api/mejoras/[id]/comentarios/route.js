import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireEmpresaSession, requireAdminPlataforma } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

// POST { texto, interno? }: comenta un pedido. Lo puede hacer la clínica dueña del pedido, o la
// plataforma (EULALIA), que además puede dejar notas internas que la clínica no ve.
export async function POST(request, { params }) {
  const empresa = requireEmpresaSession(request);
  const plataforma = empresa.error ? requireAdminPlataforma(request) : null;
  if (empresa.error && plataforma.error) return empresa.error;
  const esPlataforma = !!plataforma && !plataforma.error;
  const session = esPlataforma ? plataforma.session : empresa.session;
  try {
    const body = await request.json();
    const texto = String(body.texto || '').trim();
    if (!texto || texto.length > 4000) return NextResponse.json({ error: 'Escribí un comentario (hasta 4000 caracteres).' }, { status: 400 });

    const sb = supabaseAdmin();
    let q = sb.from('mejoras').select('id').eq('id', params.id);
    if (!esPlataforma) q = q.eq('empresa_id', session.empresaId);
    const { data: mejora } = await q.maybeSingle();
    if (!mejora) return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });

    const { error: dbErr } = await sb.from('mejoras_comentarios').insert({
      mejora_id: mejora.id,
      autor_nombre: esPlataforma ? 'EULALIA' : (session.name || session.username || 'Usuario'),
      de_plataforma: esPlataforma,
      interno: esPlataforma && !!body.interno,
      texto
    });
    if (dbErr) throw dbErr;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/mejoras/[id]/comentarios', err);
    return NextResponse.json({ error: 'No se pudo guardar el comentario.' }, { status: 500 });
  }
}
