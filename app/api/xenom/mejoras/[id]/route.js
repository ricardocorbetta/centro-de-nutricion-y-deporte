import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { requireAdminPlataforma } from '../../../../../lib/auth';
import { ESTADOS_MEJORA, PRIORIDADES_MEJORA } from '../../../../../lib/mejoras';

export const dynamic = 'force-dynamic';

// PATCH { estado?, prioridad? }: gestiona un pedido desde el Panel EULALIA. El cambio de estado
// queda en el historial del pedido (lo escribe un trigger en la base).
export async function PATCH(request, { params }) {
  const { error } = requireAdminPlataforma(request);
  if (error) return error;
  try {
    const body = await request.json();
    const patch = {};
    if (body.estado !== undefined) {
      if (!ESTADOS_MEJORA[body.estado]) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
      patch.estado = body.estado;
      // Al reabrir o volver a cerrar, la confirmación anterior de la clínica deja de valer.
      patch.confirmacion = null;
      patch.confirmado_en = null;
    }
    if (body.prioridad !== undefined) {
      if (body.prioridad !== null && !PRIORIDADES_MEJORA[body.prioridad]) {
        return NextResponse.json({ error: 'Prioridad inválida.' }, { status: 400 });
      }
      patch.prioridad = body.prioridad;
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nada para cambiar.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('mejoras').update(patch).eq('id', params.id).select('id').maybeSingle();
    if (dbErr) throw dbErr;
    if (!data) return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/xenom/mejoras/[id]', err);
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 });
  }
}
