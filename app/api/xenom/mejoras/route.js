import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdminPlataforma } from '../../../../lib/auth';
import { completarMejoras } from '../../../../lib/mejoras';

export const dynamic = 'force-dynamic';

// GET ?estado=abiertos|todos|<estado>: bandeja de pedidos de feedback de todas las clínicas,
// con notas internas, más contadores por estado para el panel.
export async function GET(request) {
  const { error } = requireAdminPlataforma(request);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('estado') || 'abiertos';
    const sb = supabaseAdmin();

    let q = sb.from('mejoras').select('*, empresas(nombre)').order('created_at', { ascending: false }).limit(200);
    if (filtro === 'abiertos') q = q.not('estado', 'in', '(hecho,descartado)');
    else if (filtro !== 'todos') q = q.eq('estado', filtro);
    const [{ data, error: dbErr }, { data: todos }] = await Promise.all([
      q,
      sb.from('mejoras').select('estado, confirmacion')
    ]);
    if (dbErr) throw dbErr;

    const contadores = {};
    (todos || []).forEach(m => { contadores[m.estado] = (contadores[m.estado] || 0) + 1; });
    contadores.sin_confirmar = (todos || []).filter(m => m.estado === 'hecho' && !m.confirmacion).length;

    const filas = (data || []).map(m => ({ ...m, empresa_nombre: m.empresas?.nombre || '', empresas: undefined }));
    const mejoras = await completarMejoras(sb, filas, { incluirInternos: true });
    return NextResponse.json({ mejoras, contadores });
  } catch (err) {
    console.error('GET /api/xenom/mejoras', err);
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos.' }, { status: 500 });
  }
}
