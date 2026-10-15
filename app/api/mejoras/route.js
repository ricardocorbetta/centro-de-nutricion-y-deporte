import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../lib/auth';
import { BUCKET_MEJORAS, TIPOS_MEJORA, subirCapturas, completarMejoras } from '../../../lib/mejoras';

export const dynamic = 'force-dynamic';

// GET: los pedidos de feedback de la propia clínica, con su historial (sin notas internas).
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('mejoras').select('*')
      .eq('empresa_id', session.empresaId).order('created_at', { ascending: false }).limit(100);
    if (dbErr) throw dbErr;
    const mejoras = await completarMejoras(sb, data || [], { incluirInternos: false });
    return NextResponse.json({ mejoras });
  } catch (err) {
    console.error('GET /api/mejoras', err);
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos.' }, { status: 500 });
  }
}

// POST (multipart/form-data): manda un pedido nuevo. Campos: tipo, titulo, detalle, pantalla,
// capturas (0 a 3 imágenes).
export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  const sb = supabaseAdmin();
  let paths = [];
  try {
    const form = await request.formData();
    const tipo = String(form.get('tipo') || '');
    const titulo = String(form.get('titulo') || '').trim();
    const detalle = String(form.get('detalle') || '').trim();
    const pantalla = String(form.get('pantalla') || '').slice(0, 200) || null;
    if (!TIPOS_MEJORA[tipo]) return NextResponse.json({ error: 'Elegí qué tipo de pedido es.' }, { status: 400 });
    if (titulo.length < 3 || titulo.length > 160) {
      return NextResponse.json({ error: 'El título tiene que tener entre 3 y 160 caracteres.' }, { status: 400 });
    }
    if (detalle.length > 4000) return NextResponse.json({ error: 'El detalle es demasiado largo.' }, { status: 400 });

    const subida = await subirCapturas(sb, session.empresaId, form.getAll('capturas'));
    paths = subida.paths || [];
    if (subida.error) throw Object.assign(new Error(subida.error), { publico: true });

    const { data, error: dbErr } = await sb.from('mejoras').insert({
      empresa_id: session.empresaId,
      autor_id: session.userId || null,
      autor_nombre: session.name || session.username || 'Usuario',
      tipo, titulo, detalle, pantalla,
      navegador: (request.headers.get('user-agent') || '').slice(0, 300) || null,
      adjuntos: paths
    }).select('id').single();
    if (dbErr) {
      if (dbErr.code === 'P0001') throw Object.assign(new Error(dbErr.message), { publico: true });
      throw dbErr;
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    if (paths.length) await sb.storage.from(BUCKET_MEJORAS).remove(paths);
    if (err.publico) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('POST /api/mejoras', err);
    return NextResponse.json({ error: 'No se pudo enviar el pedido. Probá de nuevo en un rato.' }, { status: 500 });
  }
}
