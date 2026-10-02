import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireEmpresaSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

// Listado de cuestionarios de la empresa (prefiltro, seguimiento, satisfacción, etc.),
// con la cantidad de respuestas recibidas por cada uno.
export async function GET(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const sb = supabaseAdmin();
    const { data, error: dbErr } = await sb.from('cuestionarios').select('*')
      .eq('empresa_id', session.empresaId).order('orden', { ascending: true }).order('created_at', { ascending: true });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    const ids = (data || []).map(c => c.id);
    let counts = {};
    if (ids.length) {
      const { data: respuestas } = await sb.from('cuestionario_respuestas').select('cuestionario_id').in('cuestionario_id', ids);
      (respuestas || []).forEach(r => { counts[r.cuestionario_id] = (counts[r.cuestionario_id] || 0) + 1; });
    }
    const cuestionarios = (data || []).map(c => ({ ...c, cantidadRespuestas: counts[c.id] || 0 }));
    return NextResponse.json({ cuestionarios });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

function slugify(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'cuestionario';
}

export async function POST(request) {
  const { session, error } = requireEmpresaSession(request);
  if (error) return error;
  try {
    const body = await request.json();
    const { nombre, descripcion, vinculaPaciente, campos } = body;
    if (!nombre?.trim()) return NextResponse.json({ error: 'Falta el nombre del cuestionario.' }, { status: 400 });

    const sb = supabaseAdmin();
    let slugBase = slugify(nombre);
    let slug = slugBase;
    for (let i = 2; i < 50; i++) {
      const { data: existe } = await sb.from('cuestionarios').select('id').eq('empresa_id', session.empresaId).eq('slug', slug).maybeSingle();
      if (!existe) break;
      slug = `${slugBase}-${i}`;
    }

    const { data: maxOrden } = await sb.from('cuestionarios').select('orden').eq('empresa_id', session.empresaId).order('orden', { ascending: false }).limit(1).maybeSingle();

    const { data: nuevo, error: dbErr } = await sb.from('cuestionarios').insert({
      empresa_id: session.empresaId, slug, nombre: nombre.trim(), descripcion: descripcion || null,
      vincula_paciente: !!vinculaPaciente, activo: true, orden: (maxOrden?.orden ?? -1) + 1,
      campos: campos || []
    }).select('*').single();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ cuestionario: nuevo });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
